import { CARD_STYLE } from '@/shared/styles'
import { useState, useEffect } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Table, Tabs, TabPane, Input, Select,
  Button, Space, Typography, Tag, Toast,
} from '@douyinfe/semi-ui'
import { IconSearch, IconRefresh } from '@douyinfe/semi-icons'
import {
  getLoginLogs, getOperationLogs,
  exportLoginLogs, downloadLoginLogsTemplate, importLoginLogs,
  exportOperationLogs, downloadOperationLogsTemplate, importOperationLogs,
} from '@/modules/admin/api/logs'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'

const METHOD_COLOR = { POST: 'green', PUT: 'blue', DELETE: 'red', GET: 'grey' }
const LOGIN_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '状态', value: 'status' },
  { label: 'IP 地址', value: 'ip' },
  { label: 'User-Agent', value: 'user_agent' },
  { label: '说明', value: 'message' },
  { label: '时间', value: 'created_at' },
]
const OPERATION_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '用户名', value: 'username' },
  { label: '模块', value: 'module' },
  { label: '操作', value: 'action' },
  { label: '方法', value: 'method' },
  { label: '路径', value: 'path' },
  { label: '目标ID', value: 'target_id' },
  { label: '状态码', value: 'status_code' },
  { label: 'IP 地址', value: 'ip' },
  { label: 'User-Agent', value: 'user_agent' },
  { label: '请求体', value: 'payload' },
  { label: '时间', value: 'created_at' },
]
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')

export default function Logs() {
  const isMobile = useIsMobile()
  // 登录日志
  const loginList = useCrudList((params) => getLoginLogs(params), { defaultPerPage: 20 })
  const { data: loginData, total: loginTotal, loading: loginLoading, page: loginPage, filters: loginFilters, handlePageChange: loginPageChange, fetchData: fetchLoginLogs } = loginList
  const [loginUsername, setLoginUsername] = useState('')
  const [loginStatus, setLoginStatus] = useState('')
  const [loginSelectedRowKeys, setLoginSelectedRowKeys] = useState([])
  const [loginExportModalVisible, setLoginExportModalVisible] = useState(false)
  const [loginImportModalVisible, setLoginImportModalVisible] = useState(false)

  // 操作日志
  const opList = useCrudList((params) => getOperationLogs(params), { defaultPerPage: 20 })
  const { data: opData, total: opTotal, loading: opLoading, page: opPage, filters: opFilters, handlePageChange: opPageChange, fetchData: fetchOpLogs } = opList
  const [opUsername, setOpUsername] = useState('')
  const [opModule, setOpModule] = useState('')
  const [opSelectedRowKeys, setOpSelectedRowKeys] = useState([])
  const [opExportModalVisible, setOpExportModalVisible] = useState(false)
  const [opImportModalVisible, setOpImportModalVisible] = useState(false)

  useEffect(() => {
    loginList.handleSearch({ username: '', status: '' })
    opList.handleSearch({ username: '', module: '' })
  }, [])

  const handleLoginSearch = () => {
    setLoginSelectedRowKeys([])
    loginList.handleSearch({ username: loginUsername, status: loginStatus })
  }

  const handleLoginReset = () => {
    setLoginUsername('')
    setLoginStatus('')
    setLoginSelectedRowKeys([])
    loginList.handleReset()
  }

  const handleOpSearch = () => {
    setOpSelectedRowKeys([])
    opList.handleSearch({ username: opUsername, module: opModule })
  }

  const handleOpReset = () => {
    setOpUsername('')
    setOpModule('')
    setOpSelectedRowKeys([])
    opList.handleReset()
  }

  const handleLoginExport = ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const hasSelected = loginSelectedRowKeys.length > 0
    const payload = {
      fields,
      file_type: finalFileType,
      export_mode: hasSelected ? 'selected' : 'filtered',
    }
    if (hasSelected) {
      payload.ids = loginSelectedRowKeys
    } else {
      payload.filters = { username: loginFilters.username ?? '', status: loginFilters.status ?? '' }
    }
    return exportLoginLogs(payload)
      .then((blob) => {
        downloadBlobFile(blob, `login_logs_export.${finalFileType}`)
        setLoginExportModalVisible(false)
        Toast.success('导出成功')
      })
      .catch((err) => {
        Toast.error(err?.error || '导出失败')
        throw err
      })
  }

  const handleOperationExport = ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const hasSelected = opSelectedRowKeys.length > 0
    const payload = {
      fields,
      file_type: finalFileType,
      export_mode: hasSelected ? 'selected' : 'filtered',
    }
    if (hasSelected) {
      payload.ids = opSelectedRowKeys
    } else {
      payload.filters = { username: opFilters.username ?? '', module: opFilters.module ?? '' }
    }
    return exportOperationLogs(payload)
      .then((blob) => {
        downloadBlobFile(blob, `operation_logs_export.${finalFileType}`)
        setOpExportModalVisible(false)
        Toast.success('导出成功')
      })
      .catch((err) => {
        Toast.error(err?.error || '导出失败')
        throw err
      })
  }

  const loginColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: 'IP 地址', dataIndex: 'ip', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v) => (
        <Tag color={v === 'success' ? 'green' : 'red'}>
          {v === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    { title: '失败原因', dataIndex: 'fail_reason' },
    { title: 'User-Agent', dataIndex: 'user_agent', ellipsis: true },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v) => v?.slice(0, 19).replace('T', ' '),
    },
  ]

  const opColumns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '用户名', dataIndex: 'username', width: 120 },
    { title: '模块', dataIndex: 'module', width: 100 },
    { title: '操作', dataIndex: 'action', width: 100 },
    {
      title: '方法',
      dataIndex: 'method',
      width: 80,
      render: (v) => <Tag color={METHOD_COLOR[v] || 'grey'}>{v}</Tag>,
    },
    { title: '路径', dataIndex: 'path', ellipsis: true },
    {
      title: '状态码',
      dataIndex: 'status_code',
      width: 80,
      render: (v) => <Tag color={v < 300 ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 170,
      render: (v) => v?.slice(0, 19).replace('T', ' '),
    },
  ]

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        日志管理
      </Typography.Title>

      <Tabs type="line">
        {/* 登录日志 */}
        <TabPane tab="登录日志" itemKey="login">
          <div style={CARD_STYLE}>
            <Space style={{ flexWrap: 'wrap' }}>
              <Input
                placeholder="搜索用户名"
                value={loginUsername}
                onChange={(v) => setLoginUsername(v)}
                onEnterPress={handleLoginSearch}
                style={{ width: isMobile ? '100%' : 160 }}
              />
              <Select
                placeholder="登录状态"
                value={loginStatus || undefined}
                onChange={(v) => setLoginStatus(v || '')}
                optionList={[
                  { label: '成功', value: 'success' },
                  { label: '失败', value: 'fail' },
                ]}
                showClear
                style={{ width: 120 }}
              />
              <Button icon={<IconSearch />} type="primary" onClick={handleLoginSearch}>查询</Button>
              <Button icon={<IconRefresh />} onClick={handleLoginReset}>重置</Button>
            </Space>
          </div>

          <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <Typography.Text strong>登录日志列表</Typography.Text>
              <Space>
                <Button onClick={() => setLoginImportModalVisible(true)}>导入</Button>
                <Button onClick={() => setLoginExportModalVisible(true)}>导出</Button>
              </Space>
            </div>
            <Table
              columns={loginColumns}
              dataSource={loginData}
              loading={loginLoading}
              rowKey="id"
              scroll={{}}
              rowSelection={{
                selectedRowKeys: loginSelectedRowKeys,
                onChange: (keys) => setLoginSelectedRowKeys(keys),
              }}
              pagination={{
                total: loginTotal,
                currentPage: loginPage,
                pageSize: 20,
                onPageChange: (p) => loginPageChange(p),
              }}
            />
            <div style={{ marginTop: 8 }}>
              <Space>
                <Typography.Text type="tertiary">已勾选 {loginSelectedRowKeys.length} 条</Typography.Text>
                {loginSelectedRowKeys.length > 0 ? (
                  <Button size="small" type="tertiary" onClick={() => setLoginSelectedRowKeys([])}>
                    清空勾选
                  </Button>
                ) : null}
              </Space>
            </div>
          </div>
        </TabPane>

        {/* 操作日志 */}
        <TabPane tab="操作日志" itemKey="operation">
          <div style={CARD_STYLE}>
            <Space style={{ flexWrap: 'wrap' }}>
              <Input
                placeholder="搜索用户名"
                value={opUsername}
                onChange={(v) => setOpUsername(v)}
                onEnterPress={handleOpSearch}
                style={{ width: isMobile ? '100%' : 160 }}
              />
              <Input
                placeholder="模块名"
                value={opModule}
                onChange={(v) => setOpModule(v)}
                onEnterPress={handleOpSearch}
                style={{ width: isMobile ? '100%' : 120 }}
              />
              <Button icon={<IconSearch />} type="primary" onClick={handleOpSearch}>查询</Button>
              <Button icon={<IconRefresh />} onClick={handleOpReset}>重置</Button>
            </Space>
          </div>

          <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
              <Typography.Text strong>操作日志列表</Typography.Text>
              <Space>
                <Button onClick={() => setOpImportModalVisible(true)}>导入</Button>
                <Button onClick={() => setOpExportModalVisible(true)}>导出</Button>
              </Space>
            </div>
            <Table
              columns={opColumns}
              dataSource={opData}
              loading={opLoading}
              rowKey="id"
              scroll={{}}
              rowSelection={{
                selectedRowKeys: opSelectedRowKeys,
                onChange: (keys) => setOpSelectedRowKeys(keys),
              }}
              pagination={{
                total: opTotal,
                currentPage: opPage,
                pageSize: 20,
                onPageChange: (p) => opPageChange(p),
              }}
            />
            <div style={{ marginTop: 8 }}>
              <Space>
                <Typography.Text type="tertiary">已勾选 {opSelectedRowKeys.length} 条</Typography.Text>
                {opSelectedRowKeys.length > 0 ? (
                  <Button size="small" type="tertiary" onClick={() => setOpSelectedRowKeys([])}>
                    清空勾选
                  </Button>
                ) : null}
              </Space>
            </div>
          </div>
        </TabPane>
      </Tabs>

      <ExportFieldsModal
        visible={loginExportModalVisible}
        title="登录日志导出字段"
        ruleHint={
          loginSelectedRowKeys.length > 0
            ? `已勾选 ${loginSelectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将按当前查询条件导出全部结果'
        }
        fieldOptions={LOGIN_EXPORT_FIELDS}
        defaultFields={['username', 'status', 'ip', 'message', 'created_at']}
        onCancel={() => setLoginExportModalVisible(false)}
        onConfirm={handleLoginExport}
      />

      <ExportFieldsModal
        visible={opExportModalVisible}
        title="操作日志导出字段"
        ruleHint={
          opSelectedRowKeys.length > 0
            ? `已勾选 ${opSelectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将按当前查询条件导出全部结果'
        }
        fieldOptions={OPERATION_EXPORT_FIELDS}
        defaultFields={['username', 'module', 'action', 'method', 'path', 'status_code', 'created_at']}
        onCancel={() => setOpExportModalVisible(false)}
        onConfirm={handleOperationExport}
      />

      <ImportCsvModal
        visible={loginImportModalVisible}
        title="导入登录日志"
        targetLabel="日志管理 / 登录日志"
        onCancel={() => setLoginImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadLoginLogsTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `login_logs_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importLoginLogs(file)}
        onImported={(res) => {
          fetchLoginLogs()
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
        }}
        errorExportFileName="login_logs_import_error_rows.csv"
      />

      <ImportCsvModal
        visible={opImportModalVisible}
        title="导入操作日志"
        targetLabel="日志管理 / 操作日志"
        onCancel={() => setOpImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadOperationLogsTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `operation_logs_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importOperationLogs(file)}
        onImported={(res) => {
          fetchOpLogs()
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
        }}
        errorExportFileName="operation_logs_import_error_rows.csv"
      />
    </div>
  )
}
