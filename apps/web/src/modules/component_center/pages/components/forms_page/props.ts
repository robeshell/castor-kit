import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** Props every field takes (FormFieldProps in shared/components/FormFields.tsx) */
export const FORM_FIELD_PROPS: readonly PropDoc[] = [
  { name: 'control', type: 'Control<FormValues>', description: 'useForm() 返回的 form.control，决定 name 能填哪些字段' },
  { name: 'name', type: 'FieldPath<FormValues>', description: '字段名，按表单类型检查' },
  { name: 'label', type: 'ReactNode', description: '标签（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '字段下方的说明（中文原文，组件内翻译）' },
  { name: 'rules', type: 'RegisterOptions', description: 'react-hook-form 校验规则（required / pattern / min / validate …），提示文字会翻译' },
  { name: 'required', type: 'boolean', default: 'Boolean(rules.required)', description: '是否显示必填星号' },
  { name: 'className', type: 'string', description: '字段外层的 class，例如 sm:col-span-2' },
]

/** One option of FormSelect / FormRadioGroup / FormCheckboxGroup (SelectOption<V>) */
export const SELECT_OPTION_PROPS: readonly PropDoc[] = [
  { name: 'label', type: 'ReactNode', description: '选项文字（中文原文，组件内翻译）' },
  { name: 'value', type: 'string | number | boolean', description: '选项值；表单里保留原来的类型' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '显示但不可选' },
]

/** FormInput (FormInputProps) */
export const FORM_INPUT_PROPS: readonly PropDoc[] = [
  { name: 'type', type: 'HTMLInputTypeAttribute', default: "'text'", description: '原生 input 类型：email / password / tel …' },
  { name: 'placeholder', type: 'string', description: '占位文字（中文原文，组件内翻译）' },
  { name: 'autoComplete', type: 'string', description: '浏览器自动填充提示' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
  { name: 'inputClassName', type: 'string', description: '输入框的 class，例如 font-mono' },
]

/** FormTextarea (FormTextareaProps) */
export const FORM_TEXTAREA_PROPS: readonly PropDoc[] = [
  { name: 'rows', type: 'number', default: '3', description: '可见行数；可以拖动调整高度' },
  { name: 'placeholder', type: 'string', description: '占位文字（中文原文，组件内翻译）' },
  { name: 'inputClassName', type: 'string', description: '文本框的 class' },
]

/** FormNumber (FormNumberProps) */
export const FORM_NUMBER_PROPS: readonly PropDoc[] = [
  { name: 'min', type: 'number | string', description: '最小值（只限制步进按钮，校验用 rules.min）' },
  { name: 'max', type: 'number | string', description: '最大值（校验用 rules.max）' },
  { name: 'step', type: 'number | string', description: '步长' },
  { name: 'placeholder', type: 'string', description: '占位文字（中文原文，组件内翻译）' },
]

/** FormSelect (FormSelectProps) */
export const FORM_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'options', type: 'readonly SelectOption[]', default: '[]', description: '选项，见 SelectOption' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'placeholder', type: 'string', default: "'请选择'", description: '未选时的文字，也是「空」选项的文字' },
  { name: 'clearable', type: 'boolean', default: 'false', description: '加一个「空」选项，选中后值为 null' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
]

/** FormMultiSelect (FormMultiSelectProps) */
export const FORM_MULTI_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'options', type: 'readonly MultiSelectOption[]', default: '[]', description: '选项 { label, value }，value 为字符串或数字' },
  { name: 'placeholder', type: 'string', description: '未选时的文字（中文原文，组件内翻译）' },
]

/** FormTreeSelect (FormTreeSelectProps, a Pick of TreeSelectProps) */
export const FORM_TREE_SELECT_PROPS: readonly PropDoc[] = [
  { name: 'tree', type: 'readonly TreeSelectNode[]', default: '[]', description: '节点 { id, name, code?, disabled?, children? }' },
  { name: 'excludeId', type: 'id | null', description: '隐藏该节点和它的子孙，例如编辑时选上级' },
  { name: 'noneLabel', type: 'string', description: '设置后第一项可以选空（null），例如「无（顶级）」' },
  { name: 'placeholder', type: 'string', description: '未选时的文字' },
]

/** FormSwitch (FormSwitchProps) */
export const FORM_SWITCH_PROPS: readonly PropDoc[] = [
  { name: 'layout', type: "'inline' | 'vertical'", default: "'inline'", description: 'inline：标签在左、开关在右，带边框；vertical：标签在上' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
]

/** FormRadioGroup (FormRadioGroupProps) */
export const FORM_RADIO_GROUP_PROPS: readonly PropDoc[] = [
  { name: 'options', type: 'readonly SelectOption[]', default: '[]', description: '选项，见 SelectOption' },
  { name: 'direction', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: '排列方向' },
]

/** FormCheckboxGroup (FormCheckboxGroupProps) */
export const FORM_CHECKBOX_GROUP_PROPS: readonly PropDoc[] = [
  { name: 'options', type: 'readonly SelectOption[]', default: '[]', description: '选项，见 SelectOption' },
  { name: 'columns', type: 'number', default: '2', description: '网格列数' },
]

/** FormDate / FormDateTime / FormTags (FormDateProps, FormDateTimeProps, FormTagsProps) */
export const FORM_DATE_TAGS_PROPS: readonly PropDoc[] = [
  { name: 'placeholder', type: 'string', description: '占位文字（FormDate / FormTags）' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
]

/** FormFileUpload / FormImageUpload (FormFileUploadProps) */
export const FORM_FILE_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'multiple', type: 'boolean', default: 'false', description: '多个文件，值为 id 数组' },
  { name: 'accept', type: 'string', description: '允许的扩展名，例如 .pdf,.docx；默认按服务端配置' },
  { name: 'maxSizeMB', type: 'number', description: '单个文件大小上限；默认按服务端配置' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '禁用' },
]

/** FormAvatarUpload (FormAvatarUploadProps) */
export const FORM_AVATAR_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'displayName', type: 'string | null', description: '没有图片时显示它的首字母' },
  { name: 'maxSizeMB', type: 'number', description: '图片大小上限；默认按服务端配置' },
]

/** FormCustom (FormCustomProps) */
export const FORM_CUSTOM_PROPS: readonly PropDoc[] = [
  { name: 'render', type: '({ value, onChange, field, fieldState }) => ReactNode', description: '渲染控件；value 按字段推断类型' },
]

/** FormGrid (FormGridProps) */
export const FORM_GRID_PROPS: readonly PropDoc[] = [
  { name: 'columns', type: '1 | 2 | 3', default: '2', description: 'sm 断点以上的列数，手机上始终一列' },
  { name: 'className', type: 'string', description: '外层 class' },
]

/** FormDialog (FormDialogProps in shared/components/FormDialog.tsx) */
export const FORM_DIALOG_PROPS: readonly PropDoc[] = [
  { name: 'open', type: 'boolean', description: '是否打开（受控）' },
  { name: 'onOpenChange', type: '(open) => void', description: '点取消、遮罩或 Esc 时调用；提交中不会关闭' },
  { name: 'form', type: 'UseFormReturn<FormValues>', description: 'useForm() 的返回值' },
  { name: 'onSubmit', type: '(values) => void | Promise', description: '校验通过后调用；返回 Promise 时按钮显示加载，成功后由页面关闭弹窗' },
  { name: 'title', type: 'ReactNode', description: '标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '标题下的说明' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'submitText', type: 'ReactNode', default: "'保存'", description: '提交按钮文字' },
  { name: 'size', type: "'sm' | 'md' | 'lg' | 'xl'", default: "'md'", description: '宽度：420 / 560 / 720 / 920 px' },
  { name: 'footerExtra', type: 'ReactNode', description: '底部左侧的内容，例如次要操作' },
]

/** FormSheet: FormDialog's props with width in place of size, and no footerExtra */
export const FORM_SHEET_PROPS: readonly PropDoc[] = [
  { name: 'width', type: 'number', default: '520', description: '宽度（px），不超过视口' },
  { name: 'open / onOpenChange / form / onSubmit / title / description / submitText', type: '', description: '与 FormDialog 相同；没有 size 和 footerExtra' },
]

/** DetailSheet (DetailSheetProps in shared/components/FormDialog.tsx) */
export const DETAIL_SHEET_PROPS: readonly PropDoc[] = [
  { name: 'open', type: 'boolean', description: '是否打开（受控）' },
  { name: 'onOpenChange', type: '(open) => void', description: '打开状态变化时调用' },
  { name: 'title', type: 'ReactNode', description: '标题（中文原文，组件内翻译）' },
  { name: 'description', type: 'ReactNode', description: '标题下的说明' },
  { name: 'width', type: 'number', default: '480', description: '宽度（px），不超过视口' },
  { name: 'footer', type: 'ReactNode', description: '底部按钮；不传则没有底栏' },
]

/** DescriptionList (DescriptionListProps in shared/components/FormDialog.tsx) */
export const DESCRIPTION_LIST_PROPS: readonly PropDoc[] = [
  { name: 'items', type: '(DescriptionItem | false | null | undefined)[]', default: '[]', description: '条目；假值会被跳过，可以写 cond && { … }' },
  { name: 'columns', type: '1 | 2', default: '1', description: 'sm 断点以上的列数' },
  { name: 'className', type: 'string', description: '外层 class' },
]

/** One DescriptionList entry (DescriptionItem) */
export const DESCRIPTION_ITEM_PROPS: readonly PropDoc[] = [
  { name: 'label', type: 'string', description: '标签（中文原文，组件内翻译），也是 React key，列表内唯一' },
  { name: 'value', type: 'ReactNode', description: '值；null / undefined / 空字符串显示 -' },
  { name: 'full', type: 'boolean', default: 'false', description: '占满两列' },
]
