import { useTx } from '@/i18n'
import DataTable, { type DataTableColumn } from '@/shared/components/DataTable'

/** One documented prop; hand-written, so keep it in step with the component's exported Props interface */
export interface PropDoc {
  name: string
  /** TypeScript type as the reader writes it (shortened where the real one is generic) */
  type: string
  /** Default value as code; omit when there is none */
  default?: string
  /** Chinese source text (translated here) */
  description: string
}

export interface PropsTableProps {
  /** Component or type name, shown as code (not translated) */
  title: string
  items: readonly PropDoc[]
}

/** Key props of a component: prop, type, default, description */
export default function PropsTable({ title, items }: PropsTableProps) {
  const tx = useTx()
  const columns: DataTableColumn<PropDoc>[] = [
    { key: 'name', title: '属性', dataIndex: 'name', width: 150, render: (name) => <code className="font-mono text-xs font-medium">{name}</code> },
    {
      key: 'type',
      title: '类型',
      dataIndex: 'type',
      width: 190,
      render: (type) => <code className="text-muted-foreground font-mono text-xs break-words whitespace-normal">{type}</code>,
    },
    {
      key: 'default',
      title: '默认值',
      dataIndex: 'default',
      width: 90,
      render: (value) => (value ? <code className="font-mono text-xs">{value}</code> : null),
    },
    { key: 'description', title: '描述', dataIndex: 'description', render: (text) => <span className="whitespace-normal">{tx(text)}</span> },
  ]
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-sm font-semibold">{title}</h3>
      <DataTable columns={columns} data={items} rowKey="name" dense minWidth={600} />
    </div>
  )
}
