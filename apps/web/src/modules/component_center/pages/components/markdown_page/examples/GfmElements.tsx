import MarkdownView from '@/shared/components/markdown/MarkdownView'

// GitHub Flavored Markdown (remark-gfm): tables, task lists, strikethrough and bare links
const DOC = `### Sprint checklist

| Task | Owner | Status |
| :--- | :---: | ---: |
| Search API | Avery | Done |
| Settings page | Blake | In review |
| Export fix | Casey | ~~Blocked~~ Ready |

- [x] Write the migration
- [x] Update the API docs
- [ ] Announce the release

Tracking board: https://example.com/board

> **Note**
> Wide tables scroll inside their own box instead of stretching the page.
`

export default function GfmElements() {
  return <MarkdownView>{DOC}</MarkdownView>
}
