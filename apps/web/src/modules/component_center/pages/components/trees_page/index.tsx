/**
 * Components → Trees: TreeView (selection, expansion, custom rows, filtering done by the page) and CheckableTree
 * (cascading checks, controlled value, inside a form). Layout and conventions follow the data table page.
 */
import BasicTree from '@/modules/component_center/pages/components/trees_page/examples/BasicTree'
import basicTreeSource from '@/modules/component_center/pages/components/trees_page/examples/BasicTree.tsx?raw'
import CheckablePermissions from '@/modules/component_center/pages/components/trees_page/examples/CheckablePermissions'
import checkablePermissionsSource from '@/modules/component_center/pages/components/trees_page/examples/CheckablePermissions.tsx?raw'
import CheckableTreeForm from '@/modules/component_center/pages/components/trees_page/examples/CheckableTreeForm'
import checkableTreeFormSource from '@/modules/component_center/pages/components/trees_page/examples/CheckableTreeForm.tsx?raw'
import ControlledExpand from '@/modules/component_center/pages/components/trees_page/examples/ControlledExpand'
import controlledExpandSource from '@/modules/component_center/pages/components/trees_page/examples/ControlledExpand.tsx?raw'
import CustomNodes from '@/modules/component_center/pages/components/trees_page/examples/CustomNodes'
import customNodesSource from '@/modules/component_center/pages/components/trees_page/examples/CustomNodes.tsx?raw'
import FilterTree from '@/modules/component_center/pages/components/trees_page/examples/FilterTree'
import filterTreeSource from '@/modules/component_center/pages/components/trees_page/examples/FilterTree.tsx?raw'
import { CHECKABLE_TREE_PROPS, TREE_NODE_PROPS, TREE_VIEW_PROPS } from '@/modules/component_center/pages/components/trees_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import TreeView, { type TreeNode } from '@/shared/components/TreeView'
import CheckableTree from '@/shared/components/CheckableTree'`

export default function TreesPage() {
  return (
    <ShowcasePage
      title="树"
      intro="层级数据：TreeView 用于浏览和选择（部门、菜单、文件夹），CheckableTree 用于多选并级联勾选（权限、数据范围）。节点类型继承 TreeNode，自定义字段在每一层的回调里都有类型。组件不带搜索、懒加载和拖拽排序：搜索时由页面过滤节点再传入；节点文字按原样显示，中文要在 renderLabel / renderText 里翻译。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="选择节点" description="节点类型继承 TreeNode 并加上自己的字段；selectedKey 和 onSelect 由页面管理，选中后显示详情。" source={basicTreeSource}>
          <BasicTree />
        </Example>
        <Example title="自定义节点" description="renderLabel 按类型显示图标和数量；renderActions 悬停时出现在行尾，删除用 ConfirmAction 确认。" source={customNodesSource}>
          <CustomNodes />
        </Example>
        <Example title="受控展开" description="expandedKeys 和 onExpandedChange 一起传，页面就能全部展开、全部收起或只展开第一层。" source={controlledExpandSource}>
          <ControlledExpand />
        </Example>
        <Example title="搜索过滤" description="页面按关键字过滤节点（保留匹配项的上级），展开包含匹配项的分支，并在 renderLabel 里高亮关键字。" source={filterTreeSource}>
          <FilterTree />
        </Example>
        <Example title="级联勾选" description="勾选父节点会勾选全部子节点；value 包含全部勾选的节点，半选的父节点不在里面，需要时自己算出来。" source={checkablePermissionsSource}>
          <CheckablePermissions />
        </Example>
        <Example title="在表单中使用" description="用 FormCustom 把 CheckableTree 接进 react-hook-form，勾选的 key 就是字段值，validate 要求至少勾选一项。" source={checkableTreeFormSource}>
          <CheckableTreeForm />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="TreeView<N>" items={TREE_VIEW_PROPS} />
        <PropsTable title="TreeNode" items={TREE_NODE_PROPS} />
        <PropsTable title="CheckableTree<N>" items={CHECKABLE_TREE_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
