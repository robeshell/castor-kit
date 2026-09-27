/**
 * Components → Markdown: how to use MarkdownView (react-markdown + GFM with the project's typography).
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import CodeBlocks from '@/modules/component_center/pages/components/markdown_page/examples/CodeBlocks'
import codeBlocksSource from '@/modules/component_center/pages/components/markdown_page/examples/CodeBlocks.tsx?raw'
import CompactView from '@/modules/component_center/pages/components/markdown_page/examples/CompactView'
import compactViewSource from '@/modules/component_center/pages/components/markdown_page/examples/CompactView.tsx?raw'
import GfmElements from '@/modules/component_center/pages/components/markdown_page/examples/GfmElements'
import gfmElementsSource from '@/modules/component_center/pages/components/markdown_page/examples/GfmElements.tsx?raw'
import LiveEditor from '@/modules/component_center/pages/components/markdown_page/examples/LiveEditor'
import liveEditorSource from '@/modules/component_center/pages/components/markdown_page/examples/LiveEditor.tsx?raw'
import { MARKDOWN_VIEW_PROPS } from '@/modules/component_center/pages/components/markdown_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import MarkdownView from '@/shared/components/markdown/MarkdownView'`

export default function MarkdownPage() {
  return (
    <ShowcasePage
      title="Markdown"
      intro="把 Markdown 渲染成带项目排版的内容：标题、列表、引用、表格、任务列表、删除线、链接（在新标签页打开）和带复制按钮的代码块，颜色跟随亮色 / 暗色主题。源码里的 HTML 标签按原文显示、不会执行，用户输入的内容也可以放心渲染。代码块不做语法高亮，也不带编辑器：编辑时自己配一个文本框。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="源码与预览" description="左边编辑源码，右边实时预览；用 useDeferredValue 让长文档输入时不卡顿。" source={liveEditorSource}>
          <LiveEditor />
        </Example>
        <Example title="表格与任务列表" description="GFM 扩展：表格（支持列对齐，太宽时在自己的框里横向滚动）、任务列表、删除线和自动识别的链接。" source={gfmElementsSource}>
          <GfmElements />
        </Example>
        <Example title="代码块" description="代码块上方显示语言和复制按钮，没写语言时显示 text；行内代码用等宽字体。" source={codeBlocksSource}>
          <CodeBlocks />
        </Example>
        <Example title="紧凑排版" description="className 调整字号和行高，适合评论、消息这类小块内容。" source={compactViewSource}>
          <CompactView />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="MarkdownView" items={MARKDOWN_VIEW_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
