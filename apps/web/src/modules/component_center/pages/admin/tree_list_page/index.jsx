import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Breadcrumb,
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
  Spin,
  Table,
  Tag,
  Toast,
  Tree,
  TreeSelect,
  Typography,
} from '@douyinfe/semi-ui'
import { IconBranch, IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  createTreeListPage,
  deleteTreeListPage,
  downloadTreeListPageTemplate,
  exportTreeListPage,
  getTreeListPageList,
  getTreeListPageTree,
  importTreeListPage,
  updateTreeListPage,
} from '@/modules/component_center/api/tree_list_page'

// ── 样式常量 ──────────────────────────────────────────────────────────
const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 16,
  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 18px rgba(15,23,42,0.06)',
}

// ── 常量 ──────────────────────────────────────────────────────────────
const NODE_TYPE_OPTIONS = [
  { label: '分类', value: 'category' },
  { label: '条目', value: 'item' },
  { label: '分组', value: 'group' },
]
const NODE_TYPE_FILTER_OPTIONS = [
  { label: '全部类型', value: '' },
  ...NODE_TYPE_OPTIONS,
]
const STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
  { label: '已归档', value: 'archived' },
]
const STATUS_FILTER_OPTIONS = [
  { label: '全部状态', value: '' },
  ...STATUS_OPTIONS,
]
const STATUS_META = {
  active: { label: '启用', color: 'green' },
  inactive: { label: '停用', color: 'grey' },
  archived: { label: '已归档', color: 'orange' },
}
const NODE_TYPE_COLOR = { category: 'blue', item: 'teal', group: 'purple' }
const NODE_TYPE_LABEL = { category: '分类', item: '条目', group: '分组' }

const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '节点名称', value: 'name' },
  { label: '节点编码', value: 'node_code' },
  { label: '父节点ID', value: 'parent_id' },
  { label: '节点类型', value: 'node_type' },
  { label: '状态', value: 'status' },
  { label: '负责人', value: 'owner' },
  { label: '排序', value: 'sort_order' },
  { label: '启用', value: 'is_active' },
  { label: '描述', value: 'description' },
  { label: '创建时间', value: 'created_at' },
  { label: '更新时间', value: 'updated_at' },
]

// ── 工具函数 ──────────────────────────────────────────────────────────
function toTreeData(nodes) {
  return (nodes || []).map((n) => ({
    key: String(n.id),
    label: n.name,
    value: n.id,
    nodeType: n.node_type,
    isActive: n.is_active,
    childrenCount: n.children_count || 0,
    children: n.children?.length ? toTreeData(n.children) : undefined,
  }))
}

function collectAllIds(treeData) {
  const ids = []
  const walk = (nodes) => {
    nodes.forEach((n) => {
      ids.push(n.key)
      if (n.children?.length) walk(n.children)
    })
  }
  walk(treeData)
  return ids
}

// 从树中找到指定 id 的节点路径（面包屑用）
function findPath(treeData, targetId, path = []) {
  for (const node of treeData) {
    const current = [...path, { id: node.value, name: node.label }]
    if (node.value === targetId) return current
    if (node.children?.length) {
      const found = findPath(node.children, targetId, current)
      if (found) return found
    }
  }
  return null
}

// ── 主组件 ────────────────────────────────────────────────────────────
export default function TreeListPage() {
  const isMobile = useIsMobile()
  // Tree 左侧
  const [treeData, setTreeData] = useState([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [treeSearch, setTreeSearch] = useState('')
  const [expandedKeys, setExpandedKeys] = useState([])

  // 右侧表格
  const [selectedNodeId, setSelectedNodeId] = useState(null) // null = 根级
  const [tableItems, setTableItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [tableLoading, setTableLoading] = useState(false)
  const [tableSearch, setTableSearch] = useState('')
  const [filterNodeType, setFilterNodeType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  // CRUD Modal
  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const formApiRef = useRef()

  // 详情抽屉
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailRecord, setDetailRecord] = useState(null)

  // 导入/导出
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])

  // ── 拉取树 ────────────────────────────────────────────────────────
  const fetchTree = useCallback((search = '') => {
    setTreeLoading(true)
    getTreeListPageTree({ search: search || undefined })
      .then((res) => {
        const data = toTreeData(res || [])
        setTreeData(data)
        if (!search) setExpandedKeys(collectAllIds(data).slice(0, 20))
      })
      .catch((err) => Toast.error(err?.error || '树形数据加载失败'))
      .finally(() => setTreeLoading(false))
  }, [])

  // ── 拉取表格 ──────────────────────────────────────────────────────
  const fetchTable = useCallback((
    nodeId = selectedNodeId,
    pg = page,
    search = tableSearch,
    nodeType = filterNodeType,
    status = filterStatus,
  ) => {
    setTableLoading(true)
    const params = {
      page: pg,
      per_page: 20,
      parent_id: nodeId === null ? 'root' : nodeId,
      search: search || undefined,
      node_type: nodeType || undefined,
      status: status || undefined,
    }
    getTreeListPageList(params)
      .then((res) => {
        setTableItems(res.items || [])
        setTotal(res.total || 0)
      })
      .catch((err) => Toast.error(err?.error || '列表加载失败'))
      .finally(() => setTableLoading(false))
  }, [selectedNodeId, page, tableSearch, filterNodeType, filterStatus])

  useEffect(() => { fetchTree() }, [fetchTree])
  useEffect(() => { fetchTable() }, [fetchTable])

  // ── 树节点点击 ────────────────────────────────────────────────────
  const handleTreeSelect = (key, _selected, node) => {
    const id = node.value
    setSelectedNodeId(id)
    setPage(1)
    setTableSearch('')
    setFilterNodeType('')
    setFilterStatus('')
    fetchTable(id, 1, '', '', '')
  }

  const handleShowRoot = () => {
    setSelectedNodeId(null)
    setPage(1)
    setTableSearch('')
    setFilterNodeType('')
    setFilterStatus('')
    fetchTable(null, 1, '', '', '')
  }

  // ── 面包屑路径 ────────────────────────────────────────────────────
  const breadcrumbPath = selectedNodeId
    ? (findPath(treeData, selectedNodeId) || [{ id: selectedNodeId, name: '当前节点' }])
    : []

  // ── CRUD ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null)
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setModalVisible(true)
  }

  const openDetail = (record) => {
    setDetailRecord(record)
    setDetailVisible(true)
  }

  const handleDelete = (id) => {
    deleteTreeListPage(id)
      .then(() => {
        Toast.success('删除成功')
        fetchTree(treeSearch)
        fetchTable()
      })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleSubmit = () => {
    formApiRef.current?.validate().then((values) => {
      setSubmitting(true)
      const promise = editRecord?.id
        ? updateTreeListPage(editRecord.id, values)
        : createTreeListPage({ ...values, parent_id: values.parent_id ?? (selectedNodeId || null) })
      promise
        .then(() => {
          Toast.success(editRecord?.id ? '编辑成功' : '新建成功')
          setModalVisible(false)
          fetchTree(treeSearch)
          fetchTable()
        })
        .catch((err) => Toast.error(err?.error || (editRecord?.id ? '编辑失败' : '新建失败')))
        .finally(() => setSubmitting(false))
    }).catch(() => {})
  }

  const initValues = editRecord ? {
    name: editRecord.name,
    node_code: editRecord.node_code,
    parent_id: editRecord.parent_id ?? null,
    node_type: editRecord.node_type || 'category',
    icon: editRecord.icon || '',
    owner: editRecord.owner || '',
    sort_order: editRecord.sort_order ?? 0,
    is_active: editRecord.is_active !== false,
    status: editRecord.status || 'active',
    description: editRecord.description || '',
  } : {
    node_type: 'category',
    is_active: true,
    status: 'active',
    sort_order: 0,
    parent_id: selectedNodeId || null,
  }

  // ── 导出 ──────────────────────────────────────────────────────────
  const handleExport = (fields, fileType) => {
    const payload = {
      fields,
      file_type: fileType,
      export_mode: selectedRowKeys.length > 0 ? 'selected' : 'filtered',
      ids: selectedRowKeys,
      filters: { node_type: filterNodeType, status: filterStatus },
    }
    exportTreeListPage(payload)
      .then((blob) => {
        const ext = fileType === 'xlsx' ? 'xlsx' : fileType === 'xls' ? 'xls' : 'csv'
        downloadBlobFile(blob, `tree_list_page_export.${ext}`)
        Toast.success('导出成功')
      })
      .catch(() => Toast.error('导出失败'))
  }

  // ── 表格列 ────────────────────────────────────────────────────────
  const columns = [
    {
      title: '节点名称',
      dataIndex: 'name',
      render: (name, record) => (
        <Space>
          <IconBranch size="small" style={{ color: 'var(--semi-color-text-2)' }} />
          <Typography.Text
            style={{ cursor: 'pointer', color: 'var(--semi-color-primary)' }}
            onClick={() => {
              setSelectedNodeId(record.id)
              setPage(1)
              setTableSearch('')
              setFilterNodeType('')
              setFilterStatus('')
              fetchTable(record.id, 1, '', '', '')
            }}
          >
            {name}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '编码',
      dataIndex: 'node_code',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'node_type',
      render: (v) => (
        <Tag color={NODE_TYPE_COLOR[v] || 'grey'}>
          {NODE_TYPE_LABEL[v] || v || '-'}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v) => {
        const m = STATUS_META[v] || { label: v, color: 'grey' }
        return <Tag color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '负责人',
      dataIndex: 'owner',
      render: (v) => v || '-',
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 70,
      render: (v) => v ?? 0,
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 70,
      render: (v) => (
        <Tag color={v ? 'green' : 'grey'}>{v ? '启用' : '停用'}</Tag>
      ),
    },
    {
      title: '操作',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" theme="borderless" onClick={() => openDetail(record)}>详情</Button>
          <Button size="small" theme="borderless" type="primary" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该节点？"
            content="子节点的父节点关联将被清除。"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" theme="borderless" type="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  // ── 渲染 ──────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', height: '100%', gap: 0, minHeight: 0 }}>

      {/* ══ 左侧树面板 ══ */}
      <div style={{
        width: isMobile ? '100%' : 280,
        flexShrink: 0,
        borderRight: isMobile ? 'none' : '1px solid var(--semi-color-border)',
        borderBottom: isMobile ? '1px solid var(--semi-color-border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--semi-color-bg-0)',
        overflow: 'hidden',
      }}>
        {/* 标题 + 搜索 */}
        <div style={{ padding: '16px 12px 8px', borderBottom: '1px solid var(--semi-color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <IconBranch />
            <Typography.Text strong>节点树</Typography.Text>
          </div>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索节点名称…"
            value={treeSearch}
            showClear
            onChange={(v) => {
              setTreeSearch(v)
              fetchTree(v)
            }}
          />
        </div>

        {/* 根级入口 */}
        <div
          style={{
            padding: '10px 16px',
            cursor: 'pointer',
            background: selectedNodeId === null ? 'var(--semi-color-primary-light-default)' : 'transparent',
            color: selectedNodeId === null ? 'var(--semi-color-primary)' : 'inherit',
            borderBottom: '1px solid var(--semi-color-border)',
            fontWeight: selectedNodeId === null ? 600 : 400,
          }}
          onClick={handleShowRoot}
        >
          全部根节点
        </div>

        {/* 树 */}
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 4px' }}>
          {treeLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Spin />
            </div>
          ) : treeData.length === 0 ? (
            <Empty description="暂无节点数据" style={{ padding: 24 }} />
          ) : (
            <Tree
              treeData={treeData}
              selectedKeys={selectedNodeId ? [String(selectedNodeId)] : []}
              expandedKeys={expandedKeys}
              onExpand={(keys) => setExpandedKeys(keys)}
              onSelect={handleTreeSelect}
              style={{ width: '100%' }}
              renderLabel={(label, data) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>{label}</span>
                  {data.childrenCount > 0 && (
                    <Tag size="small" style={{ marginLeft: 4, lineHeight: '16px' }}>
                      {data.childrenCount}
                    </Tag>
                  )}
                </span>
              )}
            />
          )}
        </div>
      </div>

      {/* ══ 右侧内容区 ══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, padding: 16, gap: 12 }}>

        {/* 页面标题 */}
        <div>
          <Typography.Title heading={5} style={{ marginBottom: 4 }}>树形列表页</Typography.Title>
          <Typography.Paragraph type="tertiary">
            展示 Tree + Table 联动的树形层级浏览页：左侧节点树点击后，右侧动态加载子节点列表。
          </Typography.Paragraph>
        </div>

        {/* 面包屑 + 工具栏 card */}
        <div style={CARD_STYLE}>
          {/* 面包屑 */}
          <div style={{ marginBottom: 12 }}>
            <Breadcrumb>
              <Breadcrumb.Item onClick={handleShowRoot} style={{ cursor: 'pointer' }}>根节点</Breadcrumb.Item>
              {breadcrumbPath.map((seg, idx) => (
                <Breadcrumb.Item
                  key={seg.id}
                  style={{ cursor: idx < breadcrumbPath.length - 1 ? 'pointer' : 'default' }}
                  onClick={() => {
                    if (idx < breadcrumbPath.length - 1) {
                      setSelectedNodeId(seg.id)
                      setPage(1)
                      fetchTable(seg.id, 1, tableSearch, filterNodeType, filterStatus)
                    }
                  }}
                >
                  {seg.name}
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>

          {/* 搜索过滤行 */}
          <Space style={{ flexWrap: 'wrap' }}>
            <Input
              prefix={<IconSearch />}
              placeholder="搜索名称/编码/负责人"
              style={{ width: 200 }}
              value={tableSearch}
              showClear
              onChange={(v) => {
                setTableSearch(v)
                setPage(1)
                fetchTable(selectedNodeId, 1, v, filterNodeType, filterStatus)
              }}
            />
            <Select
              placeholder="节点类型"
              style={{ width: 120 }}
              optionList={NODE_TYPE_FILTER_OPTIONS}
              value={filterNodeType}
              onChange={(v) => {
                setFilterNodeType(v)
                setPage(1)
                fetchTable(selectedNodeId, 1, tableSearch, v, filterStatus)
              }}
            />
            <Select
              placeholder="状态"
              style={{ width: 120 }}
              optionList={STATUS_FILTER_OPTIONS}
              value={filterStatus}
              onChange={(v) => {
                setFilterStatus(v)
                setPage(1)
                fetchTable(selectedNodeId, 1, tableSearch, filterNodeType, v)
              }}
            />
            <div style={{ flex: 1 }} />
            <Button
              icon={<IconRefresh />}
              onClick={() => { fetchTree(treeSearch); fetchTable() }}
            >
              刷新
            </Button>
            <Button onClick={() => setImportModalVisible(true)}>导入</Button>
            <Button onClick={() => setExportModalVisible(true)}>导出</Button>
            <Button
              icon={<IconPlus />}
              type="primary"
              theme="solid"
              onClick={openCreate}
            >
              新建节点
            </Button>
          </Space>
        </div>

        {/* 表格 card */}
        <div style={CARD_STYLE}>
          <Table
            columns={columns}
            dataSource={tableItems}
            loading={tableLoading}
            rowKey="id"
            scroll={{}}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
            }}
            pagination={{
              total,
              currentPage: page,
              pageSize: 20,
              onPageChange: (p) => {
                setPage(p)
                fetchTable(selectedNodeId, p, tableSearch, filterNodeType, filterStatus)
              },
            }}
            empty={
              <Empty
                description={selectedNodeId ? '该节点暂无子节点' : '暂无根节点数据'}
              />
            }
          />
        </div>
      </div>

      {/* ── 新建/编辑 Modal ── */}
      <Modal
        title={editRecord?.id ? '编辑节点' : '新建节点'}
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 580}
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
              field="name"
              label="节点名称"
              rules={[{ required: true, message: '请输入节点名称' }]}
            />
            <Form.Input
              field="node_code"
              label="节点编码"
              placeholder="例如：root_001"
              rules={[{ required: true, message: '请输入节点编码' }]}
              disabled={Boolean(editRecord?.id)}
            />
            <Form.TreeSelect
              field="parent_id"
              label="父节点"
              placeholder="不选则作为根节点"
              treeData={treeData}
              style={{ width: '100%' }}
              showClear
            />
            <Form.Select
              field="node_type"
              label="节点类型"
              optionList={NODE_TYPE_OPTIONS}
              style={{ width: '100%' }}
            />
            <Form.Input field="owner" label="负责人" placeholder="例如：admin" />
            <Form.Input field="icon" label="图标" placeholder="图标名称（可选）" />
            <Form.InputNumber
              field="sort_order"
              label="排序"
              min={0}
              max={9999}
              style={{ width: '100%' }}
            />
            <Form.Select
              field="status"
              label="状态"
              optionList={STATUS_OPTIONS}
              style={{ width: '100%' }}
            />
          </div>
          <Space style={{ marginTop: 4 }}>
            <Form.Switch field="is_active" label="启用" />
          </Space>
          <Form.TextArea field="description" label="描述" rows={3} maxCount={300} />
        </Form>
      </Modal>

      {/* ── 详情抽屉 ── */}
      <SideSheet
        title="节点详情"
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
              ['节点名称', detailRecord.name],
              ['节点编码', <Tag key="code">{detailRecord.node_code}</Tag>],
              ['父节点ID', detailRecord.parent_id ?? '-'],
              ['节点类型', <Tag key="type" color={NODE_TYPE_COLOR[detailRecord.node_type] || 'grey'}>{NODE_TYPE_LABEL[detailRecord.node_type] || detailRecord.node_type || '-'}</Tag>],
              ['图标', detailRecord.icon || '-'],
              ['状态', (() => { const m = STATUS_META[detailRecord.status] || { label: detailRecord.status, color: 'grey' }; return <Tag key="s" color={m.color}>{m.label}</Tag> })()],
              ['启用', <Tag key="active" color={detailRecord.is_active ? 'green' : 'grey'}>{detailRecord.is_active ? '启用' : '停用'}</Tag>],
              ['负责人', detailRecord.owner || '-'],
              ['排序', detailRecord.sort_order ?? 0],
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

      {/* ── 导出字段弹窗 ── */}
      <ExportFieldsModal
        visible={exportModalVisible}
        title="树形列表页导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选时，将按当前筛选条件导出'
        }
        fieldOptions={EXPORT_FIELDS}
        defaultFields={['name', 'node_code', 'parent_id', 'node_type', 'status', 'owner', 'updated_at']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      {/* ── 导入弹窗 ── */}
      <ImportCsvModal
        visible={importModalVisible}
        title="导入树形列表页数据"
        targetLabel="树形列表页"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) => {
          const ext = fileType === 'xlsx' ? 'xlsx' : fileType === 'xls' ? 'xls' : 'csv'
          downloadTreeListPageTemplate(ext)
            .then((blob) => {
              downloadBlobFile(blob, `tree_list_page_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }}
        onImport={(file) => importTreeListPage(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchTree(treeSearch)
          fetchTable()
        }}
        errorExportFileName="tree_list_page_import_error_rows.csv"
      />
    </div>
  )
}
