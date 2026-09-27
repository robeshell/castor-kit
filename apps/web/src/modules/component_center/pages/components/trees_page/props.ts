import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** TreeView (TreeViewProps in shared/components/TreeView.tsx) */
export const TREE_VIEW_PROPS: readonly PropDoc[] = [
  { name: 'nodes', type: 'readonly N[]', default: '[]', description: '树节点，N 是 TreeNode 或它的子类型' },
  { name: 'selectedKey', type: "N['key']", description: '高亮的节点' },
  { name: 'onSelect', type: '(node: N) => void', description: '点击行时调用（点箭头只展开 / 收起）' },
  { name: 'renderLabel', type: '(node: N) => ReactNode', description: '行内容，默认显示 node.label（不翻译）' },
  { name: 'renderActions', type: '(node: N) => ReactNode', description: '悬停时显示在行尾的操作，点击不会触发 onSelect' },
  { name: 'defaultExpandAll', type: 'boolean', default: 'false', description: '非受控时初始展开全部节点' },
  { name: 'expandedKeys', type: "readonly N['key'][]", description: '展开的节点（受控，和 onExpandedChange 一起用）' },
  { name: 'onExpandedChange', type: "(keys: N['key'][]) => void", description: '展开 / 收起时调用，传入新的展开列表' },
  { name: 'className', type: 'string', description: '外层列表的 class' },
]

/** TreeNode (shared/components/TreeView.tsx): extend it with your own fields */
export const TREE_NODE_PROPS: readonly PropDoc[] = [
  { name: 'key', type: 'string | number', description: '节点的唯一标识，整棵树内不能重复' },
  { name: 'label', type: 'ReactNode', description: '默认显示的内容' },
  { name: 'children', type: 'readonly this[]', description: '子节点，类型和父节点相同，所以自定义字段在每一层都能拿到' },
]

/** CheckableTree (CheckableTreeProps in shared/components/CheckableTree.tsx) */
export const CHECKABLE_TREE_PROPS: readonly PropDoc[] = [
  { name: 'tree', type: 'readonly N[]', description: '树节点，同 TreeView 的 nodes；始终全部展开' },
  { name: 'value', type: "readonly N['key'][]", default: '[]', description: '勾选的节点（受控）；父节点的 key 会勾选它的全部子节点' },
  { name: 'onChange', type: "(keys: N['key'][]) => void", description: '勾选变化时调用：全部勾选的节点（包括父节点），不含半选的父节点' },
  { name: 'renderText', type: '(node: N) => ReactNode', description: '勾选框后面的文字，默认 node.label' },
  { name: 'className', type: 'string', description: '外层列表的 class' },
]
