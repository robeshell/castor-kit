/**
 * AI model access (Vercel AI SDK): every feature that calls a model — AI chat, AI data query, the settings test
 * button — gets its model here, from the current settings (System settings → AI).
 *
 * - Providers: `openai-compatible` (any /chat/completions API: DeepSeek, Qwen, Gemini's compatible endpoint, Ollama …;
 *   needs the API URL), or the native `openai` / `anthropic` / `google` providers (API URL optional, e.g. a proxy)
 * - Requests go through `createOutboundAgent`, so the address actually connected to is checked again (DNS rebinding);
 *   an internal address is allowed only when the operator permits it (see callers)
 * - Callers pass `maxRetries: 0` (AI_CALL_DEFAULTS): a retry would spend the demo quota again and hide upstream errors
 */

import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogle } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { APICallError, type LanguageModel } from 'ai'
import { type Agent, fetch as undiciFetch } from 'undici'
import { createOutboundAgent } from '@/common/outbound'
import type { Settings } from '@/common/settings'

export type AiSettings = Settings['ai']

/** Shared call options: no automatic retries (see the header) */
export const AI_CALL_DEFAULTS = { maxRetries: 0 } as const

/** Enough to make a call: a key, a model name, and the API URL for OpenAI-compatible services */
export function aiConfigured(ai: AiSettings): boolean {
  return Boolean(ai.apiKey && ai.model && (ai.provider !== 'openai-compatible' || ai.apiBase))
}

/** A fetch for the provider SDKs that connects through the given undici agent */
function fetchVia(agent: Agent): typeof globalThis.fetch {
  return ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
    undiciFetch(input, { ...init, dispatcher: agent })) as unknown as typeof globalThis.fetch
}

/** The language model for the current settings; `agent` carries the outbound checks and timeouts */
export function languageModelFor(ai: AiSettings, agent: Agent): LanguageModel {
  const fetch = fetchVia(agent)
  const baseURL = ai.apiBase || undefined
  switch (ai.provider) {
    case 'openai':
      return createOpenAI({ apiKey: ai.apiKey, baseURL, fetch }).chat(ai.model)
    case 'anthropic':
      return createAnthropic({ apiKey: ai.apiKey, baseURL, fetch })(ai.model)
    case 'google':
      return createGoogle({ apiKey: ai.apiKey, baseURL, fetch })(ai.model)
    default:
      return createOpenAICompatible({ name: 'castor', apiKey: ai.apiKey, baseURL: ai.apiBase, fetch }).chatModel(ai.model)
  }
}

/** An agent for model calls: `timeoutMs` bounds connecting and waiting for headers / the next chunk */
export function createAiAgent(allowPrivate: boolean, timeoutMs: number): Agent {
  return createOutboundAgent(allowPrivate, timeoutMs)
}

/**
 * HTTP status of an upstream error response (401 key, 404 model, 429 quota …), or null for network / other errors
 * (including a 2xx whose body failed while being read)
 */
export function upstreamStatusOf(err: unknown): number | null {
  for (let cur: unknown = err, depth = 0; cur && depth < 5; depth++) {
    if (APICallError.isInstance(cur)) return cur.statusCode && (cur.statusCode < 200 || cur.statusCode >= 300) ? cur.statusCode : null
    cur = (cur as { cause?: unknown }).cause ?? (cur as { lastError?: unknown }).lastError
  }
  return null
}

const TIMEOUT_CODES = new Set(['UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT'])

/** Whether the error is a connect / response timeout (undici codes, possibly wrapped by the SDK) */
export function isTimeoutError(err: unknown): boolean {
  for (let cur: unknown = err, depth = 0; cur && depth < 6; depth++) {
    const code = (cur as { code?: unknown }).code
    if (typeof code === 'string' && TIMEOUT_CODES.has(code)) return true
    if ((cur as { name?: unknown }).name === 'TimeoutError') return true
    cur = (cur as { cause?: unknown }).cause ?? (cur as { lastError?: unknown }).lastError
  }
  return false
}
