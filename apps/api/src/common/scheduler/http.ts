/**
 * Scheduled-task HTTP execution (behaves like Python requests' `requests.request(...)`)
 *
 * With connection-level SSRF protection:
 * - A fresh undici Agent per execution with a custom connect: IP literals are checked up front; hostnames go through a custom lookup,
 *   every resolved address is re-checked and exactly those addresses are handed to the socket (pinned), so DNS rebinding can't swap addresses between check and connect
 * - Redirects are followed manually and every hop goes through the same Agent, so redirects to internal addresses are blocked too
 * - Timeout via AbortSignal.timeout (1–120 s, covering the whole execution including redirects)
 *
 * Matches requests on: at most 30 redirects, method rewriting and body dropping for 301/302/303, stripping Authorization across hosts,
 * and decoding response text per requests' `response.text` rules (charset / text/* → latin-1 / json → utf-8).
 */

import dns from 'node:dns'
import net from 'node:net'
import { Agent, buildConnector, request } from 'undici'
import { BLOCKED_ADDRESS_MESSAGE, blockedHostMessage, isBlockedIp } from './ssrf'

export interface HttpRequestSpec {
  method: string
  url: string
  /** Keys and values already converted to strings */
  headers: Record<string, string>
  /** json: requests' `json=` (adds Content-Type automatically); data: `data=str` (UTF-8, no Content-Type) */
  body: { kind: 'json' | 'data'; text: string } | null
  timeoutSeconds: number
}

export interface HttpResponse {
  status: number
  /** Response text decoded per requests' rules (reads at most MAX_BODY_BYTES, enough to take the first 2000 characters) */
  text: string
}

export type HttpExecutor = (spec: HttpRequestSpec) => Promise<HttpResponse>

const MAX_REDIRECTS = 30
const MAX_BODY_BYTES = 64 * 1024
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

/** Resolve and re-check: reject if any address is in a blocked range; on success hand exactly these results to the socket */
const guardedLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, '', 0)
    const list = addresses as dns.LookupAddress[]
    if (list.length === 0) return callback(Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' }), '', 0)
    const blocked = list.find((a) => isBlockedIp(a.address))
    if (blocked) return callback(new Error(blockedHostMessage(hostname, blocked.address)), '', 0)
    if ((options as dns.LookupOptions).all) {
      ;(callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list)
    } else {
      callback(null, list[0]!.address, list[0]!.family)
    }
  })
}

/** One dedicated Agent per execution (no pooled connections, so established connections are never reused across tasks) */
export function createGuardedAgent(): Agent {
  const baseConnect = buildConnector({ lookup: guardedLookup } as buildConnector.BuildOptions)
  return new Agent({
    connect: (options, callback) => {
      const host = options.hostname.replace(/^\[|\]$/g, '')
      if (net.isIP(host.split('%')[0]!) !== 0 && isBlockedIp(host)) {
        callback(new Error(BLOCKED_ADDRESS_MESSAGE), null)
        return
      }
      baseConnect(options, callback)
    },
  })
}

function headerValue(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
  const v = headers[name]
  return Array.isArray(v) ? v[0] : v
}

/** requests.utils.get_encoding_from_headers */
function encodingFromHeaders(contentType: string | undefined): string | null {
  if (!contentType) return null
  const [type = '', ...rawParams] = contentType.split(';')
  const params = new Map<string, string>()
  for (const p of rawParams) {
    const trimmed = p.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    const key = (eq >= 0 ? trimmed.slice(0, eq) : trimmed).trim().replace(/^['"]|['"]$/g, '').toLowerCase()
    const value = eq >= 0 ? trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '') : ''
    params.set(key, value)
  }
  if (params.has('charset')) return params.get('charset')!.replace(/^['"]+|['"]+$/g, '')
  const ct = type.trim()
  if (ct.includes('text')) return 'ISO-8859-1'
  if (ct.includes('application/json')) return 'utf-8'
  return null
}

/** `str(content, encoding, errors='replace')`; unknown encodings fall back to UTF-8 (requests' apparent_encoding is approximated as UTF-8) */
function decodeBody(buf: Buffer, encoding: string | null): string {
  if (buf.length === 0) return ''
  const label = (encoding ?? 'utf-8').trim().toLowerCase()
  if (['iso-8859-1', 'latin-1', 'latin1', 'iso8859-1', 'l1'].includes(label)) return buf.toString('latin1')
  try {
    return new TextDecoder(label, { fatal: false, ignoreBOM: label === 'utf-8' || label === 'utf8' }).decode(buf)
  } catch {
    return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(buf)
  }
}

async function readLimited(body: AsyncIterable<Buffer> & { destroy?: () => void }): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of body) {
    chunks.push(chunk)
    size += chunk.length
    if (size >= MAX_BODY_BYTES) break
  }
  body.destroy?.()
  return Buffer.concat(chunks).subarray(0, MAX_BODY_BYTES)
}

function defaultPort(protocol: string): string {
  return protocol === 'https:' ? '443' : protocol === 'http:' ? '80' : ''
}

/** requests.Session.should_strip_auth */
function shouldStripAuth(oldUrl: URL, newUrl: URL): boolean {
  if (oldUrl.hostname !== newUrl.hostname) return true
  const oldPort = oldUrl.port || defaultPort(oldUrl.protocol)
  const newPort = newUrl.port || defaultPort(newUrl.protocol)
  if (oldUrl.protocol === 'http:' && oldPort === '80' && newUrl.protocol === 'https:' && newPort === '443') return false
  return oldPort !== newPort || oldUrl.protocol !== newUrl.protocol
}

/** Default executor: undici request with connection-level SSRF re-checks */
export const executeHttpRequest: HttpExecutor = async (spec) => {
  const agent = createGuardedAgent()
  const signal = AbortSignal.timeout(spec.timeoutSeconds * 1000)
  try {
    let method = spec.method
    let url = new URL(spec.url)
    const headers: Record<string, string> = { accept: '*/*', 'user-agent': 'castor-kit-scheduler', ...spec.headers }
    const hasHeader = (name: string) => Object.keys(headers).some((k) => k.toLowerCase() === name)
    const dropHeader = (name: string) => {
      for (const k of Object.keys(headers)) if (k.toLowerCase() === name) delete headers[k]
    }
    let body: string | undefined
    if (spec.body) {
      body = spec.body.text
      if (spec.body.kind === 'json' && !hasHeader('content-type')) headers['Content-Type'] = 'application/json'
    }

    for (let hop = 0; ; hop += 1) {
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error(`No connection adapters were found for '${url.href}'`)
      }
      const res = await request(url, { method: method as 'GET', headers, body, dispatcher: agent, signal })
      const location = headerValue(res.headers, 'location')
      if (!REDIRECT_STATUSES.has(res.statusCode) || !location) {
        const buf = await readLimited(res.body as unknown as AsyncIterable<Buffer> & { destroy?: () => void })
        return { status: res.statusCode, text: decodeBody(buf, encodingFromHeaders(headerValue(res.headers, 'content-type'))) }
      }

      await res.body.dump().catch(() => undefined)
      if (hop + 1 > MAX_REDIRECTS) throw new Error(`Exceeded ${MAX_REDIRECTS} redirects.`)

      const target = new URL(Buffer.from(location, 'latin1').toString('utf8'), url)
      if ((res.statusCode === 303 || res.statusCode === 302) && method !== 'HEAD') method = 'GET'
      if (res.statusCode === 301 && method === 'POST') method = 'GET'
      if (res.statusCode !== 307 && res.statusCode !== 308) {
        body = undefined
        for (const name of ['content-length', 'content-type', 'transfer-encoding']) dropHeader(name)
      }
      if (shouldStripAuth(url, target)) dropHeader('authorization')
      url = target
    }
  } catch (err) {
    if (signal.aborted) throw new Error(`Request timed out. (timeout=${spec.timeoutSeconds})`)
    throw err
  } finally {
    await agent.destroy().catch(() => undefined)
  }
}
