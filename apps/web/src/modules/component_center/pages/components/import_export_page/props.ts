import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** ImportDialog (ImportDialogProps in shared/components/data-transfer/ImportDialog.tsx) */
export const IMPORT_DIALOG_PROPS: readonly PropDoc[] = [
  { name: 'open', type: 'boolean', description: '是否打开（受控）' },
  { name: 'onOpenChange', type: '(open: boolean) => void', description: '打开 / 关闭时调用；导入进行中不能关闭' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'title', type: 'ReactNode', default: "'导入数据'", description: '标题（中文原文，组件内翻译）' },
  { name: 'targetLabel', type: 'ReactNode', description: '导入到哪里，显示在说明里' },
  { name: 'onDownloadTemplate', type: '(fileType: string) => void', description: '下载所选格式的模板；不传时按钮不可用' },
  { name: 'onImport', type: '(file: File) => ImportResult | void | Promise<…>', description: '上传文件：成功时 resolve { message, created, updated }，失败时 reject 接口的错误体 ImportFailure' },
  { name: 'onImported', type: '(result: ImportResult) => void', description: '导入成功后调用，一般提示结果并刷新列表' },
  { name: 'errorExportFileName', type: 'string', default: "'import_error_rows.csv'", description: '失败明细的文件名' },
  { name: 'supportedFormats', type: 'readonly string[]', default: "['csv', 'xlsx']", description: '可以上传的扩展名（不带点）' },
  { name: 'templateFormatOptions', type: 'readonly { label, value }[]', default: 'XLSX, CSV', description: '模板格式选项，value 传给 onDownloadTemplate' },
  { name: 'defaultTemplateFormat', type: 'string', default: "'xlsx'", description: '默认选中的模板格式' },
]

/** The shapes onImport resolves / rejects with (ImportResult, ImportFailure, ImportErrorRow) */
export const IMPORT_RESULT_PROPS: readonly PropDoc[] = [
  { name: 'ImportResult', type: '{ message?, created?, updated? }', description: '成功的响应：新增和更新的条数' },
  { name: 'ImportFailure', type: '{ error, error_rows?, error_count? }', description: '失败的响应（400），整批回滚；对话框显示 error 和失败行数' },
  { name: 'error_rows', type: 'ImportErrorRow[]', description: '最多 500 行 { line, reason, row }，可以下载为 CSV' },
  { name: 'error_count', type: 'number', description: '失败行的总数（可能超过 error_rows 的长度）' },
]

/** ExportDialog (ExportDialogProps in shared/components/data-transfer/ExportDialog.tsx) */
export const EXPORT_DIALOG_PROPS: readonly PropDoc[] = [
  { name: 'open', type: 'boolean', description: '是否打开（受控）' },
  { name: 'onOpenChange', type: '(open: boolean) => void', description: '打开 / 关闭时调用；导出进行中不能关闭' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'title', type: 'ReactNode', default: "'导出数据'", description: '标题（中文原文，组件内翻译）' },
  { name: 'ruleHint', type: 'ReactNode', description: '说明导出范围，例如勾选的行还是全部数据' },
  { name: 'fieldOptions', type: 'readonly { label, value }[]', default: '[]', description: '可导出的字段：label 是中文原文，value 是接口的字段名' },
  { name: 'defaultFields', type: 'string[]', default: '[]', description: '打开时勾选的字段；空数组表示全部勾选' },
  { name: 'fileTypeOptions', type: 'readonly { label, value, description? }[]', default: 'Excel, CSV', description: '文件格式选项' },
  { name: 'defaultFileType', type: 'string', default: "'xlsx'", description: '默认文件格式' },
  { name: 'onConfirm', type: '({ fields, fileType }) => void | Promise<unknown>', description: '执行导出；Promise 结束前按钮显示加载。组件不处理失败，也不会自己关闭：成功后由页面关闭' },
]
