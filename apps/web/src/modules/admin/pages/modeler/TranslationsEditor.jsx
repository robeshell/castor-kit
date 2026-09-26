import { useState } from 'react'
import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { translateTexts } from '@/modules/admin/api/modeler'
import { specTexts, titleCase } from '@/modules/admin/pages/modeler/spec'

/** English name a text falls back to when it has no translation (what the generator writes) */
function fallbackOf(spec, text) {
  if (text === spec.title) return titleCase(spec.name)
  for (const f of spec.fields) {
    if (f.label.trim() === text) return titleCase(f.name)
    const option = f.options.find((o) => o.label.trim() === text)
    if (option) return titleCase(option.value)
  }
  return ''
}

/**
 * English and Japanese for the module's Chinese texts (title, labels, option names), written to the generated
 * page's locales and the menu names. Empty ones fall back to the field / module name; AI can fill them in.
 */
export default function TranslationsEditor({ spec, aiConfigured, onChange }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const texts = specTexts(spec)

  const set = (lang, text, value) => onChange({ ...spec.i18n, [lang]: { ...spec.i18n[lang], [text]: value } })

  const fill = async () => {
    const missing = texts.filter((text) => !spec.i18n['en-US'][text] || !spec.i18n['ja-JP'][text])
    if (missing.length === 0) return
    setBusy(true)
    try {
      const res = await translateTexts(missing)
      const next = { 'en-US': { ...spec.i18n['en-US'] }, 'ja-JP': { ...spec.i18n['ja-JP'] } }
      for (const item of res.items) {
        if (!next['en-US'][item.zh]) next['en-US'][item.zh] = item.en
        if (!next['ja-JP'][item.zh]) next['ja-JP'][item.zh] = item.ja
      }
      onChange(next)
    } catch (err) {
      toast.apiError(err, '翻译失败')
    } finally {
      setBusy(false)
    }
  }

  if (texts.length === 0) return <p className="text-muted-foreground text-[13px]">{t('填写标题和字段标签后在这里翻译')}</p>

  return (
    <div className="space-y-2">
      {aiConfigured ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={fill}>
          {busy ? <Spinner /> : <Languages />}
          {t('AI 补全空白翻译')}
        </Button>
      ) : null}
      <div className="text-muted-foreground grid grid-cols-3 gap-2 px-1 text-xs">
        <span>{t('中文')}</span>
        <span>{t('英文')}</span>
        <span>{t('日文')}</span>
      </div>
      {texts.map((text) => {
        const fallback = fallbackOf(spec, text)
        return (
          <div key={text} className="grid grid-cols-3 items-center gap-2">
            <span className="truncate text-[13px]" title={text}>
              {text}
            </span>
            <Input className="h-8 text-[13px]" value={spec.i18n['en-US'][text] ?? ''} placeholder={fallback} onChange={(e) => set('en-US', text, e.target.value)} aria-label={`${t('英文')}: ${text}`} />
            <Input className="h-8 text-[13px]" value={spec.i18n['ja-JP'][text] ?? ''} placeholder={fallback} onChange={(e) => set('ja-JP', text, e.target.value)} aria-label={`${t('日文')}: ${text}`} />
          </div>
        )
      })}
    </div>
  )
}
