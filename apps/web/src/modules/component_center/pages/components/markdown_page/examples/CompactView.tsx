import { useTranslation } from 'react-i18next'
import UserAvatar from '@/shared/components/UserAvatar'
import MarkdownView from '@/shared/components/markdown/MarkdownView'

interface Comment {
  id: number
  author: string
  body: string
}

// Comments as users wrote them: Markdown from the API, rendered as is
const COMMENTS: Comment[] = [
  { id: 1, author: 'Avery Chen', body: 'Looks good. Two things:\n\n1. Rename `per_page` to `perPage` in the client\n2. Add a test for the **empty** list' },
  { id: 2, author: 'Blake Ito', body: 'Done in the latest commit, see the [diff](https://example.com/diff).' },
]

export default function CompactView() {
  const { t } = useTranslation()
  return (
    <ul className="max-w-lg space-y-3" aria-label={t('评论')}>
      {COMMENTS.map((c) => (
        <li key={c.id} className="flex gap-3">
          <UserAvatar name={c.author} className="mt-0.5 size-7" />
          <div className="bg-muted/50 min-w-0 flex-1 rounded-lg px-3 py-2">
            <div className="text-xs font-medium">{c.author}</div>
            {/* className adjusts the typography, e.g. a smaller size inside a comment bubble */}
            <MarkdownView className="text-[13px] leading-relaxed">{c.body}</MarkdownView>
          </div>
        </li>
      ))}
    </ul>
  )
}
