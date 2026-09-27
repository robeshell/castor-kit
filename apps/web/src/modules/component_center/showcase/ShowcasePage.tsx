import type { ReactNode } from 'react'
import { useTx } from '@/i18n'
import CodeBlock from '@/modules/component_center/showcase/CodeBlock'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'

export interface ShowcasePageProps {
  /** Page title, the menu name (Chinese source text, translated here) */
  title: string
  /** What the components are for and when to reach for them (translated here) */
  intro: string
  /** The import statements a page needs, shown as copyable code */
  imports: string
  /** ShowcaseSection blocks: examples first, then props */
  children: ReactNode
}

/**
 * Layout of a Components gallery page:
 *   <ShowcasePage title="数据表格" intro="…" imports={IMPORTS}>
 *     <ShowcaseSection title="示例"><Example …>…</Example></ShowcaseSection>
 *     <ShowcaseSection title="属性"><PropsTable title="DataTable" items={DATA_TABLE_PROPS} /></ShowcaseSection>
 *   </ShowcasePage>
 */
export default function ShowcasePage({ title, intro, imports, children }: ShowcasePageProps) {
  const tx = useTx()
  return (
    <div>
      <PageHeader title={title} />
      <div className="space-y-8">
        <Panel title="用法" padded={false}>
          <p className="text-muted-foreground px-5 pb-4 text-[13px] leading-relaxed">{tx(intro)}</p>
          <CodeBlock code={imports} className="border-t" />
        </Panel>
        {children}
      </div>
    </div>
  )
}

export interface ShowcaseSectionProps {
  /** Chinese source text (translated here) */
  title: string
  description?: string
  children: ReactNode
}

/** A titled group of examples or props tables */
export function ShowcaseSection({ title, description, children }: ShowcaseSectionProps) {
  const tx = useTx()
  return (
    <section className="space-y-3">
      <div className="space-y-0.5">
        <h2 className="text-base font-semibold tracking-tight">{tx(title)}</h2>
        {description ? <p className="text-muted-foreground text-[13px]">{tx(description)}</p> : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}
