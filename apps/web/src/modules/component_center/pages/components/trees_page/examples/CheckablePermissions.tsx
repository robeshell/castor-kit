import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import CheckableTree from '@/shared/components/CheckableTree'
import type { TreeNode } from '@/shared/components/TreeView'

interface PermissionNode extends TreeNode {
  key: string
  /** Chinese source text: TreeView shows labels as they are, so renderText translates them */
  label: string
}

const PERMISSIONS: PermissionNode[] = [
  {
    key: 'orders',
    label: '订单',
    children: [
      { key: 'orders.view', label: '查看' },
      { key: 'orders.edit', label: '编辑' },
      { key: 'orders.refund', label: '退款' },
    ],
  },
  {
    key: 'customers',
    label: '客户',
    children: [
      { key: 'customers.view', label: '查看' },
      { key: 'customers.export', label: '导出' },
    ],
  },
  {
    key: 'reports',
    label: '报表',
    children: [
      { key: 'reports.sales', label: '销售报表' },
      { key: 'reports.finance', label: '财务报表' },
    ],
  },
]

const allKeys = (nodes: readonly PermissionNode[]): string[] => nodes.flatMap((node) => [node.key, ...allKeys(node.children ?? [])])

/** Leaf keys that count as checked: a checked parent checks its whole subtree */
const checkedLeaves = (nodes: readonly PermissionNode[], checked: ReadonlySet<string>, parentChecked = false): string[] =>
  nodes.flatMap((node) => {
    const on = parentChecked || checked.has(node.key)
    return node.children?.length ? checkedLeaves(node.children, checked, on) : on ? [node.key] : []
  })

/** Parents with some but not all descendants checked: not part of value, derive them when the API needs them */
const halfChecked = (nodes: readonly PermissionNode[], checked: ReadonlySet<string>): string[] =>
  nodes.flatMap((node) => {
    if (!node.children?.length) return []
    const inside = allKeys(node.children).some((key) => checked.has(key))
    return [...(inside && !checked.has(node.key) ? [node.key] : []), ...halfChecked(node.children, checked)]
  })

export default function CheckablePermissions() {
  const { t } = useTranslation()
  // A parent key alone checks all of its children; after a change, value lists every fully checked node, parents included
  const [value, setValue] = useState<string[]>(['orders.view', 'orders.edit', 'reports'])
  const checked = new Set(value)

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div className="space-y-2">
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={() => setValue(allKeys(PERMISSIONS))}>
            {t('全选')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setValue([])}>
            {t('清空')}
          </Button>
        </div>
        <CheckableTree
          tree={PERMISSIONS}
          value={value}
          onChange={setValue}
          className="rounded-lg border p-1.5"
          renderText={(node) => (
            <>
              {t(node.label)}
              <code className="text-muted-foreground ml-2 font-mono text-xs">{node.key}</code>
            </>
          )}
        />
      </div>
      <dl className="space-y-3 text-xs">
        <div className="space-y-1">
          <dt className="text-muted-foreground">value</dt>
          <dd className="font-mono break-all">{JSON.stringify(value)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('只取叶子节点')}</dt>
          <dd className="font-mono break-all">{JSON.stringify(checkedLeaves(PERMISSIONS, checked))}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-muted-foreground">{t('半选的父节点')}</dt>
          <dd className="font-mono break-all">{JSON.stringify(halfChecked(PERMISSIONS, checked))}</dd>
        </div>
      </dl>
    </div>
  )
}
