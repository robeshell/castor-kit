import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { Check, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import TreeView from '@/shared/components/TreeView'
import type { TreeNode } from '@/shared/components/TreeView'

const collectDescendants = <N extends TreeNode>(node: N): N['key'][] =>
  (node.children || []).flatMap((child) => [child.key, ...collectDescendants(child)])

/**
 * Cascading parent/child checks:
 * - the checked set holds every fully checked node (parents included); half-checked parents are not in it
 * - a parent in the set -> all of its descendants count as checked
 * - a parent is checked if and only if all of its children are checked
 */
function expandDown<N extends TreeNode>(nodes: readonly N[], set: Set<N['key']>) {
  const walk = (list: readonly N[], parentChecked: boolean) =>
    list.forEach((node) => {
      const checked = parentChecked || set.has(node.key)
      if (checked) set.add(node.key)
      if (node.children) walk(node.children, checked)
    })
  walk(nodes, false)
  return set
}

function recomputeUp<N extends TreeNode>(nodes: readonly N[], set: Set<N['key']>) {
  const walk = (node: N): boolean => {
    if (!node.children?.length) return set.has(node.key)
    const all = node.children.map(walk).every(Boolean)
    if (all) set.add(node.key)
    else set.delete(node.key)
    return all
  }
  nodes.forEach(walk)
  return set
}

export type CheckState = 'checked' | 'indeterminate' | 'unchecked'

export interface CheckMarkProps {
  state: CheckState
}

/** Display-only checkbox (the whole row toggles it): checked / indeterminate / unchecked */
export function CheckMark({ state }: CheckMarkProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex size-4 shrink-0 items-center justify-center rounded-[4px] border shadow-xs transition-colors duration-150',
        state === 'unchecked' ? 'border-input dark:bg-input/30' : 'bg-primary border-primary text-primary-foreground',
      )}
    >
      {state === 'checked' ? <Check className="size-3.5" /> : null}
      {state === 'indeterminate' ? <Minus className="size-3.5" /> : null}
    </span>
  )
}

export interface CheckableTreeProps<N extends TreeNode = TreeNode> {
  /** TreeView nodes ({ key, label, children? }) */
  tree: readonly N[]
  /** The checked keys (fully checked parents included) */
  value?: readonly N['key'][]
  onChange?: (keys: N['key'][]) => void
  /** Label text (default node.label) */
  renderText?: (node: N) => ReactNode
  /** Accessible name of the tree (Chinese source text, translated by TreeView) */
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

/**
 * Multi-select tree with cascading checkboxes.
 * - tree: TreeView nodes ({ key, label, children? }); value / onChange: the checked keys (fully checked parents included)
 * - renderText(node): label text (default node.label)
 */
export default function CheckableTree<N extends TreeNode>({ tree, value = [], onChange, renderText, className, ...labelProps }: CheckableTreeProps<N>) {
  const checked = useMemo(() => recomputeUp(tree, expandDown(tree, new Set(value))), [tree, value])
  const isIndeterminate = (node: N) => !checked.has(node.key) && collectDescendants(node).some((k) => checked.has(k))
  const stateOf = (node: N): CheckState => (checked.has(node.key) ? 'checked' : isIndeterminate(node) ? 'indeterminate' : 'unchecked')

  const toggle = (node: N) => {
    const next = new Set(checked)
    const keys = [node.key, ...collectDescendants(node)]
    if (checked.has(node.key)) keys.forEach((k) => next.delete(k))
    else keys.forEach((k) => next.add(k))
    onChange?.([...recomputeUp(tree, next)])
  }

  return (
    <TreeView
      {...labelProps}
      nodes={tree}
      defaultExpandAll
      onSelect={toggle}
      // The row (treeitem) carries the checked state; Space / Enter toggles it
      checkedState={(node) => {
        const state = stateOf(node)
        return state === 'indeterminate' ? 'mixed' : state === 'checked'
      }}
      className={className}
      renderLabel={(node) => (
        <span className="flex items-center gap-2">
          <CheckMark state={stateOf(node)} />
          <span className="truncate">{renderText ? renderText(node) : node.label}</span>
        </span>
      )}
    />
  )
}
