import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import TreeSelect, { type TreeSelectNode } from '@/shared/components/TreeSelect'

// A department tree as the API returns it; the id type (number here) is the value type
const DEPARTMENTS: TreeSelectNode<number>[] = [
  {
    id: 1,
    name: 'Headquarters',
    code: 'HQ',
    children: [
      {
        id: 2,
        name: 'Engineering',
        code: 'ENG',
        children: [
          { id: 4, name: 'Platform', code: 'ENG-PLT' },
          { id: 5, name: 'Mobile', code: 'ENG-MOB' },
        ],
      },
      { id: 3, name: 'Marketing', code: 'MKT' },
      // A disabled node is listed but can't be picked
      { id: 6, name: 'Legacy Ops', code: 'OPS', disabled: true },
    ],
  },
]

export default function TreeSelectDemo() {
  const { t } = useTranslation()
  const [deptId, setDeptId] = useState<number | null>(4)
  const [parentId, setParentId] = useState<number | null>(1)

  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('所属部门')}</p>
        {/* Search matches the name and the code; the trigger shows the full path */}
        <TreeSelect value={deptId} onChange={setDeptId} tree={DEPARTMENTS} placeholder="选择部门" />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(deptId)}</code>
      </div>
      <div className="space-y-1.5">
        {/* Picking a new parent for Engineering: excludeId hides it and its children (no cycles), noneLabel allows top level */}
        <p className="text-[13px] font-medium">{t('上级部门（编辑 Engineering）')}</p>
        <TreeSelect value={parentId} onChange={setParentId} tree={DEPARTMENTS} excludeId={2} noneLabel="无（顶级部门）" />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(parentId)}</code>
      </div>
    </div>
  )
}
