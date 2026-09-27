/**
 * Components → Forms: the react-hook-form field components (FormFields), FormGrid, and the containers FormDialog /
 * FormSheet, plus the read-only DetailSheet / DescriptionList that live next to them.
 *
 * Each example is its own file under ./examples, imported twice (component + `?raw` source); props tables are in
 * ./props.ts. See data_table_page for the layout rules.
 */
import BasicFields from '@/modules/component_center/pages/components/forms_page/examples/BasicFields'
import basicFieldsSource from '@/modules/component_center/pages/components/forms_page/examples/BasicFields.tsx?raw'
import ChoiceFields from '@/modules/component_center/pages/components/forms_page/examples/ChoiceFields'
import choiceFieldsSource from '@/modules/component_center/pages/components/forms_page/examples/ChoiceFields.tsx?raw'
import CustomField from '@/modules/component_center/pages/components/forms_page/examples/CustomField'
import customFieldSource from '@/modules/component_center/pages/components/forms_page/examples/CustomField.tsx?raw'
import DetailView from '@/modules/component_center/pages/components/forms_page/examples/DetailView'
import detailViewSource from '@/modules/component_center/pages/components/forms_page/examples/DetailView.tsx?raw'
import DialogForm from '@/modules/component_center/pages/components/forms_page/examples/DialogForm'
import dialogFormSource from '@/modules/component_center/pages/components/forms_page/examples/DialogForm.tsx?raw'
import GridLayout from '@/modules/component_center/pages/components/forms_page/examples/GridLayout'
import gridLayoutSource from '@/modules/component_center/pages/components/forms_page/examples/GridLayout.tsx?raw'
import PickerFields from '@/modules/component_center/pages/components/forms_page/examples/PickerFields'
import pickerFieldsSource from '@/modules/component_center/pages/components/forms_page/examples/PickerFields.tsx?raw'
import SheetForm from '@/modules/component_center/pages/components/forms_page/examples/SheetForm'
import sheetFormSource from '@/modules/component_center/pages/components/forms_page/examples/SheetForm.tsx?raw'
import UploadFields from '@/modules/component_center/pages/components/forms_page/examples/UploadFields'
import uploadFieldsSource from '@/modules/component_center/pages/components/forms_page/examples/UploadFields.tsx?raw'
import {
  DESCRIPTION_ITEM_PROPS,
  DESCRIPTION_LIST_PROPS,
  DETAIL_SHEET_PROPS,
  FORM_AVATAR_UPLOAD_PROPS,
  FORM_CHECKBOX_GROUP_PROPS,
  FORM_CUSTOM_PROPS,
  FORM_DATE_TAGS_PROPS,
  FORM_DIALOG_PROPS,
  FORM_FIELD_PROPS,
  FORM_FILE_UPLOAD_PROPS,
  FORM_GRID_PROPS,
  FORM_INPUT_PROPS,
  FORM_MULTI_SELECT_PROPS,
  FORM_NUMBER_PROPS,
  FORM_RADIO_GROUP_PROPS,
  FORM_SELECT_PROPS,
  FORM_SHEET_PROPS,
  FORM_SWITCH_PROPS,
  FORM_TEXTAREA_PROPS,
  FORM_TREE_SELECT_PROPS,
  SELECT_OPTION_PROPS,
} from '@/modules/component_center/pages/components/forms_page/props'
import CodeBlock from '@/modules/component_center/showcase/CodeBlock'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import { useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { FormGrid, FormInput, FormSelect, FormSwitch, type SelectOption } from '@/shared/components/FormFields'
import { DescriptionList, DetailSheet, FormDialog, FormSheet } from '@/shared/components/FormDialog'`

const VALUE_TYPES = `interface FormValues {
  name: string              // FormInput, FormTextarea
  budget: number | null     // FormNumber: null when empty
  status: 'active' | null   // FormSelect: the option's own type; null with clearable
  enabled: boolean          // FormSwitch
  level: 1 | 2 | 3          // FormRadioGroup: the option's own type
  channels: string[]        // FormCheckboxGroup
  reviewer_ids: number[]    // FormMultiSelect
  dept_id: number | null    // FormTreeSelect
  start_date: string        // FormDate: 'YYYY-MM-DD', '' when empty
  publish_at: string        // FormDateTime: ISO 8601 with the browser's offset, '' when empty
  tags: string[]            // FormTags
  cover_id: string | null   // FormImageUpload / FormFileUpload: a file-center id (string[] with multiple)
  avatar: string            // FormAvatarUpload: the image URL
}`

export default function FormsPage() {
  return (
    <ShowcasePage
      title="表单"
      intro="表单字段基于 react-hook-form：useForm<FormValues>() 定义表单类型，字段传 control 和 name，name 按类型检查，校验写在 rules 里，提示文字和标签传中文原文，组件内翻译。字段放进 FormDialog / FormSheet，或放在 <Form {...form}> 里的 <form> 中。接口返回的错误不会自动对应到字段：在 onSubmit 里用 form.setError 放到字段下。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="基础字段" description="输入框、数字、下拉和多行文本；rules 写必填、长度、格式和范围，提交时校验，出错的字段下方显示提示。" source={basicFieldsSource}>
          <BasicFields />
        </Example>
        <Example title="开关与选项" description="开关写入 boolean，单选和多选保留选项值的类型（数字还是数字）；mode: 'onChange' 让校验随输入进行。" source={choiceFieldsSource}>
          <ChoiceFields />
        </Example>
        <Example title="选择器字段" description="日期、日期时间、树选择、多选和标签；日期范围是两个 FormDate，validate 的第二个参数拿到整张表单做联动校验。" source={pickerFieldsSource}>
          <PickerFields />
        </Example>
        <Example title="上传字段" description="选中文件后立即上传到文件中心，表单里只存文件 id（头像存图片地址）。更多上传用法见「上传」页。" source={uploadFieldsSource}>
          <UploadFields />
        </Example>
        <Example title="自定义字段" description="FormCustom 把任意控件接进表单：render 拿到带类型的 value 和 onChange，标签、说明、校验和错误提示照常工作。" source={customFieldSource}>
          <CustomField />
        </Example>
        <Example title="栅格布局" description="FormGrid 默认两列，手机上一列；长字段用 sm:col-span-2 占满一行，短字段可以三列。" source={gridLayoutSource}>
          <GridLayout />
        </Example>
        <Example title="弹窗表单" description="新建和编辑共用一个 FormDialog，打开前 form.reset；onSubmit 返回 Promise 时按钮显示加载，接口的字段错误用 form.setError 显示在字段下。" source={dialogFormSource}>
          <DialogForm />
        </Example>
        <Example title="抽屉表单" description="字段较多，或需要看着后面的列表填写时，用 FormSheet 从右侧滑出，属性和 FormDialog 相同。" source={sheetFormSource}>
          <SheetForm />
        </Example>
        <Example title="详情抽屉" description="只读详情用 DetailSheet + DescriptionList：两列布局，full 占满一行，空值显示 -，条目可以按记录条件出现。" source={detailViewSource}>
          <DetailView />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="值类型" description="每个字段写入表单的值，按它声明 FormValues。">
        <CodeBlock code={VALUE_TYPES} className="surface-card overflow-hidden" />
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="FormFieldProps" items={FORM_FIELD_PROPS} />
        <PropsTable title="SelectOption<V>" items={SELECT_OPTION_PROPS} />
        <PropsTable title="FormInput" items={FORM_INPUT_PROPS} />
        <PropsTable title="FormTextarea" items={FORM_TEXTAREA_PROPS} />
        <PropsTable title="FormNumber" items={FORM_NUMBER_PROPS} />
        <PropsTable title="FormSelect" items={FORM_SELECT_PROPS} />
        <PropsTable title="FormMultiSelect" items={FORM_MULTI_SELECT_PROPS} />
        <PropsTable title="FormTreeSelect" items={FORM_TREE_SELECT_PROPS} />
        <PropsTable title="FormSwitch" items={FORM_SWITCH_PROPS} />
        <PropsTable title="FormRadioGroup" items={FORM_RADIO_GROUP_PROPS} />
        <PropsTable title="FormCheckboxGroup" items={FORM_CHECKBOX_GROUP_PROPS} />
        <PropsTable title="FormDate / FormDateTime / FormTags" items={FORM_DATE_TAGS_PROPS} />
        <PropsTable title="FormFileUpload / FormImageUpload" items={FORM_FILE_UPLOAD_PROPS} />
        <PropsTable title="FormAvatarUpload" items={FORM_AVATAR_UPLOAD_PROPS} />
        <PropsTable title="FormCustom" items={FORM_CUSTOM_PROPS} />
        <PropsTable title="FormGrid" items={FORM_GRID_PROPS} />
        <PropsTable title="FormDialog" items={FORM_DIALOG_PROPS} />
        <PropsTable title="FormSheet" items={FORM_SHEET_PROPS} />
        <PropsTable title="DetailSheet" items={DETAIL_SHEET_PROPS} />
        <PropsTable title="DescriptionList" items={DESCRIPTION_LIST_PROPS} />
        <PropsTable title="DescriptionItem" items={DESCRIPTION_ITEM_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
