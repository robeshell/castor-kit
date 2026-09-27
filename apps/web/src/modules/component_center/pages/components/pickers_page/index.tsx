/**
 * Components → Pickers: MultiSelect, TagInput, DatePicker / DateTimePicker and TreeSelect used on their own
 * (controlled value + onChange). The react-hook-form wrappers (FormMultiSelect, FormDate …) are on the forms page.
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import DatePickerDemo from '@/modules/component_center/pages/components/pickers_page/examples/DatePickerDemo'
import datePickerDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/DatePickerDemo.tsx?raw'
import DateRangeDemo from '@/modules/component_center/pages/components/pickers_page/examples/DateRangeDemo'
import dateRangeDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/DateRangeDemo.tsx?raw'
import DateTimeDemo from '@/modules/component_center/pages/components/pickers_page/examples/DateTimeDemo'
import dateTimeDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/DateTimeDemo.tsx?raw'
import MultiSelectDemo from '@/modules/component_center/pages/components/pickers_page/examples/MultiSelectDemo'
import multiSelectDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/MultiSelectDemo.tsx?raw'
import TagInputDemo from '@/modules/component_center/pages/components/pickers_page/examples/TagInputDemo'
import tagInputDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/TagInputDemo.tsx?raw'
import TreeSelectDemo from '@/modules/component_center/pages/components/pickers_page/examples/TreeSelectDemo'
import treeSelectDemoSource from '@/modules/component_center/pages/components/pickers_page/examples/TreeSelectDemo.tsx?raw'
import {
  DATE_PICKER_PROPS,
  DATE_TIME_PICKER_PROPS,
  MULTI_SELECT_PROPS,
  TAG_INPUT_PROPS,
  TREE_SELECT_NODE_PROPS,
  TREE_SELECT_PROPS,
} from '@/modules/component_center/pages/components/pickers_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import MultiSelect, { type MultiSelectOption } from '@/shared/components/MultiSelect'
import TagInput from '@/shared/components/TagInput'
import { DatePicker, DateTimePicker } from '@/shared/components/DatePicker'
import TreeSelect, { type TreeSelectNode } from '@/shared/components/TreeSelect'`

export default function PickersPage() {
  return (
    <ShowcasePage
      title="选择器"
      intro="表单之外单独使用的选择控件，都是受控的 value + onChange。在 react-hook-form 表单里用对应的 FormMultiSelect / FormTags / FormDate / FormDateTime / FormTreeSelect（见「表单」页）。没有日期范围组件，用两个 DatePicker 组合；TreeSelect 只能单选，多选树用 CheckableTree。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="多选" description="可搜索的多选，值是数组并保留选项值的类型；maxShown 控制显示几个标签，其余折叠成 +N。" source={multiSelectDemoSource}>
          <MultiSelectDemo />
        </Example>
        <Example title="标签输入" description="回车或逗号添加，退格删除最后一个，自动去重；需要统一大小写等处理时在 onChange 里做。" source={tagInputDemoSource}>
          <TagInputDemo />
        </Example>
        <Example title="日期" description="值是 'YYYY-MM-DD' 字符串，空为 ''，可以直接传给接口；clearable={false} 用于必须有值的场景。" source={datePickerDemoSource}>
          <DatePickerDemo />
        </Example>
        <Example title="日期范围" description="两个 DatePicker 组成范围，改一端时保证开始不晚于结束；任一端可以为空，表示不限。" source={dateRangeDemoSource}>
          <DateRangeDemo />
        </Example>
        <Example title="日期时间" description="传入接口的 UTC 时间，按浏览器时区显示和编辑，onChange 给出带时区偏移的 ISO 8601。" source={dateTimeDemoSource}>
          <DateTimeDemo />
        </Example>
        <Example title="树选择" description="单选树节点，可按名称或编码搜索；excludeId 在编辑时排除自己和子孙，noneLabel 允许选空，禁用的节点不可选。" source={treeSelectDemoSource}>
          <TreeSelectDemo />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="MultiSelect" items={MULTI_SELECT_PROPS} />
        <PropsTable title="TagInput" items={TAG_INPUT_PROPS} />
        <PropsTable title="DatePicker" items={DATE_PICKER_PROPS} />
        <PropsTable title="DateTimePicker" items={DATE_TIME_PICKER_PROPS} />
        <PropsTable title="TreeSelect" items={TREE_SELECT_PROPS} />
        <PropsTable title="TreeSelectNode<Id>" items={TREE_SELECT_NODE_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
