import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Button,
  Divider,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  SideSheet,
  Space,
  Steps,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  createStatsListPage,
  deleteStatsListPage,
  downloadStatsListPageTemplate,
  exportStatsListPage,
  getStatsListPageList,
  getStatsListPageStats,
  importStatsListPage,
  updateStatsListPage,
} from '@/modules/component_center/api/stats_list_page'


const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]

const STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const ACTIVE_OPTIONS = [
  { label: '全部启用状态', value: '' },
  { label: '启用', value: 'true' },
  { label: '停用', value: 'false' },
]

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  { label: '编码', value: 'item_code' },
  { label: '分类', value: 'category' },
  { label: '发布状态', value: 'status' },
  { label: '金额', value: 'amount' },
  { label: '数量', value: 'quantity' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '启用状态', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const CATEGORY_LABEL_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]))

const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')
const formatDateTime = (value) => (value ? value.slice(0, 19).replace('T', ' ') : '-')
const formatAmount = (value) =>
  typeof value === 'number' ? `¥ ${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'

const mapStatusMeta = (value) => {
  if (value === 'published') return { label: '已发布', color: 'green' }
  if (value === 'archived') return { label: '已归档', color: 'grey' }
  return { label: '草稿', color: 'light-blue' }
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ title, value, subValue, subLabel, color = '#4f46e5', loading }) {
  return (
    <div
      style={{
        flex: '1 1 180px',
        background: 'var(--semi-color-bg-1)',
        borderRadius: 10,
        padding: '16px 20px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)',
        borderTop: `3px solid ${color}`,
        minWidth: 0,
      }}
    >
      <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>
        {title}
      </Typography.Text>
      <Typography.Title heading={3} style={{ margin: 0, color, lineHeight: 1.2 }}>
        {loading ? '…' : value}
      </Typography.Title>
      {subValue !== undefined && (
        <Typography.Text type="tertiary" size="small" style={{ marginTop: 4, display: 'block' }}>
          {subLabel}：{loading ? '…' : subValue}
        </Typography.Text>
      )}
    </div>
  )
}

// ─── Category Bar ─────────────────────────────────────────────────────────────

function CategoryBar({ categoryStats = [], total = 0, loading }) {
  if (loading || !categoryStats.length) return null
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
      <Typography.Text type="tertiary" size="small">分类分布：</Typography.Text>
      {categoryStats.map((item) => {
        const pct = total > 0 ? Math.round((item.count / total) * 100) : 0
        return (
          <Tag key={item.category} color="blue" size="small">
            {CATEGORY_LABEL_MAP[item.category] || item.category} {item.count} ({pct}%)
          </Tag>
        )
      })}
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function StatsListPage() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getStatsListPageList(params).catch(() => {
      Toast.error('加载数据失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handlePageChange } = list

  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [owner, setOwner] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const [currentStep, setCurrentStep] = useState(0)

  const formApiRef = useRef()

  // 每步对应需要校验的字段
  const STEP_FIELDS = [
    ['name', 'item_code'],   // step 0
    [],                       // step 1 — 数值无必填
    [],                       // step 2 — 发布设置无必填
  ]
  const TOTAL_STEPS = 3

  const handleStepNext = () => {
    const fields = STEP_FIELDS[currentStep]
    const validate = fields.length
      ? formApiRef.current.validate(fields)
      : Promise.resolve()
    validate
      .then(() => setCurrentStep((s) => s + 1))
      .catch(() => {})
  }

  const handleStepPrev = () => setCurrentStep((s) => s - 1)

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  const fetchStats = () => {
    setStatsLoading(true)
    getStatsListPageStats()
      .then((res) => setStats(res))
      .catch(() => {})
      .finally(() => setStatsLoading(false))
  }

  useEffect(() => {
    fetchStats()
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

  const openCreate = () => {
    setEditRecord(null)
    setCurrentStep(0)
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setCurrentStep(0)
    setModalVisible(true)
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      const req = editRecord?.id
        ? updateStatsListPage(editRecord.id, values)
        : createStatsListPage(values)
      req
        .then(() => {
          Toast.success(editRecord?.id ? '更新成功' : '创建成功')
          setModalVisible(false)
          fetchStats()
          fetchData()
        })
        .catch((err) => Toast.error(err?.error || '保存失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleDelete = (id) => {
    deleteStatsListPage(id)
      .then(() => {
        Toast.success('删除成功')
        fetchStats()
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
    exportStatsListPage(payload)
      .then((blob) => {
        downloadBlobFile(blob, `stats_list_page_export.${finalFileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 65 },
    { title: '名称', dataIndex: 'name', width: 160 },
    {
      title: '编码',
      dataIndex: 'item_code',
      width: 160,
      render: (value) => <Tag>{value}</Tag>,
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 90,
      render: (value) => CATEGORY_LABEL_MAP[value] || value || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value) => {
        const meta = mapStatusMeta(value)
        return <Tag color={meta.color}>{meta.label}</Tag>
      },
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 130,
      render: formatAmount,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      width: 80,
      render: (value) => (value ?? 0).toLocaleString(),
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      width: 100,
      render: (value) => value || '-',
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 70,
      render: (value) => (
        <Tag color={value ? 'green' : 'grey'}>{value ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      render: formatDateTime,
    },
    {
      title: '操作',
      width: 210,
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
    amount: 0,
    quantity: 0,
    priority: 0,
    is_active: true,
  }

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 6 }}>
        统计列表页
      </Typography.Title>
      <Typography.Paragraph type="tertiary" style={{ marginBottom: 16 }}>
        在标准列表页基础上，顶部增加统计卡片展示关键指标：总量、发布、金额、分类分布。
      </Typography.Paragraph>

      {/* ── 统计卡片 ── */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatCard
          title="总记录数"
          value={stats?.total ?? 0}
          subValue={stats?.active_count ?? 0}
          subLabel="已启用"
          color="#4f46e5"
          loading={statsLoading}
        />
        <StatCard
          title="已发布"
          value={stats?.published_count ?? 0}
          subValue={stats?.draft_count ?? 0}
          subLabel="草稿"
          color="#10b981"
          loading={statsLoading}
        />
        <StatCard
          title="已归档"
          value={stats?.archived_count ?? 0}
          subValue={stats ? stats.total - stats.active_count : 0}
          subLabel="已停用"
          color="#f59e0b"
          loading={statsLoading}
        />
        <StatCard
          title="总金额"
          value={stats ? `¥ ${Number(stats.total_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '¥ 0.00'}
          subValue={stats ? `¥ ${Number(stats.avg_amount).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '¥ 0.00'}
          subLabel="均值"
          color="#ef4444"
          loading={statsLoading}
        />
      </div>

      {/* ── 分类分布 ── */}
      {stats?.category_stats?.length > 0 && (
        <div style={{ ...CARD_STYLE, padding: '10px 16px' }}>
          <CategoryBar categoryStats={stats.category_stats} total={stats.total} loading={statsLoading} />
        </div>
      )}

      {/* ── 搜索栏 ── */}
      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="名称 / 编码 / 负责人"
            value={search}
            onChange={(value) => setSearch(value)}
            onEnterPress={handleSearch}
            style={{ width: isMobile ? '100%' : 240 }}
          />
          <Select
            style={{ width: 130 }}
            value={category}
            optionList={[{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]}
            onChange={(value) => setCategory(value)}
          />
          <Input
            placeholder="负责人"
            value={owner}
            onChange={(value) => setOwner(value)}
            onEnterPress={handleSearch}
            style={{ width: 130 }}
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

      {/* ── 数据表格 ── */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <Typography.Text strong>数据列表</Typography.Text>
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

      {/* ── 新建/编辑 Modal（分步表单）── */}
      <Modal
        title={editRecord?.id ? '编辑记录' : '新建记录'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography.Text type="tertiary" size="small">
              第 {currentStep + 1} 步，共 {TOTAL_STEPS} 步
            </Typography.Text>
            <Space>
              <Button onClick={() => setModalVisible(false)}>取消</Button>
              {currentStep > 0 && (
                <Button onClick={handleStepPrev}>上一步</Button>
              )}
              {currentStep < TOTAL_STEPS - 1 ? (
                <Button theme="solid" type="primary" onClick={handleStepNext}>
                  下一步
                </Button>
              ) : (
                <Button theme="solid" type="primary" loading={submitting} onClick={handleSubmit}>
                  {editRecord?.id ? '保存' : '提交'}
                </Button>
              )}
            </Space>
          </div>
        }
        width={isMobile ? '95vw' : 600}
        afterClose={() => {
          formApiRef.current?.reset()
          setEditRecord(null)
          setCurrentStep(0)
        }}
      >
        {/* 步骤指示器 */}
        <Steps
          type="basic"
          current={currentStep}
          style={{ marginBottom: 24 }}
        >
          <Steps.Step title="基础信息" description="名称与分类" />
          <Steps.Step title="数值配置" description="金额与数量" />
          <Steps.Step title="发布设置" description="状态与描述" />
        </Steps>

        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={initValues}
          labelPosition="top"
        >
          {/* Step 0：基础信息 */}
          <div style={{ display: currentStep === 0 ? 'block' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Form.Input
                field="name"
                label="名称"
                rules={[{ required: true, message: '请输入名称' }]}
              />
              <Form.Input
                field="item_code"
                label="编码"
                placeholder="例如：item_001"
                rules={[{ required: true, message: '请输入编码' }]}
                disabled={Boolean(editRecord?.id)}
              />
              <Form.Select
                field="category"
                label="分类"
                optionList={CATEGORY_OPTIONS}
                style={{ width: '100%' }}
              />
              <Form.Input field="owner" label="负责人" placeholder="例如：admin" />
            </div>
          </div>

          {/* Step 1：数值配置 */}
          <div style={{ display: currentStep === 1 ? 'block' : 'none' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
              <Form.InputNumber
                field="amount"
                label="金额"
                min={0}
                step={0.01}
                precision={2}
                style={{ width: '100%' }}
              />
              <Form.InputNumber
                field="quantity"
                label="数量"
                min={0}
                style={{ width: '100%' }}
              />
              <Form.InputNumber
                field="priority"
                label="优先级"
                min={0}
                max={9999}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 4 }}>
                <Form.Switch field="is_active" label="启用" />
              </div>
            </div>
          </div>

          {/* Step 2：发布设置 */}
          <div style={{ display: currentStep === 2 ? 'block' : 'none' }}>
            <Form.Select
              field="status"
              label="发布状态"
              optionList={STATUS_OPTIONS}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <Form.TextArea field="description" label="描述" rows={4} maxCount={300} />
            {/* 汇总预览 */}
            {formApiRef.current && (
              <div style={{
                marginTop: 16,
                padding: '12px 16px',
                background: 'var(--semi-color-fill-0)',
                borderRadius: 8,
                border: '1px solid var(--semi-color-border)',
              }}>
                <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 8 }}>
                  信息确认
                </Typography.Text>
                {[
                  ['名称', formApiRef.current.getValue('name')],
                  ['编码', formApiRef.current.getValue('item_code')],
                  ['分类', CATEGORY_OPTIONS.find(o => o.value === formApiRef.current.getValue('category'))?.label || '-'],
                  ['金额', `¥ ${formApiRef.current.getValue('amount') ?? 0}`],
                  ['数量', formApiRef.current.getValue('quantity') ?? 0],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                    <Typography.Text type="tertiary" style={{ width: 60, flexShrink: 0 }}>{label}</Typography.Text>
                    <Typography.Text>{String(val ?? '-')}</Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Form>
      </Modal>

      <ExportFieldsModal
        visible={exportModalVisible}
        title="统计列表页导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将按当前筛选条件导出'
        }
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['name', 'item_code', 'category', 'status', 'amount', 'quantity', 'owner', 'updated_at']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importModalVisible}
        title="导入统计列表页数据"
        targetLabel="统计列表页"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadStatsListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `stats_list_page_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importStatsListPage(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchStats()
          fetchData()
        }}
        errorExportFileName="stats_list_page_import_error_rows.csv"
      />

      {/* ── 详情抽屉 ── */}
      <SideSheet
        title="记录详情"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        width={isMobile ? '100vw' : 480}
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
              ['编码', <Tag key="code">{detailRecord.item_code}</Tag>],
              ['分类', CATEGORY_LABEL_MAP[detailRecord.category] || detailRecord.category || '-'],
              ['发布状态', (() => { const m = mapStatusMeta(detailRecord.status); return <Tag key="s" color={m.color}>{m.label}</Tag> })()],
              ['金额', formatAmount(detailRecord.amount)],
              ['数量', (detailRecord.quantity ?? 0).toLocaleString()],
              ['负责人', detailRecord.owner || '-'],
              ['优先级', detailRecord.priority ?? 0],
              ['启用', <Tag key="active" color={detailRecord.is_active ? 'green' : 'grey'}>{detailRecord.is_active ? '启用' : '停用'}</Tag>],
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
          </div>
        )}
      </SideSheet>
    </div>
  )
}
