/**
 * src/shared/api/openapi.d.ts must match docs/apifox-full.openapi.json: `pnpm openapi:generate` regenerates both.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { generate, OUT } from '../scripts/api-types.mjs'

describe('API types', () => {
  it('openapi.d.ts is generated from the current OpenAPI doc', async () => {
    const current = readFileSync(OUT, 'utf8')
    expect(current === (await generate()), 'src/shared/api/openapi.d.ts is out of date: run pnpm openapi:generate').toBe(true)
  })
})
