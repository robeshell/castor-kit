import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SearchInput } from '@/shared/components/Filters'

const ARTICLES: string[] = [
  'Getting started with the API',
  'Rotating API tokens safely',
  'Exporting reports to CSV',
  'Inviting teammates',
  'Setting up two-factor authentication',
]

export default function SearchBox() {
  const { t } = useTranslation()
  // The box holds what is typed; the list uses the keyword applied on Enter (or on clearing)
  const [keyword, setKeyword] = useState('')
  const [applied, setApplied] = useState('')
  const results = ARTICLES.filter((title) => title.toLowerCase().includes(applied.trim().toLowerCase()))

  return (
    <div className="space-y-3">
      <SearchInput
        value={keyword}
        onChange={(next) => {
          setKeyword(next)
          // The clear button sends '': show everything again right away
          if (!next) setApplied('')
        }}
        onSubmit={() => setApplied(keyword)}
        placeholder="搜索文章标题，回车确认"
        className="sm:w-72"
      />
      <p className="text-muted-foreground text-xs">{t('共 {{count}} 条', { count: results.length })}</p>
      <ul className="space-y-1 text-sm">
        {results.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
    </div>
  )
}
