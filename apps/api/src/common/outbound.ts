/**
 * Where the server may connect on behalf of system settings (SMTP host, S3 endpoint, AI API): SSRF protection for
 * values an admin types on the settings page.
 *
 * - Always blocked: link-local (cloud metadata 169.254.169.254, fe80::/10), unspecified, multicast / reserved
 * - Internal networks (loopback, 10/8, 172.16/12, 192.168/16, 100.64/10, 198.18/15, fc00::/7): blocked unless
 *   SETTINGS_ALLOW_PRIVATE_NETWORK is on (default: on in development / test, off in production). Turn it on to use a
 *   MinIO or mail server on your own network
 * - Values pinned by environment variables are the operator's choice and aren't checked
 * - Checked when a setting is saved and when a test button runs; AI requests re-check the connected address as well
 *   (createOutboundAgent), so a hostname can't be pointed at an internal address after it was saved (DNS rebinding)
 */

import dns from 'node:dns'
import net from 'node:net'
import { Agent, buildConnector } from 'undici'

const ALWAYS_BLOCKED: Array<[string, number, 'ipv4' | 'ipv6']> = [
  ['0.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['224.0.0.0', 3, 'ipv4'],
  ['::', 128, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  ['ff00::', 8, 'ipv6'],
]
const PRIVATE: Array<[string, number, 'ipv4' | 'ipv6']> = [
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
]

function blockList(ranges: Array<[string, number, 'ipv4' | 'ipv6']>): net.BlockList {
  const list = new net.BlockList()
  for (const [address, prefix, family] of ranges) list.addSubnet(address, prefix, family)
  return list
}
const alwaysBlocked = blockList(ALWAYS_BLOCKED)
const privateNetworks = blockList(PRIVATE)

function bareIp(ip: string): string {
  const text = ip.startsWith('[') && ip.endsWith(']') ? ip.slice(1, -1) : ip
  const zone = text.indexOf('%')
  return zone >= 0 ? text.slice(0, zone) : text
}

/** Why the server must not connect to this IP (message names the host and address), or null */
export function blockedAddressReason(host: string, ip: string, allowPrivate: boolean): string | null {
  const bare = bareIp(ip)
  const family = net.isIP(bare)
  if (family === 0) return null
  const type = family === 4 ? 'ipv4' : 'ipv6'
  if (alwaysBlocked.check(bare, type)) return `不允许访问保留地址（${host} 解析为 ${bare}）`
  if (!allowPrivate && privateNetworks.check(bare, type)) return `不允许访问内网地址（${host} 解析为 ${bare}）`
  return null
}

export type HostLookup = (hostname: string) => Promise<string[]>

const defaultLookup: HostLookup = async (hostname) =>
  (await dns.promises.lookup(hostname, { all: true, verbatim: true })).map((r) => r.address)

/**
 * Check a host name or IP (every resolved address must be allowed). Returns the reason it is rejected, or null.
 * A name that doesn't resolve isn't rejected here: connecting to it fails anyway.
 */
export async function outboundHostReason(host: string, allowPrivate: boolean, lookup: HostLookup = defaultLookup): Promise<string | null> {
  const bare = bareIp(host.trim())
  if (!bare) return null
  if (net.isIP(bare) !== 0) return blockedAddressReason(bare, bare, allowPrivate)
  let addresses: string[]
  try {
    addresses = await lookup(bare)
  } catch {
    return null
  }
  for (const address of addresses) {
    const reason = blockedAddressReason(bare, address, allowPrivate)
    if (reason) return reason
  }
  return null
}

/** Host part of an http(s) URL setting ('' when empty or unparsable) */
export function hostOfUrl(url: string): string {
  try {
    return url ? new URL(url).hostname : ''
  } catch {
    return ''
  }
}

/**
 * undici Agent whose connections re-check the address actually connected to (hostnames: every resolved address,
 * handed to the socket as checked; IP literals: up front)
 */
export function createOutboundAgent(allowPrivate: boolean, timeout: number): Agent {
  const lookup: net.LookupFunction = (hostname, options, callback) => {
    dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
      if (err) return callback(err, '', 0)
      const list = addresses as dns.LookupAddress[]
      if (list.length === 0) return callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }), '', 0)
      for (const a of list) {
        const reason = blockedAddressReason(hostname, a.address, allowPrivate)
        if (reason) return callback(new Error(reason), '', 0)
      }
      if ((options as dns.LookupOptions).all) {
        ;(callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
      } else {
        callback(null, list[0]!.address, list[0]!.family)
      }
    })
  }
  const baseConnect = buildConnector({ lookup, timeout } as buildConnector.BuildOptions)
  return new Agent({
    headersTimeout: timeout,
    bodyTimeout: timeout,
    connect: (options, callback) => {
      const host = bareIp(options.hostname)
      const reason = net.isIP(host) !== 0 ? blockedAddressReason(host, host, allowPrivate) : null
      if (reason) {
        callback(new Error(reason), null)
        return
      }
      baseConnect(options, callback)
    },
  })
}
