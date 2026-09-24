import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Button,
  Card,
  Divider,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  SideSheet,
  Space,
  Spin,
  Tag,
  Toast,
  Typography,
  Pagination,
} from '@douyinfe/semi-ui'
import { IconGridSquare, IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  createCardListPage,
  deleteCardListPage,
  downloadCardListPageTemplate,
  exportCardListPage,
  getCardListPageList,
  importCardListPage,
  updateCardListPage,
} from '@/modules/component_center/api/card_list_page'


const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '商品', value: 'product' },
  { label: '文章', value: 'article' },
  { label: '活动', value: 'event' },
  { label: '促销', value: 'promotion' },
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
  { label: '标题', value: 'title' },
  { label: '编码', value: 'card_code' },
  { label: '副标题', value: 'subtitle' },
  { label: '分类', value: 'category' },
  { label: '标签', value: 'tag' },
  { label: '发布状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '优先级', value: 'priority' },
  { label: '启用状态', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

const CATEGORY_LABEL_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]))
const CATEGORY_COLOR_MAP = {
  general: 'blue',
  product: 'orange',
  article: 'green',
  event: 'purple',
  promotion: 'red',
}

const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')

const mapStatusMeta = (value) => {
  if (value === 'published') return { label: '已发布', color: 'green' }
  if (value === 'archived') return { label: '已归档', color: 'grey' }
  return { label: '草稿', color: 'light-blue' }
}

// ─── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({ record, onView, onEdit, onDelete }) {
  const statusMeta = mapStatusMeta(record.status)
  const categoryColor = CATEGORY_COLOR_MAP[record.category] || 'blue'
  const categoryLabel = CATEGORY_LABEL_MAP[record.category] || record.category

  return (
    <Card
      shadows="hover"
      style={{ width: '100%', minWidth: 0 }}
      headerLine={false}
      cover={
        record.cover_url ? (
          <div style={{ height: 140, overflow: 'hidden', borderRadius: '8px 8px 0 0', background: 'var(--semi-color-fill-1)' }}>
            <img
              alt={record.title}
              src={record.cover_url}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        ) : (
          <div
            style={{
              height: 140,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--semi-color-fill-1)',
              borderRadius: '8px 8px 0 0',
            }}
          >
            <IconGridSquare size="extra-large" style={{ color: 'var(--semi-color-text-3)' }} />
          </div>
        )
      }
      footerLine
      footerStyle={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 16px' }}
      footer={
        <Space>
          <Button size="small" theme="borderless" onClick={() => onView(record)}>查看</Button>
          <Button size="small" onClick={() => onEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该卡片？"
            content="删除后不可恢复"
            onConfirm={() => onDelete(record.id)}
          >
            <Button size="small" type="danger">删除</Button>
          </Popconfirm>
        </Space>
      }
    >
      <div>
        {/* Tags row */}
        <Space style={{ marginBottom: 6, flexWrap: 'wrap' }}>
          <Tag color={categoryColor} size="small">{categoryLabel}</Tag>
          <Tag color={statusMeta.color} size="small">{statusMeta.label}</Tag>
          {!record.is_active && <Tag color="grey" size="small">停用</Tag>}
          {record.tag && <Tag size="small">{record.tag}</Tag>}
        </Space>

        {/* Title */}
        <Typography.Title
          heading={6}
          ellipsis={{ rows: 1 }}
          style={{ margin: '4px 0 2px' }}
        >
          {record.title}
        </Typography.Title>

        {/* Subtitle */}
        {record.subtitle && (
          <Typography.Text
            type="tertiary"
            size="small"
            ellipsis={{ rows: 1 }}
            style={{ display: 'block', marginBottom: 4 }}
          >
            {record.subtitle}
          </Typography.Text>
        )}

        {/* Footer info */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
          <Typography.Text type="tertiary" size="small">
            {record.owner || '-'}
          </Typography.Text>
          <Typography.Text type="quaternary" size="small">
            #{record.card_code}
          </Typography.Text>
        </div>
      </div>
    </Card>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function CardListPage() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getCardListPageList(params).catch(() => {
      Toast.error('加载数据失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handlePageChange } = list

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [isActive, setIsActive] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editRecord, setEditRecord] = useState(null)

  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)

  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  const formApiRef = useRef()

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSearch = () => {
    list.handleSearch({
      search: search.trim(),
      category: category || '',
      is_active: isActive || '',
      status: statusFilter || '',
    })
  }

  const handleReset = () => {
    setSearch('')
    setCategory('')
    setIsActive('')
    setStatusFilter('')
    list.handleReset()
  }

  const openCreate = () => {
    setEditRecord(null)
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setModalVisible(true)
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      const req = editRecord?.id
        ? updateCardListPage(editRecord.id, values)
        : createCardListPage(values)
      req
        .then(() => {
          Toast.success(editRecord?.id ? '更新成功' : '创建成功')
          setModalVisible(false)
          fetchData()
        })
        .catch((err) => Toast.error(err?.error || '保存失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleDelete = (id) => {
    deleteCardListPage(id)
      .then(() => {
        Toast.success('删除成功')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleExport = ({ fields, fileType }) => {
    const finalFileType = normalizeFileType(fileType)
    const payload = {
      fields,
      file_type: finalFileType,
      export_mode: 'filtered',
      filters,
    }
    exportCardListPage(payload)
      .then((blob) => {
        downloadBlobFile(blob, `card_list_page_export.${finalFileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  const initValues = editRecord || {
    category: 'general',
    status: 'draft',
    priority: 0,
    is_active: true,
  }

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 6 }}>
        卡片列表页
      </Typography.Title>
      <Typography.Paragraph type="tertiary" style={{ marginBottom: 16 }}>
        以卡片网格形式展示数据，每张卡片可包含封面图、标题、副标题、分类标签等信息，适合商品、文章、活动等场景。
      </Typography.Paragraph>

      {/* ── 搜索栏 ── */}
      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="标题 / 编码 / 负责人"
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

      {/* ── 卡片网格 ── */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <Typography.Text strong>
            卡片列表
            {total > 0 && (
              <Typography.Text type="tertiary" size="small" style={{ marginLeft: 8 }}>
                共 {total} 条
              </Typography.Text>
            )}
          </Typography.Text>
          <Space>
            <Button onClick={() => setImportModalVisible(true)}>导入</Button>
            <Button onClick={() => setExportModalVisible(true)}>导出</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>
              新建卡片
            </Button>
          </Space>
        </div>

        <Spin spinning={loading}>
          {data.length === 0 && !loading ? (
            <Empty
              image={<IconGridSquare size="extra-large" style={{ color: 'var(--semi-color-text-3)' }} />}
              description="暂无卡片数据"
              style={{ padding: '40px 0' }}
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {data.map((record) => (
                <ItemCard
                  key={record.id}
                  record={record}
                  onView={openDetail}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </Spin>

        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            total={total}
            currentPage={page}
            pageSize={20}
            onPageChange={(nextPage) => handlePageChange(nextPage)}
          />
        </div>
      </div>

      {/* ── 新建/编辑 Modal ── */}
      <Modal
        title={editRecord?.id ? '编辑卡片' : '新建卡片'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 640}
        afterClose={() => {
          formApiRef.current?.reset()
          setEditRecord(null)
        }}
      >
        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={initValues}
          labelPosition="top"
        >
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
            <Form.Input
              field="title"
              label="标题"
              rules={[{ required: true, message: '请输入标题' }]}
            />
            <Form.Input
              field="card_code"
              label="编码"
              placeholder="例如：card_001"
              rules={[{ required: true, message: '请输入编码' }]}
              disabled={Boolean(editRecord?.id)}
            />
            <Form.Input
              field="subtitle"
              label="副标题"
              placeholder="可选"
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
            <Form.Input
              field="tag"
              label="标签"
              placeholder="例如：新品、推荐"
            />
            <Form.Input field="owner" label="负责人" placeholder="例如：admin" />
            <Form.InputNumber field="priority" label="优先级" min={0} max={9999} style={{ width: '100%' }} />
          </div>
          <Form.Input
            field="cover_url"
            label="封面图地址"
            placeholder="输入图片 URL"
            style={{ marginTop: 4 }}
          />
          <Space style={{ marginTop: 4 }}>
            <Form.Switch field="is_active" label="启用" />
          </Space>
          <Form.TextArea field="description" label="描述" rows={3} maxCount={300} />
        </Form>
      </Modal>

      <ExportFieldsModal
        visible={exportModalVisible}
        title="卡片列表页导出字段"
        ruleHint="将按当前筛选条件导出"
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['title', 'card_code', 'category', 'tag', 'status', 'owner', 'updated_at']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importModalVisible}
        title="导入卡片列表页数据"
        targetLabel="卡片列表页"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadCardListPageTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `card_list_page_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importCardListPage(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="card_list_page_import_error_rows.csv"
      />

      {/* ── 详情抽屉 ── */}
      <SideSheet
        title="卡片详情"
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
            {detailRecord.cover_url && (
              <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', maxHeight: 200 }}>
                <img
                  src={detailRecord.cover_url}
                  alt={detailRecord.title}
                  style={{ width: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
            {[
              ['ID', detailRecord.id],
              ['标题', detailRecord.title],
              ['编码', <Tag key="code">{detailRecord.card_code}</Tag>],
              ['副标题', detailRecord.subtitle || '-'],
              ['分类', CATEGORY_LABEL_MAP[detailRecord.category] || detailRecord.category || '-'],
              ['标签', detailRecord.tag ? <Tag key="tag">{detailRecord.tag}</Tag> : '-'],
              ['发布状态', (() => { const m = mapStatusMeta(detailRecord.status); return <Tag key="s" color={m.color}>{m.label}</Tag> })()],
              ['负责人', detailRecord.owner || '-'],
              ['优先级', detailRecord.priority ?? 0],
              ['启用', <Tag key="active" color={detailRecord.is_active ? 'green' : 'grey'}>{detailRecord.is_active ? '启用' : '停用'}</Tag>],
              ['创建时间', detailRecord.created_at ? detailRecord.created_at.slice(0, 19).replace('T', ' ') : '-'],
              ['更新时间', detailRecord.updated_at ? detailRecord.updated_at.slice(0, 19).replace('T', ' ') : '-'],
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
