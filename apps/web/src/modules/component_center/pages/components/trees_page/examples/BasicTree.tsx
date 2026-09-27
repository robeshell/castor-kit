import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TreeView, { type TreeNode } from '@/shared/components/TreeView'

// Extend TreeNode with your own fields; children are typed as DeptNode[] at every depth, so onSelect sees them too
interface DeptNode extends TreeNode {
  key: number
  label: string
  manager: string
  headcount: number
}

const DEPARTMENTS: DeptNode[] = [
  {
    key: 1,
    label: 'Head Office',
    manager: 'Grace Lee',
    headcount: 128,
    children: [
      {
        key: 2,
        label: 'Engineering',
        manager: 'Linus Park',
        headcount: 64,
        children: [
          { key: 3, label: 'Platform', manager: 'Ada Wong', headcount: 22 },
          { key: 4, label: 'Mobile', manager: 'Ken Ito', headcount: 18 },
          { key: 5, label: 'Data', manager: 'Mia Chen', headcount: 24 },
        ],
      },
      {
        key: 6,
        label: 'Sales',
        manager: 'Olivia Brown',
        headcount: 52,
        children: [
          { key: 7, label: 'North America', manager: 'Noah Smith', headcount: 30 },
          { key: 8, label: 'Europe', manager: 'Emma Weber', headcount: 22 },
        ],
      },
      { key: 9, label: 'Finance', manager: 'Liam Novak', headcount: 12 },
    ],
  },
]

export default function BasicTree() {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<DeptNode | null>(null)

  return (
    <div className="grid gap-4 md:grid-cols-[240px_minmax(0,1fr)]">
      {/* Clicking a row selects it; the chevron only expands / collapses */}
      <TreeView nodes={DEPARTMENTS} selectedKey={selected?.key} onSelect={setSelected} defaultExpandAll className="rounded-lg border p-1.5" />
      <div className="self-start rounded-lg border p-4 text-[13px]">
        {selected ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
            <dt className="text-muted-foreground">{t('部门')}</dt>
            <dd className="font-medium">{selected.label}</dd>
            <dt className="text-muted-foreground">{t('负责人')}</dt>
            <dd>{selected.manager}</dd>
            <dt className="text-muted-foreground">{t('人数')}</dt>
            <dd className="tabular-nums">{selected.headcount}</dd>
            <dt className="text-muted-foreground">{t('下级部门')}</dt>
            <dd className="tabular-nums">{selected.children?.length ?? 0}</dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">{t('点击左侧的部门查看详情')}</p>
        )}
      </div>
    </div>
  )
}
