import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileText, Folder, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import ConfirmAction from '@/shared/components/ConfirmAction'
import TreeView, { type TreeNode } from '@/shared/components/TreeView'

interface FileNode extends TreeNode {
  /** The path, unique in the tree */
  key: string
  label: string
  kind: 'folder' | 'file'
}

const FILES: FileNode[] = [
  {
    key: 'docs',
    label: 'docs',
    kind: 'folder',
    children: [
      { key: 'docs/guide.md', label: 'guide.md', kind: 'file' },
      { key: 'docs/faq.md', label: 'faq.md', kind: 'file' },
    ],
  },
  {
    key: 'assets',
    label: 'assets',
    kind: 'folder',
    children: [{ key: 'assets/logo.svg', label: 'logo.svg', kind: 'file' }],
  },
  { key: 'README.md', label: 'README.md', kind: 'file' },
]

// Immutable tree edits: return new arrays so React sees the change
function addChild(nodes: readonly FileNode[], parentKey: string, child: FileNode): FileNode[] {
  return nodes.map((node) =>
    node.key === parentKey
      ? { ...node, children: [...(node.children ?? []), child] }
      : node.children
        ? { ...node, children: addChild(node.children, parentKey, child) }
        : node,
  )
}

function removeNode(nodes: readonly FileNode[], key: string): FileNode[] {
  return nodes.filter((node) => node.key !== key).map((node) => (node.children ? { ...node, children: removeNode(node.children, key) } : node))
}

export default function CustomNodes() {
  const { t } = useTranslation()
  const [files, setFiles] = useState(FILES)
  const [expanded, setExpanded] = useState<string[]>(['docs'])
  const [count, setCount] = useState(1)

  const addFile = (folder: FileNode) => {
    const name = `untitled-${count}.md`
    setFiles((prev) => addChild(prev, folder.key, { key: `${folder.key}/${name}`, label: name, kind: 'file' }))
    setCount((n) => n + 1)
    // Open the folder so the new file is visible
    setExpanded((prev) => (prev.includes(folder.key) ? prev : [...prev, folder.key]))
  }

  return (
    <TreeView
      nodes={files}
      expandedKeys={expanded}
      onExpandedChange={setExpanded}
      className="max-w-sm rounded-lg border p-1.5"
      // The row content: an icon by kind, the name, and a count for folders
      renderLabel={(node) => (
        <span className="flex items-center gap-2">
          {node.kind === 'folder' ? <Folder className="text-primary size-4 shrink-0" /> : <FileText className="text-muted-foreground size-4 shrink-0" />}
          <span className="truncate">{node.label}</span>
          {node.kind === 'folder' ? <span className="text-muted-foreground text-xs tabular-nums">{node.children?.length ?? 0}</span> : null}
        </span>
      )}
      // Shown on hover at the end of the row; clicks here don't select the row
      renderActions={(node) => (
        <>
          {node.kind === 'folder' ? (
            <Button variant="ghost" size="icon-xs" aria-label={t('新建文件')} onClick={() => addFile(node)}>
              <Plus />
            </Button>
          ) : null}
          <ConfirmAction
            title="删除这一项？"
            description={node.kind === 'folder' ? t('文件夹「{{name}}」和里面的文件会一起删除。', { name: node.label }) : undefined}
            confirmText="删除"
            onConfirm={() => {
              setFiles((prev) => removeNode(prev, node.key))
              toast.success('已删除')
            }}
          >
            <Button variant="ghost" size="icon-xs" className="hover:text-danger" aria-label={t('删除 {{name}}', { name: node.label })}>
              <Trash2 />
            </Button>
          </ConfirmAction>
        </>
      )}
    />
  )
}
