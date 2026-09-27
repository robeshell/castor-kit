/**
 * Components → Condition builder: how to use ConditionBuilder (field / operator / value conditions combined with
 * AND / OR, plus condition groups).
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import BasicUsage from '@/modules/component_center/pages/components/condition_builder_page/examples/BasicUsage'
import basicUsageSource from '@/modules/component_center/pages/components/condition_builder_page/examples/BasicUsage.tsx?raw'
import FilterRows from '@/modules/component_center/pages/components/condition_builder_page/examples/FilterRows'
import filterRowsSource from '@/modules/component_center/pages/components/condition_builder_page/examples/FilterRows.tsx?raw'
import FlatAndReadOnly from '@/modules/component_center/pages/components/condition_builder_page/examples/FlatAndReadOnly'
import flatAndReadOnlySource from '@/modules/component_center/pages/components/condition_builder_page/examples/FlatAndReadOnly.tsx?raw'
import SavedQueryForm from '@/modules/component_center/pages/components/condition_builder_page/examples/SavedQueryForm'
import savedQueryFormSource from '@/modules/component_center/pages/components/condition_builder_page/examples/SavedQueryForm.tsx?raw'
import {
  CONDITION_BUILDER_PROPS,
  CONDITION_FIELD_PROPS,
  CONDITION_TREE_PROPS,
  OPERATOR_ROWS,
} from '@/modules/component_center/pages/components/condition_builder_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import ConditionBuilder, { type ConditionField, type ConditionTree } from '@/shared/components/ConditionBuilder'`

export default function ConditionBuilderPage() {
  return (
    <ShowcasePage
      title="条件构建器"
      intro="高级筛选和保存的查询：每个条件由字段、操作符和值组成，同一层用「满足全部」(AND) 或「满足任一」(OR) 组合，条件组再嵌套一层。组件是受控的，只负责编辑值：值是纯 JSON，保存、转成接口参数或在前端过滤数据由页面决定。不支持多层嵌套和字段之间的比较。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example
          title="基础用法"
          description="给字段列表标注 ConditionField<K>[]，K 是字段名的联合类型；字段类型决定可选的操作符和值的输入方式。「当前值」是 onChange 传出的值。"
          source={basicUsageSource}
        >
          <BasicUsage />
        </Example>
        <Example
          title="过滤数据"
          description="把值变成行的判断函数，在前端过滤已加载的数据；没填完的条件跳过。服务端数据则把值随列表请求一起发给接口。"
          source={filterRowsSource}
        >
          <FilterRows />
        </Example>
        <Example
          title="在表单中保存查询"
          description="用 FormCustom 接进 react-hook-form：保存过的值直接作为默认值回显，校验规则要求至少一个条件。"
          source={savedQueryFormSource}
        >
          <SavedQueryForm />
        </Example>
        <Example
          title="单层与只读"
          description="allowGroups={false} 去掉条件组；字段的 operators 限定可选操作符；disabled 只显示不能修改。"
          source={flatAndReadOnlySource}
        >
          <FlatAndReadOnly />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="ConditionBuilder" items={CONDITION_BUILDER_PROPS} />
        <PropsTable title="ConditionField<K>" items={CONDITION_FIELD_PROPS} />
        <PropsTable title="ConditionTree<K>" items={CONDITION_TREE_PROPS} />
      </ShowcaseSection>
      <ShowcaseSection title="操作符" description="按字段类型：类型列是可选的操作符（第一个是新条件的默认值），默认值列是新条件的初始值。">
        <PropsTable title="ConditionOperator" items={OPERATOR_ROWS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
