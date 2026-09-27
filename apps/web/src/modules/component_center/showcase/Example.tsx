import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Code2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'
import CodeBlock from '@/modules/component_center/showcase/CodeBlock'

export interface ExampleProps {
  /** Chinese source text (translated here) */
  title: string
  /** One or two sentences: what the example shows and when to use it (translated here) */
  description?: string
  /** The example file's own source, imported with `?raw` */
  source: string
  /** The live example (the same file, imported as a component) */
  children: ReactNode
  /** Extra classes for the preview area (e.g. a fixed height) */
  previewClassName?: string
}

/**
 * One example: title, description, live preview and, behind the `代码` toggle, the exact source of the example file.
 *   import BasicTable from '@/modules/component_center/pages/components/data_table_page/examples/BasicTable'
 *   import basicTableSource from '@/modules/component_center/pages/components/data_table_page/examples/BasicTable.tsx?raw'
 *   <Example title="基础表格" description="…" source={basicTableSource}><BasicTable /></Example>
 */
export default function Example({ title, description, source, children, previewClassName }: ExampleProps) {
  const { t } = useTranslation()
  const tx = useTx()
  const [showCode, setShowCode] = useState(false)
  return (
    <section className="surface-card overflow-hidden">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold">{tx(title)}</h3>
          {description ? <p className="text-muted-foreground text-[13px]">{tx(description)}</p> : null}
        </div>
        <Button
          variant={showCode ? 'secondary' : 'ghost'}
          size="sm"
          className="shrink-0"
          aria-pressed={showCode}
          onClick={() => setShowCode((v) => !v)}
        >
          <Code2 />
          {t('代码')}
        </Button>
      </header>
      <div className={cn('min-w-0 p-4', previewClassName)}>{children}</div>
      {showCode ? <CodeBlock code={source} className="border-t" /> : null}
    </section>
  )
}
