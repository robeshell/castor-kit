import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** MarkdownView (MarkdownViewProps in shared/components/markdown/MarkdownView.tsx) */
export const MARKDOWN_VIEW_PROPS: readonly PropDoc[] = [
  { name: 'children', type: 'string | null', description: 'Markdown 源码；为空时什么也不渲染' },
  { name: 'className', type: 'string', description: '外层容器的 class，可以调整字号和行高' },
]
