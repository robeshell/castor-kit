/**
 * 定时任务请求地址防 SSRF（validateRequestUrl）
 *
 * - 只允许 http/https；目标不能是环回 / 私网 / 链路本地（含云元数据 169.254.169.254）/ 保留地址
 * - URL 拆分按 Python `urllib.parse.urlsplit`（3.13）的规则实现，而不是 WHATWG URL，保证 hostname / port /
 *   错误文案稳定；urlsplit 规则下的拆分错误（Invalid IPv6 URL 等）抛 PyUncaughtError，由 service 转 500
 * - 主机名解析后全部结果都要校验（存在一个内网 IP 即拒绝）
 * - 域名解析到禁止网段时文案附带解析结果（`不允许访问内网地址（localhost 解析为 127.0.0.1）`）；IP 直连是固定文案
 * - IPv4 映射的 IPv6（`::ffff:127.0.0.1`）按其内嵌 IPv4 判定，避免被当成普通 IPv6 放行
 * - 额外拦截 `::/128`（未指定地址，多数系统上等同本机）
 * - 执行阶段（http.ts）在建立连接时再按同一规则复检实际连接的 IP，防 DNS rebinding 与重定向绕过
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
  // 加固：未指定地址
  ['::', 128, 'ipv6'],
]

const blockList = new net.BlockList()
for (const [address, prefix, family] of BLOCKED_NETWORKS) blockList.addSubnet(address, prefix, family)

export const BLOCKED_ADDRESS_MESSAGE = '不允许访问内网地址'

/** 域名解析到禁止网段时的文案：`不允许访问内网地址（localhost 解析为 127.0.0.1）` */
export function blockedHostMessage(hostname: string, address: string): string {
  return `${BLOCKED_ADDRESS_MESSAGE}（${hostname} 解析为 ${address}）`
}

/** 去掉 IPv6 zone（`fe80::1%en0`）与方括号 */
function bareIp(ip: string): string {
  let text = ip
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1)
  const zone = text.indexOf('%')
  return zone >= 0 ? text.slice(0, zone) : text
}

/**
 * IP 是否落在禁止网段。非 IP 文本返回 false（调用方先用 net.isIP 判断）。
 * net.BlockList 对 IPv4 映射的 IPv6 地址会按内嵌 IPv4 匹配 IPv4 规则。
 */
export function isBlockedIp(ip: string): boolean {
  const bare = bareIp(ip)
  const family = net.isIP(bare)
  if (family === 0) return false
  return blockList.check(bare, family === 4 ? 'ipv4' : 'ipv6')
}

// ---- urllib.parse.urlsplit（Python 3.13）子集：只算 scheme 与 netloc ----

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

/** _checknetloc：NFKC 归一化后出现 / ? # @ : 的非 ASCII netloc 视为非法 */
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

/** SplitResult._hostinfo → (hostname 原文, port 原文|null) */
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

/** SplitResult.hostname：空 → null；zone 之前的部分小写 */
function pyHostname(netloc: string): string | null {
  const { hostname } = hostInfo(netloc)
  if (!hostname) return null
  const pct = hostname.indexOf('%')
  return pct >= 0 ? hostname.slice(0, pct).toLowerCase() + hostname.slice(pct) : hostname.toLowerCase()
}

/** SplitResult.port：非 ASCII 数字或越界抛 ValueError（这里用 null 以外的哨兵表示） */
function pyPort(netloc: string): number | null | 'invalid' {
  const { port } = hostInfo(netloc)
  if (port === null) return null
  if (!/^[0-9]+$/.test(port)) return 'invalid'
  const value = Number(port)
  if (!(value >= 0 && value <= 65535)) return 'invalid'
  return value
}

export type HostLookup = (hostname: string) => Promise<string[]>

/** 等价 `socket.getaddrinfo(hostname, None)` 取全部地址 */
export const defaultLookup: HostLookup = async (hostname) => {
  const results = await dns.promises.lookup(hostname, { all: true, verbatim: true })
  return results.map((r) => r.address)
}

export interface ValidateOptions {
  lookup?: HostLookup
}

/**
 * 校验定时任务目标 URL：http/https 协议 + 目标 IP 不在内网/保留网段。
 * 返回 strip 后的 URL 原文；不合法时抛 ScheduledTaskSchemaError。
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

  // 直连 IP：直接判定
  if (net.isIP(bareIpForParse(hostname)) !== 0) {
    if (isBlockedIp(hostname)) throw new ScheduledTaskSchemaError(BLOCKED_ADDRESS_MESSAGE)
    return text
  }

  // 主机名：解析并校验全部结果（存在一个内网 IP 即拒绝）
  let addresses: string[]
  try {
    addresses = await lookup(hostname)
  } catch {
    throw new ScheduledTaskSchemaError('请求地址无法解析')
  }
  for (const address of addresses) {
    // 带上解析结果：本机代理的 fake-ip 模式（198.18.0.0/15）会让任何域名都被判为内网，附上 IP 才看得出原因
    if (isBlockedIp(address)) throw new ScheduledTaskSchemaError(blockedHostMessage(hostname, address))
  }
  return text
}

/** ipaddress.ip_address 接受带 zone 的 IPv6（zone 非空且不含 %） */
function bareIpForParse(hostname: string): string {
  const pct = hostname.indexOf('%')
  if (pct < 0) return hostname
  const zone = hostname.slice(pct + 1)
  const base = hostname.slice(0, pct)
  if (!zone || zone.includes('%') || net.isIP(base) !== 6) return ''
  return base
}
