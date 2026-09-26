import TreeSelect from '@/shared/components/TreeSelect'

/**
 * Tree parent picker for the tree list demo: the shared TreeSelect with node_code as the code and "(none) = root".
 * value is a node id (number) or null; excludeId excludes a node and its descendants while editing, to prevent cycles.
 */
export default function ParentSelect({ value, onChange, tree = [], excludeId, placeholder = '不选则作为根节点', disabled }) {
  return (
    <TreeSelect
      value={value}
      onChange={onChange}
      tree={tree}
      excludeId={excludeId}
      codeKey="node_code"
      placeholder={placeholder}
      searchPlaceholder="搜索节点名称 / 编码"
      emptyText="没有匹配的节点"
      noneLabel="（无）作为根节点"
      disabled={disabled}
    />
  )
}
