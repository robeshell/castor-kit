import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TreeView, { type TreeNode } from '@/shared/components/TreeView'

interface RegionNode extends TreeNode {
  key: string
  label: string
}

const REGIONS: RegionNode[] = [
  {
    key: 'asia',
    label: 'Asia',
    children: [
      { key: 'jp', label: 'Japan', children: [{ key: 'jp-tyo', label: 'Tokyo' }, { key: 'jp-osa', label: 'Osaka' }] },
      { key: 'sg', label: 'Singapore' },
    ],
  },
  {
    key: 'europe',
    label: 'Europe',
    children: [
      { key: 'de', label: 'Germany', children: [{ key: 'de-ber', label: 'Berlin' }, { key: 'de-muc', label: 'Munich' }] },
      { key: 'fr', label: 'France', children: [{ key: 'fr-par', label: 'Paris' }] },
    ],
  },
]

/** Keys of every node that has children (leaves have nothing to expand) */
const parentKeys = (nodes: readonly RegionNode[]): string[] =>
  nodes.flatMap((node) => (node.children?.length ? [node.key, ...parentKeys(node.children)] : []))

export default function ControlledExpand() {
  const { t } = useTranslation()
  // Controlled: pass expandedKeys and onExpandedChange together, or the chevrons can't change anything
  const [expanded, setExpanded] = useState<string[]>(['asia'])

  return (
    <div className="max-w-sm space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Button variant="outline" size="sm" onClick={() => setExpanded(parentKeys(REGIONS))}>
          <ChevronsUpDown />
          {t('全部展开')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded([])}>
          <ChevronsDownUp />
          {t('全部收起')}
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setExpanded(REGIONS.map((node) => node.key))}>
          {t('只展开第一层')}
        </Button>
      </div>
      <TreeView nodes={REGIONS} expandedKeys={expanded} onExpandedChange={setExpanded} className="rounded-lg border p-1.5" />
      <p className="text-muted-foreground text-xs">
        expandedKeys: <code className="font-mono">{JSON.stringify(expanded)}</code>
      </p>
    </div>
  )
}
