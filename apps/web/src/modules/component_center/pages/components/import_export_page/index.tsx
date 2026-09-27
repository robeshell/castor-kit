/**
 * Components → Import / export: ImportDialog and ExportDialog wired to mock handlers that resolve / reject with the
 * API's documented shapes, so nothing is really imported. Layout and conventions follow the data table page.
 */
import ExportSelected from '@/modules/component_center/pages/components/import_export_page/examples/ExportSelected'
import exportSelectedSource from '@/modules/component_center/pages/components/import_export_page/examples/ExportSelected.tsx?raw'
import ImportErrorRows from '@/modules/component_center/pages/components/import_export_page/examples/ImportErrorRows'
import importErrorRowsSource from '@/modules/component_center/pages/components/import_export_page/examples/ImportErrorRows.tsx?raw'
import ImportSuccess from '@/modules/component_center/pages/components/import_export_page/examples/ImportSuccess'
import importSuccessSource from '@/modules/component_center/pages/components/import_export_page/examples/ImportSuccess.tsx?raw'
import {
  EXPORT_DIALOG_PROPS,
  IMPORT_DIALOG_PROPS,
  IMPORT_RESULT_PROPS,
} from '@/modules/component_center/pages/components/import_export_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import ImportDialog, { type ImportFailure, type ImportResult } from '@/shared/components/data-transfer/ImportDialog'
import ExportDialog, { type ExportFieldOption, type ExportParams } from '@/shared/components/data-transfer/ExportDialog'
import { downloadBlobFile } from '@/shared/utils/file'`

export default function ImportExportPage() {
  return (
    <ShowcasePage
      title="导入导出"
      intro="列表页的批量导入和导出，只支持 CSV 和 XLSX。ImportDialog 负责下载模板、选择文件、显示结果；接口返回错误行时整批不导入，对话框列出失败行数并提供失败明细下载，页面不用处理。ExportDialog 负责选择字段和文件格式，范围（勾选的行还是全部）由页面通过 ruleHint 说明、在请求里传 ids。下面的例子用模拟的接口，不会真的导入或导出数据。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="导入成功" description="onImport 返回 Promise，resolve { message, created, updated } 后对话框显示新增和更新的条数，onImported 里提示并刷新列表。选一个 CSV 或 XLSX 文件试试。" source={importSuccessSource}>
          <ImportSuccess />
        </Example>
        <Example title="导入失败的行" description="接口返回 400 { error, error_rows, error_count } 时直接 reject 这个错误体：对话框提示错误、显示失败行数，并可以下载失败明细。" source={importErrorRowsSource}>
          <ImportErrorRows />
        </Example>
        <Example title="导出" description="勾选行时只导出勾选的数据，否则导出全部；字段和文件格式在对话框里选。onConfirm 里自己处理失败，成功后才关闭对话框。" source={exportSelectedSource}>
          <ExportSelected />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="ImportDialog" items={IMPORT_DIALOG_PROPS} />
        <PropsTable title="ImportResult / ImportFailure" items={IMPORT_RESULT_PROPS} />
        <PropsTable title="ExportDialog" items={EXPORT_DIALOG_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
