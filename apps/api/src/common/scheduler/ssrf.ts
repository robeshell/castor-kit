/**
 * SSRF protection for scheduled-task request URLs (validateRequestUrl)
 *
 * - Only http/https; the target must not be loopback / private / link-local (incl. cloud metadata 169.254.169.254) / reserved
 * - URL splitting follows Python `urllib.parse.urlsplit` (3.13) rules rather than WHATWG URL, keeping hostname / port /
 *   error messages stable; splitting errors under urlsplit rules (Invalid IPv6 URL etc.) throw PyUncaughtError, mapped to 500 by the service
 * - Every resolved address of a hostname is checked (a single internal IP means rejection)
 * - When a domain resolves into a blocked range the message includes the resolution (`不允许访问内网地址（localhost 解析为 127.0.0.1）`); IP literals get a fixed message
 * - IPv4-mapped IPv6 (`::ffff:127.0.0.1`) is judged by its embedded IPv4, so it isn't let through as plain IPv6
 * - Additionally blocks `::/128` (the unspecified address, equivalent to localhost on most systems)
 * - At execution time (http.ts) the actually-connected IP is re-checked with the same rules on connect, defeating DNS rebinding and redirect bypasses
 */

import dns from 'node:dns'
import net from 'node:net'
import { pyStr, pyTruthy } from '@/common/py'
import { PyUncaughtError, ScheduledTaskSchemaError } from './errors'
import { pyStrip } from './py-compat'

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

// ---- Subset of urllib.parse.urlsplit (Python 3.13): only scheme and netloc ----

const SCHEME_CHARS = /^[A-Za-z0-9+\-.]$/
// _WHATWG_C0_CONTROL_OR_SPACE：\x00-\x20
const C0_OR_SPACE = /^[\x00-\x20]+/

export interface SplitUrl {
  scheme: string
  netloc: string
}

export function pyUrlSplit(input: string): SplitUrl {
  let url = input.replace(C0_OR_SPACE, '').replace(/[\t\r\n]/g, '')
  let scheme = ''
  let netloc = ''

  const i = url.indexOf(':')
  if (i > 0 && /^[A-Za-z]$/.test(url[0]!)) {
    if ([...url.slice(0, i)].every((c) => SCHEME_CHARS.test(c))) {
      scheme = url.slice(0, i).toLowerCase()
      url = url.slice(i + 1)
    }
  }

  if (url.startsWith('//')) {
    let delim = url.length
    for (const c of '/?#') {
      const w = url.indexOf(c, 2)
      if (w >= 0) delim = Math.min(delim, w)
    }
    netloc = url.slice(2, delim)
    const hasOpen = netloc.includes('[')
    const hasClose = netloc.includes(']')
    if ((hasOpen && !hasClose) || (hasClose && !hasOpen)) throw new PyUncaughtError('Invalid IPv6 URL')
    if (hasOpen && hasClose) checkBracketedNetloc(netloc)
  }

  checkNetloc(netloc)
  return { scheme, netloc }
}

function rpartitionAt(netloc: string): string {
  const at = netloc.lastIndexOf('@')
  return at >= 0 ? netloc.slice(at + 1) : netloc
}

function checkBracketedNetloc(netloc: string): void {
  const hostAndPort = rpartitionAt(netloc)
  const open = hostAndPort.indexOf('[')
  let hostname: string
  if (open >= 0) {
    if (open > 0) throw new PyUncaughtError('Invalid IPv6 URL')
    const bracketed = hostAndPort.slice(open + 1)
    const close = bracketed.indexOf(']')
    hostname = close >= 0 ? bracketed.slice(0, close) : bracketed
    const port = close >= 0 ? bracketed.slice(close + 1) : ''
    if (port && !port.startsWith(':')) throw new PyUncaughtError('Invalid IPv6 URL')
  } else {
    const colon = hostAndPort.indexOf(':')
    hostname = colon >= 0 ? hostAndPort.slice(0, colon) : hostAndPort
  }
  checkBracketedHost(hostname)
}

function checkBracketedHost(hostname: string): void {
  if (hostname.startsWith('v')) {
    if (!/^v[a-fA-F0-9]+\..+$/s.test(hostname)) throw new PyUncaughtError('IPvFuture address is invalid')
    return
  }
  const family = net.isIP(hostname)
  if (family === 0) throw new PyUncaughtError(`'${hostname}' does not appear to be an IPv4 or IPv6 address`)
  if (family === 4) throw new PyUncaughtError('An IPv4 address cannot be in brackets')
}

/** _checknetloc: a non-ASCII netloc containing / ? # @ : after NFKC normalization is invalid */
function checkNetloc(netloc: string): void {
  if (!netloc || /^[\x00-\x7f]*$/.test(netloc)) return
  const n = netloc.replace(/[@:#?]/g, '')
  const normalized = n.normalize('NFKC')
  if (n === normalized) return
  for (const c of '/?#@:') {
    if (normalized.includes(c)) {
      throw new PyUncaughtError(`netloc '${netloc}' contains invalid characters under NFKC normalization`)
    }
  }
}

/** SplitResult._hostinfo → (raw hostname, raw port | null) */
function hostInfo(netloc: string): { hostname: string; port: string | null } {
  const hostinfo = rpartitionAt(netloc)
  const open = hostinfo.indexOf('[')
  let hostname: string
  let port: string
  if (open >= 0) {
    const bracketed = hostinfo.slice(open + 1)
    const close = bracketed.indexOf(']')
    hostname = close >= 0 ? bracketed.slice(0, close) : bracketed
    const rest = close >= 0 ? bracketed.slice(close + 1) : ''
    const colon = rest.indexOf(':')
    port = colon >= 0 ? rest.slice(colon + 1) : ''
  } else {
    const colon = hostinfo.indexOf(':')
    hostname = colon >= 0 ? hostinfo.slice(0, colon) : hostinfo
    port = colon >= 0 ? hostinfo.slice(colon + 1) : ''
  }
  return { hostname, port: port || null }
}

/** SplitResult.hostname: empty → null; the part before the zone is lowercased */
function pyHostname(netloc: string): string | null {
  const { hostname } = hostInfo(netloc)
  if (!hostname) return null
  const pct = hostname.indexOf('%')
  return pct >= 0 ? hostname.slice(0, pct).toLowerCase() + hostname.slice(pct) : hostname.toLowerCase()
}

/** SplitResult.port: non-ASCII digits or out of range raise ValueError (represented here by a non-null sentinel) */
function pyPort(netloc: string): number | null | 'invalid' {
  const { port } = hostInfo(netloc)
  if (port === null) return null
  if (!/^[0-9]+$/.test(port)) return 'invalid'
  const value = Number(port)
  if (!(value >= 0 && value <= 65535)) return 'invalid'
  return value
}

export type HostLookup = (hostname: string) => Promise<string[]>

/** Equivalent to `socket.getaddrinfo(hostname, None)`, returning all addresses */
export const defaultLookup: HostLookup = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true })
  return results.map((r) => r.address)
}

export interface ValidateOptions {
  lookup?: HostLookup
}

/**
 * Validate a scheduled-task target URL: http/https scheme + target IP not in an internal/reserved range.
 * Returns the stripped URL text; throws ScheduledTaskSchemaError when invalid.
 */
export async function validateRequestUrl(raw: unknown, { lookup = defaultLookup }: ValidateOptions = {}): Promise<string> {
  const text = pyStrip(pyTruthy(raw) ? pyStr(raw) : '')
  if (!text) throw new ScheduledTaskSchemaError('请求地址不能为空')

  const parsed = pyUrlSplit(text)
  if (parsed.scheme !== 'http' && parsed.scheme !== 'https') {
    throw new ScheduledTaskSchemaError('请求地址仅支持 http/https 协议')
  }
  const hostname = pyHostname(parsed.netloc)
  if (!hostname) throw new ScheduledTaskSchemaError('请求地址缺少主机名')

  const port = pyPort(parsed.netloc)
  if (port === 'invalid') throw new ScheduledTaskSchemaError('请求地址端口不合法')
  if (port !== null && !(port > 0 && port <= 65535)) throw new ScheduledTaskSchemaError('请求地址端口不合法')

  // IP literal: check directly
  if (net.isIP(bareIpForParse(hostname)) !== 0) {
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

/** ipaddress.ip_address accepts IPv6 with a zone (zone non-empty and without %) */
function bareIpForParse(hostname: string): string {
  const pct = hostname.indexOf('%')
  if (pct < 0) return hostname
  const zone = hostname.slice(pct + 1)
  const base = hostname.slice(0, pct)
  if (!zone || zone.includes('%') || net.isIP(base) !== 6) return ''
  return base
}
