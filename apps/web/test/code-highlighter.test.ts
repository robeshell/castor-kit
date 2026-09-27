/** The Streamdown code-highlighter plugin only knows its own grammars and aliases, never inherited object keys */
import { describe, expect, it } from 'vitest'
import { code } from '@/components/ai-elements/code-highlighter'

describe('code-highlighter', () => {
  it('supports the listed languages and their aliases', () => {
    for (const language of ['typescript', 'ts', 'TSX', 'bash', 'py', 'yml']) {
      expect(code.supportsLanguage(language)).toBe(true)
    }
  })

  it('does not treat inherited object keys as languages', () => {
    for (const language of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'valueOf']) {
      expect(code.supportsLanguage(language)).toBe(false)
      expect(code.highlight({ code: 'x', language, themes: ['github-light', 'github-dark'] })).toBeNull()
    }
  })

  it('does not list inherited keys as supported languages', () => {
    expect(code.getSupportedLanguages()).not.toContain('constructor')
  })
})
