import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Button,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  SideSheet,
  Space,
  Table,
  TextArea,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import FileUploadField from '@/shared/components/upload/FileUploadField'
import ImageUploadField from '@/shared/components/upload/ImageUploadField'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  createListPage,
  deleteListPage,
  downloadListPageTemplate,
  exportListPage,
  getListPageList,
  importListPage,
  updateListPage,
  uploadListPageFile,
  uploadListPageImage,
} from '@/modules/component_center/api/list_page'


const EDITOR_SECTION_STYLE = {
  width: '100%',
  border: '1px solid var(--semi-color-border)',
  borderRadius: 8,
  padding: 14,
  background: 'var(--semi-color-bg-0)',
}

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]

const ACTIVE_OPTIONS = [
  { label: '全部启用状态', value: '' },
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const STATUS_FILTER_OPTIONS = [
  { label: '全部发布状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

const CONDITION_OPERATOR_OPTIONS = [
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'ne' },
  { label: '包含', value: 'contains' },
  { label: '不包含', value: 'not_contains' },
  { label: '大于', value: 'gt' },
  { label: '小于', value: 'lt' },
  { label: '在范围内', value: 'between' },
]

const CONDITION_LOGIC_OPTIONS = [
  { label: 'AND', value: 'AND' },
  { label: 'OR', value: 'OR' },
]

const DATA_SOURCE_OPTIONS = [
  { label: '订单表 orders', value: 'orders' },
  { label: '用户表 users', value: 'users' },
  { label: '风控表 risk_events', value: 'risk_events' },
  { label: '日志表 logs', value: 'logs' },
]

const DATA_SOURCE_FIELD_MAP = {
  orders: [
    { label: '订单号 order_no', value: 'order_no' },
    { label: '订单状态 status', value: 'status' },
    { label: '下单时间 created_at', value: 'created_at' },
    { label: '支付金额 amount', value: 'amount' },
  ],
  users: [
    { label: '用户ID user_id', value: 'user_id' },
    { label: '用户昵称 nickname', value: 'nickname' },
    { label: '注册时间 register_at', value: 'register_at' },
    { label: '会员等级 level', value: 'level' },
  ],
  risk_events: [
    { label: '事件ID event_id', value: 'event_id' },
    { label: '事件类型 event_type', value: 'event_type' },
    { label: '风险分 risk_score', value: 'risk_score' },
    { label: '创建时间 created_at', value: 'created_at' },
  ],
  logs: [
    { label: '日志ID id', value: 'id' },
    { label: '操作人 operator', value: 'operator' },
    { label: '操作模块 module', value: 'module' },
    { label: '操作时间 created_at', value: 'created_at' },
  ],
}

const ALL_FIELD_OPTIONS = Array.from(
  new Map(
    Object.values(DATA_SOURCE_FIELD_MAP)
      .flat()
      .map((item) => [item.value, item]),
  ).values(),
)

const QUERY_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '编码', value: 'query_code' },
  { label: '分类', value: 'category' },
  { label: '关键字', value: 'keyword' },
  { label: '数据源', value: 'data_source' },
  { label: '负责人', value: 'owner' },
  { label: '图片URL列表', value: 'image_urls' },
  { label: '文件URL列表', value: 'file_urls' },
  { label: '优先级', value: 'priority' },
  { label: '状态', value: 'is_active' },
  { label: '发布状态', value: 'status' },
  { label: '版本号', value: 'version' },
  { label: '更新时间', value: 'updated_at' },
]

const DEFAULT_DISPLAY_CONFIG = {
  selected_fields: ['id', 'name', 'status', 'owner', 'updated_at'],
  preview_rows: 8,
  sort_by: 'updated_at',
  sort_order: 'desc',
}

const DEFAULT_PERMISSION_CONFIG = {
  visible_roles: ['super_admin'],
  editable_roles: ['super_admin'],
}

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')
const formatDateTime = (value) => (value ? value.slice(0, 19).replace('T', ' ') : '-')
const MAX_QUERY_IMAGE_COUNT = 9
const MAX_QUERY_FILE_COUNT = 20

const normalizeUrlList = (raw) => {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item || '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const value = raw.trim()
    if (!value) {
      return []
    }
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed.map((item) => String(item || '').trim()).filter(Boolean)
      }
    } catch (error) {
      // ignore parse error
    }
    return value
      .replaceAll('，', ',')
      .replaceAll('；', ';')
      .replaceAll('\n', ';')
      .split(/[;,]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const buildUploadFileList = (urls = [], seed = 'default', namePrefix = '资源') => {
  return normalizeUrlList(urls).map((url, index) => ({
    uid: `query-upload-${seed}-${index + 1}`,
    name: `${namePrefix}${index + 1}`,
    status: 'success',
    preview: true,
    url,
  }))
}

const extractUploadedUrls = (fileList = []) => {
  return (fileList || [])
    .filter((item) => item?.status === 'success')
    .map((item) => item?.url || item?.response?.url || '')
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

const mapCategoryLabel = (value) => {
  const matched = CATEGORY_OPTIONS.find((item) => item.value === value)
  return matched?.label || value || '-'
}

const mapStatusLabel = (value) => {
  if (value === 'published') return { label: '已发布', color: 'green' }
  return { label: '草稿', color: 'grey' }
}

const normalizeConditionItems = (conditions) => {
  const items = Array.isArray(conditions?.items) ? conditions.items : []
  return items.map((item, index) => ({
    uid: `condition-${Date.now()}-${index}`,
    field: String(item?.field || ''),
    operator: String(item?.operator || 'eq'),
    value: item?.value ?? '',
    logic: String(item?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
  }))
}

const buildConditionPayload = (items = []) => {
  return {
    groups: [],
    items: items
      .map((item) => ({
        field: String(item?.field || '').trim(),
        operator: String(item?.operator || '').trim(),
        value: item?.value ?? '',
        logic: String(item?.logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND',
      }))
      .filter((item) => item.field && item.operator),
  }
}

export default function ListPage() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getListPageList(params).catch(() => {
      Toast.error('加载列表页数据失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [owner, setOwner] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const [imageFileList, setImageFileList] = useState([])
  const [attachmentFileList, setAttachmentFileList] = useState([])

  const [conditionLogic, setConditionLogic] = useState('AND')
  const [conditionItems, setConditionItems] = useState([])

  const [currentDataSource, setCurrentDataSource] = useState('')
  const [schemaConfigText, setSchemaConfigText] = useState('{}')

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const formApiRef = useRef()

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  const fieldOptions = useMemo(() => {
    if (!currentDataSource) return ALL_FIELD_OPTIONS
    return DATA_SOURCE_FIELD_MAP[currentDataSource] || ALL_FIELD_OPTIONS
  }, [currentDataSource])

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearch = () => {
    setSelectedRowKeys([])
    list.handleSearch({
      search: search.trim(),
      category: category || '',
      owner: owner.trim(),
      is_active: isActive || '',
      status: statusFilter || '',
    })
  }

  const handleReset = () => {
    setSearch('')
    setCategory('')
    setOwner('')
    setIsActive('')
    setStatusFilter('')
    setSelectedRowKeys([])
    list.handleReset()
  }

  const resetEditorState = () => {
    setImageFileList([])
    setAttachmentFileList([])
    setConditionLogic('AND')
    setConditionItems([])
    setCurrentDataSource('')
    setSchemaConfigText('{}')
  }

  const openCreate = () => {
    setEditRecord(null)
    resetEditorState()
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setCurrentDataSource(String(record?.data_source || '').trim())
    setImageFileList(buildUploadFileList(record?.image_urls || record?.image_url, `img-${record?.id || 'edit'}`, '图片'))
    setAttachmentFileList(buildUploadFileList(record?.file_urls || record?.file_url, `file-${record?.id || 'edit'}`, '附件'))

    setConditionLogic(String(record?.condition_logic || 'AND').toUpperCase() === 'OR' ? 'OR' : 'AND')
    setConditionItems(normalizeConditionItems(record?.conditions))
    setSchemaConfigText(String(record?.schema_config || '{}'))
    setModalVisible(true)
  }

  const handleAddCondition = () => {
    setConditionItems((prev) => [
      ...prev,
      {
        uid: `condition-${Date.now()}-${prev.length + 1}`,
        field: '',
        operator: 'eq',
        value: '',
        logic: 'AND',
      },
    ])
  }

  const handleChangeCondition = (uid, patch) => {
    setConditionItems((prev) => prev.map((item) => (item.uid === uid ? { ...item, ...patch } : item)))
  }

  const handleRemoveCondition = (uid) => {
    setConditionItems((prev) => prev.filter((item) => item.uid !== uid))
  }

  const handleFormatSchemaJson = () => {
    try {
      const parsed = JSON.parse(schemaConfigText || '{}')
      setSchemaConfigText(JSON.stringify(parsed, null, 2))
      Toast.success('JSON 已格式化')
    } catch (error) {
      Toast.error('JSON 格式错误，无法格式化')
    }
  }

  const handleValidateSchemaJson = () => {
    try {
      JSON.parse(schemaConfigText || '{}')
      Toast.success('JSON 校验通过')
    } catch (error) {
      Toast.error(`JSON 校验失败：${error.message}`)
    }
  }

  const collectPayload = (formValues = {}) => {
    const imageUrls = extractUploadedUrls(imageFileList)
    const fileUrls = extractUploadedUrls(attachmentFileList)
    const normalizedDisplayConfig = {
      ...DEFAULT_DISPLAY_CONFIG,
      data_source: (formValues.data_source || currentDataSource || '').trim(),
    }
    return {
      ...formValues,
      query_code: (formValues.query_code || '').trim(),
      name: (formValues.name || '').trim(),
      keyword: (formValues.keyword || '').trim(),
      owner: (formValues.owner || '').trim(),
      data_source: (formValues.data_source || '').trim(),
      description: (formValues.description || '').trim(),
      status: formValues.status || 'draft',
      image_url: imageUrls[0] || '',
      image_urls: imageUrls,
      file_url: fileUrls[0] || '',
      file_urls: fileUrls,
      condition_logic: conditionLogic,
      conditions: buildConditionPayload(conditionItems),
      display_config: normalizedDisplayConfig,
      permission_config: DEFAULT_PERMISSION_CONFIG,
      schema_config: schemaConfigText,
    }
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      const payload = collectPayload(values)
      setSubmitting(true)
      const req = editRecord?.id
        ? updateListPage(editRecord.id, payload)
        : createListPage(payload)
      req.then(() => {
        Toast.success(editRecord?.id ? '更新成功' : '创建成功')
        setModalVisible(false)
        fetchData()
      })
        .catch((err) => Toast.error(err?.error || '保存失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleDelete = (id) => {
    deleteListPage(id)
      .then(() => {
        Toast.success('删除成功')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleExport = ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const hasSelected = selectedRowKeys.length > 0
    const payload = {
      fields,
      file_type: finalFileType,
      export_mode: hasSelected ? 'selected' : 'filtered',
    }
    if (hasSelected) {
      payload.ids = selectedRowKeys
    } else {
      payload.filters = filters
    }
    exportListPage(payload)
      .then((blob) => {
        downloadBlobFile(blob, `list_page_export.${finalFileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  const conditionColumns = [
    {
      title: '逻辑',
      dataIndex: 'logic',
      width: 100,
      render: (value, record) => (
        <Select
          size="small"
          value={value}
          optionList={CONDITION_LOGIC_OPTIONS}
          onChange={(next) => handleChangeCondition(record.uid, { logic: next })}
        />
      ),
    },
    {
      title: '字段',
      dataIndex: 'field',
      width: 180,
      render: (value, record) => (
        <Select
          size="small"
          value={value}
          optionList={fieldOptions}
          placeholder="选择字段"
          onChange={(next) => handleChangeCondition(record.uid, { field: next })}
        />
      ),
    },
    {
      title: '操作符',
      dataIndex: 'operator',
      width: 140,
      render: (value, record) => (
        <Select
          size="small"
          value={value}
          optionList={CONDITION_OPERATOR_OPTIONS}
          onChange={(next) => handleChangeCondition(record.uid, { operator: next })}
        />
      ),
    },
    {
      title: '值',
      dataIndex: 'value',
      render: (value, record) => (
        <Input
          size="small"
          value={String(value ?? '')}
          placeholder="输入条件值"
          onChange={(next) => handleChangeCondition(record.uid, { value: next })}
        />
      ),
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button size="small" type="danger" theme="borderless" onClick={() => handleRemoveCondition(record.uid)}>
          删除
        </Button>
      ),
    },
  ]

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '名称', dataIndex: 'name', width: 180 },
    {
      title: '编码',
      dataIndex: 'query_code',
      width: 180,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (value) => mapCategoryLabel(value),
    },
    {
      title: '发布状态',
      dataIndex: 'status',
      width: 110,
      render: (value) => {
        const statusMeta = mapStatusLabel(value)
        return <Tag color={statusMeta.color}>{statusMeta.label}</Tag>
      },
    },
    {
      title: '版本',
      dataIndex: 'version',
      width: 80,
      render: (value) => value || 1,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 170,
      render: formatDateTime,
    },
    {
      title: '操作',
      width: 260,
      render: (_, record) => (
        <Space>
          <Button size="small" theme="borderless" onClick={() => openDetail(record)}>查看</Button>
          <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除该记录？" content="删除后不可恢复" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const initValues = editRecord || {
    category: 'general',
    status: 'draft',
    priority: 0,
    is_active: true,
    image_url: '',
    image_urls: [],
    file_url: '',
    file_urls: [],
    data_source: '',
  }

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 6 }}>
        列表页
      </Typography.Title>
      <Typography.Paragraph type="tertiary" style={{ marginBottom: 16 }}>
        标准后台能力展示：增删改查、导入导出、图片/附件上传。
      </Typography.Paragraph>

      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="名称/编码/关键字/数据源/负责人"
            value={search}
            onChange={(value) => setSearch(value)}
            onEnterPress={handleSearch}
            style={{ width: isMobile ? '100%' : 280 }}
          />
          <Select
            style={{ width: 140 }}
            value={category}
            optionList={[{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]}
            onChange={(value) => setCategory(value)}
          />
          <Input
            placeholder="负责人"
            value={owner}
            onChange={(value) => setOwner(value)}
            onEnterPress={handleSearch}
            style={{ width: 140 }}
          />
          <Select
            style={{ width: 130 }}
            value={isActive}
            optionList={ACTIVE_OPTIONS}
            onChange={(value) => setIsActive(value)}
          />
          <Select
            style={{ width: 130 }}
            value={statusFilter}
            optionList={STATUS_FILTER_OPTIONS}
            onChange={(value) => setStatusFilter(value)}
          />
          <Button icon={<IconSearch />} type="primary" onClick={handleSearch}>查询</Button>
          <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <Typography.Text strong>列表页数据</Typography.Text>
          <Space>
            <Button onClick={() => setImportModalVisible(true)}>导入</Button>
            <Button onClick={() => setExportModalVisible(true)}>导出</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>
              新建记录
            </Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          scroll={{}}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={{
            total,
            currentPage: page,
            pageSize: 20,
            onPageChange: (nextPage) => handlePageChange(nextPage),
          }}
        />
      </div>

      <Modal
        title={editRecord?.id ? '编辑记录' : '新建记录'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okText={formApiRef.current?.getValue?.('status') === 'published' ? '保存并发布' : '保存草稿'}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 980}
        afterClose={() => {
          formApiRef.current?.reset()
          resetEditorState()
        }}
      >
        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={initValues}
          labelPosition="top"
          style={{ maxHeight: '72vh', overflow: 'auto', paddingRight: 4 }}
        >
          <Space vertical align="start" style={{ width: '100%' }} spacing={14}>
            <div style={EDITOR_SECTION_STYLE}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>基础信息</Typography.Text>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, width: '100%' }}>
                <Form.Input
                  field="name"
                  label="名称"
                  rules={[{ required: true, message: '请输入名称' }]}
                />
                <Form.Input
                  field="query_code"
                  label="编码"
                  placeholder="例如：order_main_query"
                  rules={[{ required: true, message: '请输入编码' }]}
                  disabled={Boolean(editRecord?.id)}
                />
                <Form.Select field="category" label="分类" optionList={CATEGORY_OPTIONS} style={{ width: '100%' }} />
                <Form.Select field="status" label="发布状态" optionList={STATUS_OPTIONS} style={{ width: '100%' }} />
                <Form.Input field="owner" label="负责人" placeholder="例如：admin" />
                <Form.Select
                  field="data_source"
                  label="数据源"
                  optionList={DATA_SOURCE_OPTIONS}
                  style={{ width: '100%' }}
                  placeholder="选择数据源"
                  onChange={(value) => {
                    setCurrentDataSource(String(value || ''))
                  }}
                />
              </div>
              <Form.Input field="keyword" label="关键字" placeholder="多个关键字用逗号分隔" />
              <Form.TextArea field="description" label="描述" rows={3} maxCount={500} />
              <Space>
                <Form.Switch field="is_active" label="启用" />
                <Form.InputNumber field="priority" label="优先级" min={0} max={9999} />
              </Space>
            </div>

            <div style={EDITOR_SECTION_STYLE}>
              <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                <Typography.Text strong>条件构建器</Typography.Text>
                <Space>
                  <Typography.Text>全局逻辑</Typography.Text>
                  <Select value={conditionLogic} optionList={CONDITION_LOGIC_OPTIONS} onChange={setConditionLogic} style={{ width: 120 }} />
                  <Button icon={<IconPlus />} onClick={handleAddCondition}>新增条件</Button>
                </Space>
              </Space>
              <Table
                rowKey="uid"
                columns={conditionColumns}
                dataSource={conditionItems}
                pagination={false}
                empty={<Empty description="暂无条件，点击“新增条件”开始配置" />}
              />
            </div>

            <div style={EDITOR_SECTION_STYLE}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>高级配置</Typography.Text>
              <Space vertical align="start" style={{ width: '100%' }} spacing={12}>
                <Space>
                  <Button size="small" onClick={handleFormatSchemaJson}>格式化 JSON</Button>
                  <Button size="small" onClick={handleValidateSchemaJson}>校验 JSON</Button>
                </Space>
                <TextArea
                  value={schemaConfigText}
                  rows={8}
                  placeholder="输入 JSON Schema 配置"
                  onChange={setSchemaConfigText}
                />
                <Form.Slot label="图片">
                  <ImageUploadField
                    fileList={imageFileList}
                    onFileListChange={setImageFileList}
                    uploadApi={uploadListPageImage}
                    limit={MAX_QUERY_IMAGE_COUNT}
                    accept=".jpg,.jpeg,.png,.gif,.webp"
                    maxSizeMB={5}
                    promptText={`照片墙上传，最多 ${MAX_QUERY_IMAGE_COUNT} 张，支持 JPG/PNG/GIF/WEBP，最大 5MB`}
                    imageSize={108}
                  />
                </Form.Slot>
                <Form.Slot label="附件">
                  <FileUploadField
                    fileList={attachmentFileList}
                    onFileListChange={setAttachmentFileList}
                    uploadApi={uploadListPageFile}
                    limit={MAX_QUERY_FILE_COUNT}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.7z,.json,.ppt,.pptx"
                    maxSizeMB={20}
                    promptText={`最多 ${MAX_QUERY_FILE_COUNT} 个附件，支持文档/表格/压缩包，最大 20MB`}
                    triggerText="上传附件"
                  />
                </Form.Slot>
              </Space>
            </div>

          </Space>
        </Form>
      </Modal>

      <ExportFieldsModal
        visible={exportModalVisible}
        title="列表页导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将按当前筛选条件导出'
        }
        fieldOptions={QUERY_EXPORT_FIELDS}
        defaultFields={['name', 'query_code', 'category', 'owner', 'status', 'version', 'updated_at']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importModalVisible}
        title="导入列表页数据"
        targetLabel="列表页"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `list_page_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importListPage(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="list_page_import_error_rows.csv"
      />

      {/* ── 详情抽屉 ── */}
      <SideSheet
        title="记录详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={isMobile ? '100vw' : 540}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => {
                setDetailVisible(false)
                openEdit(detailRecord)
              }}
            >
              编辑
            </Button>
          </div>
        }
      >
        {detailRecord && (
          <div>
            {[
              ['ID', detailRecord.id],
              ['名称', detailRecord.name],
              ['编码', <Tag key="code">{detailRecord.query_code}</Tag>],
              ['分类', mapCategoryLabel(detailRecord.category)],
              ['发布状态', (() => { const m = mapStatusLabel(detailRecord.status); return <Tag key="s" color={m.color}>{m.label}</Tag> })()],
              ['版本', detailRecord.version || 1],
              ['负责人', detailRecord.owner || '-'],
              ['数据源', detailRecord.data_source || '-'],
              ['关键字', detailRecord.keyword || '-'],
              ['启用', <Tag key="active" color={detailRecord.is_active ? 'green' : 'grey'}>{detailRecord.is_active ? '启用' : '停用'}</Tag>],
              ['优先级', detailRecord.priority ?? 0],
              ['发布时间', detailRecord.published_at ? formatDateTime(detailRecord.published_at) : '-'],
              ['创建时间', formatDateTime(detailRecord.created_at)],
              ['更新时间', formatDateTime(detailRecord.updated_at)],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
                <Typography.Text type="tertiary" style={{ width: 88, flexShrink: 0, paddingTop: 2 }}>{label}</Typography.Text>
                <Typography.Text style={{ flex: 1 }}>{val}</Typography.Text>
              </div>
            ))}
            {detailRecord.description && (
              <>
                <Divider margin="16px 0 12px" />
                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>描述</Typography.Text>
                <Typography.Paragraph>{detailRecord.description}</Typography.Paragraph>
              </>
            )}
            {detailRecord.image_urls?.length > 0 && (
              <>
                <Divider margin="16px 0 12px" />
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>图片</Typography.Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {detailRecord.image_urls.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`图片${i + 1}`}
                      style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--semi-color-border)' }}
                    />
                  ))}
                </div>
              </>
            )}
            {detailRecord.file_urls?.length > 0 && (
              <>
                <Divider margin="16px 0 12px" />
                <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>附件</Typography.Text>
                <Space vertical align="start">
                  {detailRecord.file_urls.map((url, i) => (
                    <Typography.Text key={i} link={{ href: url, target: '_blank' }}>
                      附件 {i + 1}
                    </Typography.Text>
                  ))}
                </Space>
              </>
            )}
          </div>
        )}
      </SideSheet>
    </div>
  )
}
