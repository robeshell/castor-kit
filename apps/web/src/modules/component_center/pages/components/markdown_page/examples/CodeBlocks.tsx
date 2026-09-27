import MarkdownView from '@/shared/components/markdown/MarkdownView'

const FENCE = '```'

// Fenced blocks get a header with the language and a copy button; the code itself is shown without highlighting
const DOC = `Install the client, then call \`createClient\` once at startup:

${FENCE}bash
pnpm add @acme/client
${FENCE}

${FENCE}ts
import { createClient } from '@acme/client'

export const client = createClient({
  baseUrl: 'https://api.example.com',
  timeoutMs: 10_000,
})
${FENCE}

A block without a language is labelled \`text\`:

${FENCE}
GET /api/health 200 12ms
${FENCE}
`

export default function CodeBlocks() {
  return <MarkdownView>{DOC}</MarkdownView>
}
