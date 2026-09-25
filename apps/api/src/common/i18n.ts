/**
 * Response message translation.
 *
 * The frontend sends `Accept-Language` (zh-CN / en-US / ja-JP). Services keep throwing Chinese messages; an
 * onSend hook translates `error`, `message` and `error_rows[].reason` in JSON responses for non-Chinese
 * requests. Untranslated text is returned as-is, so a missing entry degrades to Chinese instead of failing.
 */

import type { FastifyInstance, FastifyRequest } from 'fastify'
import { MESSAGES, PATTERNS, type TranslatedLanguage } from '@/i18n/messages'

export type Language = 'zh-CN' | TranslatedLanguage

/** First supported language in Accept-Language (q-values honoured); default zh-CN */
export function pickLanguage(header: string | string[] | undefined): Language {
  const text = Array.isArray(header) ? header.join(',') : (header ?? '')
  const ranked = text
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { tag: tag.toLowerCase(), q: q ? Number(q.slice(2)) : 1, index }
    })
    .filter((item) => item.tag && item.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)
  for (const { tag } of ranked) {
    if (tag.startsWith('zh')) return 'zh-CN'
    if (tag.startsWith('en')) return 'en-US'
    if (tag.startsWith('ja')) return 'ja-JP'
  }
  return 'zh-CN'
}

export function requestLanguage(request: FastifyRequest): Language {
  return pickLanguage(request.headers['accept-language'])
}

/** Translate one message; unknown text is returned unchanged */
export function translateMessage(text: string, lang: Language): string {
  if (lang === 'zh-CN' || !text) return text
  const exact = MESSAGES[text]
  if (exact) return exact[lang]
  for (const pattern of PATTERNS) {
    if (pattern.re.test(text)) return text.replace(pattern.re, pattern[lang])
  }
  return text
}

function translateBody(body: Record<string, unknown>, lang: Language): boolean {
  let changed = false
  for (const key of ['error', 'message'] as const) {
    const value = body[key]
    if (typeof value === 'string') {
      const next = translateMessage(value, lang)
      if (next !== value) {
        body[key] = next
        changed = true
      }
    }
  }
  if (Array.isArray(body.error_rows)) {
    for (const row of body.error_rows as Array<Record<string, unknown>>) {
      if (row && typeof row.reason === 'string') {
        const next = translateMessage(row.reason, lang)
        if (next !== row.reason) {
          row.reason = next
          changed = true
        }
      }
    }
  }
  return changed
}

export function registerResponseTranslation(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    const lang = requestLanguage(request)
    if (lang === 'zh-CN' || typeof payload !== 'string') return payload
    const contentType = String(reply.getHeader('content-type') ?? '')
    if (!contentType.includes('application/json')) return payload
    if (!payload.includes('"error"') && !payload.includes('"message"')) return payload
    let body: unknown
    try {
      body = JSON.parse(payload)
    } catch {
      return payload
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return payload
    return translateBody(body as Record<string, unknown>, lang) ? JSON.stringify(body) : payload
  })
}
