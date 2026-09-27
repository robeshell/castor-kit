/**
 * SSRF protection for scheduled-task request URLs (validateRequestUrl)
 *
 * - Only http/https; the target must not be loopback / private / link-local (incl. cloud metadata 169.254.169.254) / reserved
 * - The URL is parsed with the WHATWG URL parser, the same one the HTTP client uses, so the host checked here is the host
 *   connected to (IPv4 shorthands such as `http://127.1/` are normalized before the check); an unparsable URL is「请求地址格式不合法」
 * - Every resolved address of a hostname is checked (a single internal IP means rejection)
 * - When a domain resolves into a blocked range the message includes the resolution (`不允许访问内网地址（localhost 解析为 127.0.0.1）`); IP literals get a fixed message
 * - IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is judged by its embedded IPv4, so it isn't let through as plain IPv6
 * - Additionally blocks `::/128` (the unspecified address, equivalent to localhost on most systems)
 * - At execution time (http.ts) the actually-connected IP is re-checked with the same rules on connect, defeating DNS rebinding and redirect bypasses
 */

import dns from 'node:dns'
import net from 'node:net'
import { ScheduledTaskSchemaError } from './errors'

const BLOCKED_NETWORKS: Array<[string, number, 'ipv4' | 'ipv6']> = [
  ['0.0.0.0', 8, 'ipv4'],
  ['10.0.0.0', 8, 'ipv4'],
  ['100.64.0.0', 10, 'ipv4'],
  ['127.0.0.0', 8, 'ipv4'],
  ['169.254.0.0', 16, 'ipv4'],
  ['172.16.0.0', 12, 'ipv4'],
  ['192.168.0.0', 16, 'ipv4'],
  ['198.18.0.0', 15, 'ipv4'],
  ['224.0.0.0', 4, 'ipv4'],
  ['::1', 128, 'ipv6'],
  ['fc00::', 7, 'ipv6'],
  ['fe80::', 10, 'ipv6'],
  // Hardening: unspecified address
  ['::', 128, 'ipv6'],
]

const blockList = new net.BlockList()
for (const [address, prefix, family] of BLOCKED_NETWORKS) blockList.addSubnet(address, prefix, family)

export const BLOCKED_ADDRESS_MESSAGE = '不允许访问内网地址'

/** Message when a domain resolves into a blocked range: `不允许访问内网地址（localhost 解析为 127.0.0.1）` */
export function blockedHostMessage(hostname: string, address: string): string {
  return `${BLOCKED_ADDRESS_MESSAGE}（${hostname} 解析为 ${address}）`
}

/** Strip the IPv6 zone (`fe80::1%en0`) and square brackets */
function bareIp(ip: string): string {
  let text = ip
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  const zone = text.indexOf('%')
  return zone >= 0 ? text.slice(0, zone) : text
}

/**
 * Whether an IP is in a blocked range. Returns false for non-IP text (callers check with net.isIP first).
 * net.BlockList matches IPv4-mapped IPv6 addresses against IPv4 rules via the embedded IPv4.
 */
export function isBlockedIp(ip: string): boolean {
  const bare = bareIp(ip)
  const family = net.isIP(bare)
  if (family === 0) return false
  return blockList.check(bare, family === 4 ? 'ipv4' : 'ipv6')
}

export type HostLookup = (hostname: string) => Promise<string[]>

/** Every address the hostname resolves to */
export const defaultLookup: HostLookup = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true })
  return results.map((r) => r.address)
}

export interface ValidateOptions {
  lookup?: HostLookup
}

/**
 * Validate a scheduled-task target URL: http/https scheme + target IP not in an internal/reserved range.
 * Returns the trimmed URL text; throws ScheduledTaskSchemaError when invalid.
 */
export async function validateRequestUrl(raw: string | null | undefined, { lookup = defaultLookup }: ValidateOptions = {}): Promise<string> {
  const text = (raw ?? '').trim()
  if (!text) throw new ScheduledTaskSchemaError('请求地址不能为空')

  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new ScheduledTaskSchemaError('请求地址格式不合法')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new ScheduledTaskSchemaError('请求地址仅支持 http/https 协议')
  // The parser accepts port 0, which can't be connected to
  if (url.port === '0') throw new ScheduledTaskSchemaError('请求地址端口不合法')
  // IPv6 hosts come bracketed (`[::1]`)
  const hostname = url.hostname.replace(/^\[(.*)\]$/, '$1')
  if (!hostname) throw new ScheduledTaskSchemaError('请求地址缺少主机名')

  // IP literal: check directly
  if (net.isIP(hostname) !== 0) {
    if (isBlockedIp(hostname)) throw new ScheduledTaskSchemaError(BLOCKED_ADDRESS_MESSAGE)
    return text
  }

  // Hostname: resolve and check every result (a single internal IP means rejection)
  let addresses: string[]
  try {
    addresses = await lookup(hostname)
  } catch {
    throw new ScheduledTaskSchemaError('请求地址无法解析')
  }
  for (const address of addresses) {
    // Include the resolution: a local proxy's fake-ip mode (198.18.0.0/15) makes every domain look internal; showing the IP makes the cause obvious
    if (isBlockedIp(address)) throw new ScheduledTaskSchemaError(blockedHostMessage(hostname, address))
  }
  return text
}
