import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  ArrayField,
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  SideSheet,
  Space,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui'
import { IconCode, IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  createDynamicFormPage,
  deleteDynamicFormPage,
  downloadDynamicFormPageTemplate,
  exportDynamicFormPage,
  getDynamicFormPageDetail,
  getDynamicFormPageList,
  importDynamicFormPage,
  updateDynamicFormPage,
} from '@/modules/component_center/api/dynamic_form_page'

// ── 样式常量（与其他页面保持一致）──────────────────────────────────

// ── 常量 ──────────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '配置', value: 'config' },
  { label: '档案', value: 'profile' },
  { label: '规格', value: 'spec' },
]
const CATEGORY_LABEL = { general: '通用', config: '配置', profile: '档案', spec: '规格' }
const CATEGORY_COLOR = { general: 'blue', config: 'orange', profile: 'teal', spec: 'purple' }

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]
const STATUS_FILTER_OPTIONS = [{ label: '全部状态', value: '' }, ...STATUS_OPTIONS]
const STATUS_META = {
  draft: { label: '草稿', color: 'grey' },
  published: { label: '已发布', color: 'green' },
  archived: { label: '已归档', color: 'orange' },
}

const FIELD_TYPE_OPTIONS = [
  { label: '文本', value: 'text' },
  { label: '数字', value: 'number' },
  { label: '布尔', value: 'boolean' },
  { label: '日期', value: 'date' },
]
const FIELD_TYPE_COLOR = { text: 'blue', number: 'orange', boolean: 'green', date: 'purple' }
const FIELD_TYPE_LABEL = { text: '文本', number: '数字', boolean: '布尔', date: '日期' }

const ACTIVE_OPTIONS = [
  { label: '全部启用状态', value: '' },
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '标题', value: 'title' },
  { label: '记录编码', value: 'record_code' },
  { label: '分类', value: 'category' },
  { label: '发布状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '字段数量', value: 'fields_count' },
  { label: '启用', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const EMPTY_FIELD_ROW = { field_key: '', field_value: '', field_type: 'text', remark: '' }
const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'csv')

// ── 主组件 ────────────────────────────────────────────────────────────
export default function DynamicFormPage() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getDynamicFormPageList(params).catch(() => {
      Toast.error('加载动态表单数据失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data: items, total, loading, page, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterActive, setFilterActive] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const formApiRef = useRef()

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  // ── 数据拉取 ──────────────────────────────────────────────────────
  useEffect(() => { fetchData() }, [])

  const handleSearch = () => {
    setSelectedRowKeys([])
    list.handleSearch({
      search: search.trim(),
      category: filterCategory,
      status: filterStatus,
      is_active: filterActive,
    })
  }

  const handleReset = () => {
    setSearch('')
    setFilterCategory('')
    setFilterStatus('')
    setFilterActive('')
    setSelectedRowKeys([])
    list.handleReset()
  }

  // ── CRUD ──────────────────────────────────────────────────────────
  const openCreate = () => { setEditRecord(null); setModalVisible(true) }
  const openEdit = (record) => { setEditRecord(record); setModalVisible(true) }

  const openDetail = (record) => {
    setDetailRecord(null)
    setDetailVisible(true)
    getDynamicFormPageDetail(record.id)
      .then((res) => setDetailRecord(res))
      .catch((err) => Toast.error(err?.error || '详情加载失败'))
  }

  const handleDelete = (id) => {
    deleteDynamicFormPage(id)
      .then(() => { Toast.success('删除成功'); fetchData() })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleSubmit = () => {
    formApiRef.current?.validate().then((values) => {
      setSubmitting(true)
      const cleanFields = (values.fields || [])
        .filter((f) => String(f?.field_key || '').trim())
        .map((f, idx) => ({ ...f, sort_order: idx }))
      const payload = { ...values, fields: cleanFields }
      const promise = editRecord?.id
        ? updateDynamicFormPage(editRecord.id, payload)
        : createDynamicFormPage(payload)
      promise
        .then(() => {
          Toast.success(editRecord?.id ? '更新成功' : '创建成功')
          setModalVisible(false)
          fetchData()
        })
        .catch((err) => Toast.error(err?.error || '保存失败'))
        .finally(() => setSubmitting(false))
    }).catch(() => {})
  }

  const initValues = editRecord
    ? {
        title: editRecord.title,
        record_code: editRecord.record_code,
        category: editRecord.category || 'general',
        status: editRecord.status || 'draft',
        owner: editRecord.owner || '',
        priority: editRecord.priority ?? 0,
        is_active: editRecord.is_active !== false,
        description: editRecord.description || '',
        fields: editRecord.fields?.length ? editRecord.fields : [{ ...EMPTY_FIELD_ROW }],
      }
    : {
        category: 'general',
        status: 'draft',
        is_active: true,
        priority: 0,
        fields: [{ ...EMPTY_FIELD_ROW }],
      }

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = ({ fields, fileType }) => {
    const ft = normalizeFileType(fileType)
    const payload = {
      fields,
      file_type: ft,
      export_mode: selectedRowKeys.length > 0 ? 'selected' : 'filtered',
      ids: selectedRowKeys.length > 0 ? selectedRowKeys : undefined,
      filters,
    }
    exportDynamicFormPage(payload)
      .then((blob) => {
        downloadBlobFile(blob, `dynamic_form_page_export.${ft}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  // ── 表格列 ────────────────────────────────────────────────────────
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    {
      title: '标题',
      dataIndex: 'title',
      render: (v) => <Typography.Text strong>{v}</Typography.Text>,
    },
    {
      title: '编码',
      dataIndex: 'record_code',
      width: 160,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (v) => <Tag color={CATEGORY_COLOR[v] || 'grey'}>{CATEGORY_LABEL[v] || v || '-'}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v) => {
        const m = STATUS_META[v] || { label: v, color: 'grey' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 100,
      render: (v) => v || '-',
    },
    {
      title: '字段数',
      dataIndex: 'fields_count',
      width: 80,
      render: (v) => (
        <Tag color="blue" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {v || 0} 条
        </Tag>
      ),
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 70,
      render: (v) => <Tag color={v ? 'green' : 'grey'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      render: (v) => (v ? v.slice(0, 19).replace('T', ' ') : '-'),
    },
    {
      title: '操作',
      width: 200,
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

  // ── 渲染 ──────────────────────────────────────────────────────────
  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 6 }}>
        动态表单页
      </Typography.Title>
      <Typography.Paragraph type="tertiary" style={{ marginBottom: 16 }}>
        展示 Form.ArrayField 动态增删字段行：每条记录含基础信息 + 可配置的键值对参数列表。
      </Typography.Paragraph>

      {/* 搜索栏 */}
      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="标题 / 编码 / 负责人"
            value={search}
            onChange={(v) => setSearch(v)}
            onEnterPress={handleSearch}
            style={{ width: isMobile ? '100%' : 240 }}
          />
          <Select
            style={{ width: 130 }}
            value={filterCategory}
            optionList={[{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]}
            onChange={(v) => setFilterCategory(v)}
          />
          <Select
            style={{ width: 130 }}
            value={filterStatus}
            optionList={STATUS_FILTER_OPTIONS}
            onChange={(v) => setFilterStatus(v)}
          />
          <Select
            style={{ width: 140 }}
            value={filterActive}
            optionList={ACTIVE_OPTIONS}
            onChange={(v) => setFilterActive(v)}
          />
          <Button icon={<IconSearch />} type="primary" onClick={handleSearch}>查询</Button>
          <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      {/* 表格区 */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Typography.Text strong>动态表单记录</Typography.Text>
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
          dataSource={items}
          rowKey="id"
          loading={loading}
          scroll={{}}
          rowSelection={{ selectedRowKeys, onChange: (keys) => setSelectedRowKeys(keys) }}
          pagination={{
            total,
            currentPage: page,
            pageSize: 20,
            onPageChange: (p) => handlePageChange(p),
          }}
        />
      </div>

      {/* ── 新建/编辑 Modal ── */}
      <Modal
        title={
          <Space>
            <IconCode />
            <span>{editRecord?.id ? '编辑记录' : '新建记录'}</span>
          </Space>
        }
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 760}
        bodyStyle={{ maxHeight: '72vh', overflowY: 'auto' }}
        afterClose={() => { formApiRef.current?.reset(); setEditRecord(null) }}
      >
        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={initValues}
          labelPosition="top"
        >
          {/* 基础信息 */}
          <Typography.Text strong style={{ display: 'block', marginBottom: 12, color: 'var(--semi-color-text-0)' }}>
            基础信息
          </Typography.Text>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Form.Input
              field="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            />
            <Form.Input
              field="record_code"
              label="记录编码"
              placeholder="例如：form_001"
              rules={[{ required: true, message: '请输入记录编码' }]}
              disabled={Boolean(editRecord?.id)}
            />
            <Form.Select
              field="category"
              label="分类"
              optionList={CATEGORY_OPTIONS}
              style={{ width: '100%' }}
            />
            <Form.Select
              field="status"
              label="发布状态"
              optionList={STATUS_OPTIONS}
              style={{ width: '100%' }}
            />
            <Form.Input field="owner" label="负责人" placeholder="例如：admin" />
            <Form.InputNumber
              field="priority"
              label="优先级"
              min={0}
              max={9999}
              style={{ width: '100%' }}
            />
          </div>
          <Space style={{ marginTop: 4, marginBottom: 16 }}>
            <Form.Switch field="is_active" label="启用" />
          </Space>

          <Divider margin="0 0 16px" />

          {/* 动态字段区域 */}
          <ArrayField field="fields">
            {({ arrayFields, addWithInitValue }) => (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Typography.Text strong>
                    动态字段
                    <Tag size="small" color="blue" style={{ marginLeft: 6 }}>
                      {arrayFields.length} / 20
                    </Tag>
                  </Typography.Text>
                  <Button
                    size="small"
                    theme="light"
                    type="primary"
                    icon={<IconPlus />}
                    disabled={arrayFields.length >= 20}
                    onClick={() => addWithInitValue({ ...EMPTY_FIELD_ROW })}
                  >
                    添加字段
                  </Button>
                </div>

                {/* 列头 */}
                {arrayFields.length > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '3fr 4fr 2fr 2fr 48px',
                    gap: 8,
                    padding: '4px 0 8px',
                    borderBottom: '1px solid var(--semi-color-border)',
                    marginBottom: 4,
                  }}>
                    {['字段键 *', '字段值', '类型', '备注', ''].map((h) => (
                      <Typography.Text key={h} size="small" type="tertiary">{h}</Typography.Text>
                    ))}
                  </div>
                )}

                {/* 字段行 */}
                {arrayFields.map(({ field, key, remove }, rowIdx) => (
                  <div
                    key={key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '3fr 4fr 2fr 2fr 48px',
                      gap: 8,
                      alignItems: 'flex-start',
                      padding: '8px 6px',
                      marginBottom: 2,
                      borderRadius: 4,
                      background: rowIdx % 2 === 0 ? 'transparent' : 'var(--semi-color-fill-0)',
                    }}
                  >
                    <Form.Input
                      field={`${field}.field_key`}
                      noLabel
                      placeholder="字段键"
                      rules={[{ required: true, message: '必填' }]}
                    />
                    <Form.Input field={`${field}.field_value`} noLabel placeholder="字段值" />
                    <Form.Select
                      field={`${field}.field_type`}
                      noLabel
                      optionList={FIELD_TYPE_OPTIONS}
                      style={{ width: '100%' }}
                    />
                    <Form.Input field={`${field}.remark`} noLabel placeholder="备注" />
                    <Button
                      size="small"
                      theme="borderless"
                      type="danger"
                      style={{ marginTop: 6 }}
                      onClick={remove}
                    >
                      移除
                    </Button>
                  </div>
                ))}

                {arrayFields.length === 0 && (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '24px 0',
                      border: '1px dashed var(--semi-color-border)',
                      borderRadius: 8,
                      cursor: 'pointer',
                      color: 'var(--semi-color-text-2)',
                    }}
                    onClick={() => addWithInitValue({ ...EMPTY_FIELD_ROW })}
                  >
                    <IconPlus style={{ marginRight: 4 }} />
                    点击添加第一个字段
                  </div>
                )}
              </div>
            )}
          </ArrayField>

          <Divider margin="16px 0 8px" />
          <Form.TextArea field="description" label="描述" rows={3} maxCount={300} />
        </Form>
      </Modal>

      {/* ── 详情抽屉 ── */}
      <SideSheet
        title="记录详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={isMobile ? '100vw' : 520}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setDetailVisible(false)}>关闭</Button>
            <Button
              theme="solid"
              type="primary"
              onClick={() => { setDetailVisible(false); if (detailRecord) openEdit(detailRecord) }}
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
              ['标题', detailRecord.title],
              ['编码', <Tag key="code">{detailRecord.record_code}</Tag>],
              ['分类', <Tag key="cat" color={CATEGORY_COLOR[detailRecord.category] || 'grey'}>{CATEGORY_LABEL[detailRecord.category] || detailRecord.category}</Tag>],
              ['状态', (() => { const m = STATUS_META[detailRecord.status] || { label: detailRecord.status, color: 'grey' }; return <Tag key="s" color={m.color}>{m.label}</Tag> })()],
              ['负责人', detailRecord.owner || '-'],
              ['优先级', detailRecord.priority ?? 0],
              ['启用', <Tag key="active" color={detailRecord.is_active ? 'green' : 'grey'}>{detailRecord.is_active ? '启用' : '停用'}</Tag>],
              ['字段数量', detailRecord.fields?.length ?? 0],
              ['创建时间', detailRecord.created_at ? detailRecord.created_at.slice(0, 19).replace('T', ' ') : '-'],
              ['更新时间', detailRecord.updated_at ? detailRecord.updated_at.slice(0, 19).replace('T', ' ') : '-'],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid var(--semi-color-border)' }}>
                <Typography.Text type="tertiary" style={{ width: 88, flexShrink: 0, paddingTop: 2 }}>{label}</Typography.Text>
                <Typography.Text style={{ flex: 1 }}>{val}</Typography.Text>
              </div>
            ))}

            {detailRecord.fields?.length > 0 && (
              <>
                <Divider margin="16px 0 12px" />
                <Typography.Text strong style={{ display: 'block', marginBottom: 10 }}>
                  动态字段（{detailRecord.fields.length} 条）
                </Typography.Text>
                <Table
                  size="small"
                  dataSource={detailRecord.fields}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: '字段键', dataIndex: 'field_key', render: (v) => <Tag>{v}</Tag> },
                    { title: '字段值', dataIndex: 'field_value', render: (v) => v || '-' },
                    {
                      title: '类型', dataIndex: 'field_type', width: 70,
                      render: (v) => <Tag size="small" color={FIELD_TYPE_COLOR[v] || 'grey'}>{FIELD_TYPE_LABEL[v] || v}</Tag>,
                    },
                    { title: '备注', dataIndex: 'remark', render: (v) => v || '-' },
                  ]}
                />
              </>
            )}

            {detailRecord.description && (
              <>
                <Divider margin="16px 0 12px" />
                <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>描述</Typography.Text>
                <Typography.Paragraph>{detailRecord.description}</Typography.Paragraph>
              </>
            )}
          </div>
        )}
      </SideSheet>

      {/* ── 导出 ── */}
      <ExportFieldsModal
        visible={exportModalVisible}
        title="动态表单页导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选时，将按当前筛选条件导出'
        }
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['title', 'record_code', 'category', 'status', 'owner', 'fields_count', 'updated_at']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      {/* ── 导入 ── */}
      <ImportCsvModal
        visible={importModalVisible}
        title="导入动态表单页数据"
        targetLabel="动态表单页"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) => {
          const ext = normalizeFileType(fileType)
          downloadDynamicFormPageTemplate(ext)
            .then((blob) => {
              downloadBlobFile(blob, `dynamic_form_page_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }}
        onImport={(file) => importDynamicFormPage(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="dynamic_form_page_import_error_rows.csv"
      />
    </div>
  )
}
