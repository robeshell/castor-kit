import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TagInput from '@/shared/components/TagInput'

export default function TagInputDemo() {
  const { t } = useTranslation()
  // Enter or a comma adds a tag (duplicates are dropped), Backspace in the empty box removes the last one, blurring adds what's typed
  const [tags, setTags] = useState<string[]>(['billing', 'urgent'])
  const [hosts, setHosts] = useState<string[]>([])

  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('标签')}</p>
        <TagInput value={tags} onChange={setTags} />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(tags)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('允许的域名')}</p>
        {/* "a.test, b.test" then Enter adds both: the text is split on commas */}
        <TagInput
          value={hosts}
          // Normalize in onChange: the component only trims
          onChange={(next) => setHosts(Array.from(new Set(next.map((host) => host.toLowerCase()))))}
          placeholder="例如 example.com，回车添加"
        />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(hosts)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('禁用')}</p>
        <TagInput value={['read-only']} disabled />
      </div>
    </div>
  )
}
