import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import EmptyState from '@/shared/components/EmptyState'
import TreeView, { type TreeNode } from '@/shared/components/TreeView'

interface MenuNode extends TreeNode {
  key: string
  label: string
}

const MENUS: MenuNode[] = [
  {
    key: 'system',
    label: 'System',
    children: [
      { key: 'users', label: 'Users' },
      { key: 'roles', label: 'Roles' },
      { key: 'menus', label: 'Menus' },
      { key: 'settings', label: 'Settings', children: [{ key: 'mail', label: 'Mail server' }, { key: 'storage', label: 'File storage' }] },
    ],
  },
  {
    key: 'content',
    label: 'Content',
    children: [
      { key: 'articles', label: 'Articles' },
      { key: 'files', label: 'Files' },
    ],
  },
  { key: 'logs', label: 'Audit logs' },
]

/** Keeps nodes whose label matches and the ancestors that lead to them; a matching node keeps all of its children */
function filterTree(nodes: readonly MenuNode[], keyword: string): MenuNode[] {
  return nodes.flatMap((node) => {
    if (node.label.toLowerCase().includes(keyword)) return [node]
    const children = filterTree(node.children ?? [], keyword)
    return children.length ? [{ ...node, children }] : []
  })
}

const allKeys = (nodes: readonly MenuNode[]): string[] => nodes.flatMap((node) => [node.key, ...allKeys(node.children ?? [])])

/** The label with the matching part highlighted */
function Highlight({ text, keyword }: { text: string; keyword: string }) {
  const start = keyword ? text.toLowerCase().indexOf(keyword) : -1
  if (start < 0) return text
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-warning-soft text-foreground rounded-sm">{text.slice(start, start + keyword.length)}</mark>
      {text.slice(start + keyword.length)}
    </>
  )
}

export default function FilterTree() {
  const { t } = useTranslation()
  const [keyword, setKeyword] = useState('')
  const [expanded, setExpanded] = useState<string[]>(['system'])
  const query = keyword.trim().toLowerCase()
  // TreeView has no search of its own: filter the nodes before passing them in
  const visible = query ? filterTree(MENUS, query) : MENUS

  const search = (value: string) => {
    setKeyword(value)
    // Open every branch that holds a match; the user can still collapse them afterwards
    const next = value.trim().toLowerCase()
    if (next) setExpanded(allKeys(filterTree(MENUS, next)))
  }

  return (
    <div className="max-w-sm space-y-2">
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input value={keyword} onChange={(e) => search(e.target.value)} placeholder={t('搜索菜单')} aria-label={t('搜索菜单')} className="h-8 pl-8" />
      </div>
      <div className="rounded-lg border p-1.5">
        {visible.length ? (
          <TreeView
            nodes={visible}
            expandedKeys={expanded}
            onExpandedChange={setExpanded}
            renderLabel={(node) => <Highlight text={node.label} keyword={query} />}
          />
        ) : (
          <EmptyState title="没有匹配的结果" className="py-8" />
        )}
      </div>
    </div>
  )
}
