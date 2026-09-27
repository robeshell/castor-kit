import { useDeferredValue, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Textarea } from '@/components/ui/textarea'
import MarkdownView from '@/shared/components/markdown/MarkdownView'

// Sample content is data, not UI copy: it isn't translated
const INITIAL = `# Release notes

Version **2.4** ships a faster search and a *simpler* settings page.

## What changed

- Search results load in half the time
- Settings are grouped by topic
  - Profile, security and notifications
- Exports keep the column order you chose

1. Update the app
2. Sign in again
3. Check the new settings

> Existing saved searches keep working.

Read the [upgrade guide](https://example.com/upgrade) or run \`app --version\`.

---

Questions? Reply to this email.
`

export default function LiveEditor() {
  const { t } = useTranslation()
  const [source, setSource] = useState(INITIAL)
  // Deferred: typing stays responsive while long documents re-render the preview
  const preview = useDeferredValue(source)

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Textarea
        aria-label={t('Markdown 源码')}
        value={source}
        onChange={(e) => setSource(e.target.value)}
        spellCheck={false}
        className="min-h-80 resize-y font-mono text-xs leading-relaxed"
      />
      <div className="min-w-0 rounded-lg border p-4">
        {/* The source goes in as children (a string); null / '' renders nothing */}
        <MarkdownView>{preview}</MarkdownView>
      </div>
    </div>
  )
}
