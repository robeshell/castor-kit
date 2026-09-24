import { CARD_STYLE } from '@/shared/styles'
import { useEffect, useMemo, useState } from 'react'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Button,
  Checkbox,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  SideSheet,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui'
import {
  IconDelete,
  IconEdit,
  IconPlus,
  IconRefresh,
  IconSave,
  IconSearch,
  IconSetting,
  IconUndo,
} from '@douyinfe/semi-icons'
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  batchDeleteAdvancedTableRows,
  batchUpdateAdvancedTableRows,
  createAdvancedTableRow,
  deleteAdvancedTableRow,
  getAdvancedTableRows,
  getAdvancedTableStats,
  reorderAdvancedTableRows,
  updateAdvancedTableRow,
} from '@/modules/component_center/api/advanced_table_page'

const STATUS_META = {
  draft: { label: '草稿', color: 'light-blue' },
  published: { label: '已发布', color: 'green' },
  archived: { label: '已归档', color: 'grey' },
}

const STATUS_OPTIONS = [
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
  { label: '已归档', value: 'archived' },
]

const CATEGORY_OPTIONS = [
  { label: '通用', value: 'general' },
  { label: '订单', value: 'order' },
  { label: '用户', value: 'user' },
  { label: '财务', value: 'finance' },
  { label: '风控', value: 'risk' },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORY_OPTIONS.map((item) => [item.value, item.label]))


const ALL_COLUMNS = [
  { key: 'row_code', label: '编码' },
  { key: 'name', label: '名称' },
  { key: 'category', label: '分类' },
  { key: 'owner', label: '负责人' },
  { key: 'status', label: '状态' },
  { key: 'priority', label: '优先级' },
  { key: 'progress', label: '进度' },
  { key: 'score', label: '评分' },
  { key: 'tags', label: '标签' },
  { key: 'is_active', label: '启用' },
  { key: 'is_pinned', label: '置顶' },
  { key: 'updated_at', label: '更新时间' },
]

function formatDateTime(value) {
  return value ? value.slice(0, 19).replace('T', ' ') : '-'
}

function SortableItem({ item }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    border: '1px solid var(--semi-color-border)',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 8,
    background: 'var(--semi-color-bg-1)',
    cursor: 'grab',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Space>
        <Typography.Text strong>{item.name}</Typography.Text>
        <Tag size="small" color="white">{item.row_code}</Tag>
      </Space>
      <Typography.Text type="tertiary">排序值: {item.sort_order}</Typography.Text>
    </div>
  )
}

export default function AdvancedTablePage() {
  const list = useCrudList(
    (params) => getAdvancedTableRows(params).catch((err) => {
      Toast.error(err?.error || '加载失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handlePageChange } = list
  const [stats, setStats] = useState(null)

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [pinnedOnly, setPinnedOnly] = useState(false)

  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [editingRowId, setEditingRowId] = useState(null)
  const [editingDraft, setEditingDraft] = useState({})
  const [lastSnapshot, setLastSnapshot] = useState(null)
  const [columnSettingVisible, setColumnSettingVisible] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState(ALL_COLUMNS.map((item) => item.key))
  const [sortSheetVisible, setSortSheetVisible] = useState(false)
  const [sortItems, setSortItems] = useState([])
  const [createVisible, setCreateVisible] = useState(false)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const fetchStats = () => {
    getAdvancedTableStats().then(setStats).catch(() => {})
  }

  useEffect(() => {
    fetchStats()
    fetchData()
  }, [])

  const onSearch = () => {
    list.handleSearch({
      search: search.trim(),
      category,
      pinned_only: pinnedOnly,
    })
  }

  const openInlineEdit = (record) => {
    setEditingRowId(record.id)
    setEditingDraft({
      name: record.name,
      owner: record.owner || '',
      status: record.status || 'draft',
      priority: record.priority ?? 0,
      progress: record.progress ?? 0,
      score: record.score ?? 0,
      tags: record.tags || '',
      remark: record.remark || '',
    })
  }

  const saveInlineEdit = (record) => {
    setLastSnapshot({
      id: record.id,
      payload: {
        name: record.name,
        owner: record.owner,
        status: record.status,
        priority: record.priority,
        progress: record.progress,
        score: record.score,
        tags: record.tags,
        remark: record.remark,
      },
    })
    updateAdvancedTableRow(record.id, editingDraft)
      .then(() => {
        Toast.success('保存成功')
        setEditingRowId(null)
        fetchData()
        fetchStats()
      })
      .catch((err) => Toast.error(err?.error || '保存失败'))
  }

  const undoLastEdit = () => {
    if (!lastSnapshot) return
    updateAdvancedTableRow(lastSnapshot.id, lastSnapshot.payload)
      .then(() => {
        Toast.success('已撤销最近一次编辑')
        setLastSnapshot(null)
        fetchData()
        fetchStats()
      })
      .catch((err) => Toast.error(err?.error || '撤销失败'))
  }

  const openSortSheet = () => {
    setSortItems(
      [...data]
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        .map((item) => ({ ...item })),
    )
    setSortSheetVisible(true)
  }

  const saveSort = () => {
    const payload = sortItems.map((item, index) => ({
      id: item.id,
      sort_order: (index + 1) * 10,
    }))
    reorderAdvancedTableRows(payload)
      .then(() => {
        Toast.success('拖拽排序已保存')
        setSortSheetVisible(false)
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '排序保存失败'))
  }

  const doBatchSetStatus = (nextStatus) => {
    if (!selectedRowKeys.length) {
      Toast.warning('请先勾选数据')
      return
    }
    batchUpdateAdvancedTableRows({ ids: selectedRowKeys, status: nextStatus })
      .then((res) => {
        Toast.success(res?.message || '批量更新成功')
        fetchData()
        fetchStats()
      })
      .catch((err) => Toast.error(err?.error || '批量更新失败'))
  }

  const doBatchDelete = () => {
    if (!selectedRowKeys.length) {
      Toast.warning('请先勾选数据')
      return
    }
    batchDeleteAdvancedTableRows({ ids: selectedRowKeys })
      .then((res) => {
        Toast.success(res?.message || '批量删除成功')
        setSelectedRowKeys([])
        fetchData()
        fetchStats()
      })
      .catch((err) => Toast.error(err?.error || '批量删除失败'))
  }

  const columns = useMemo(() => {
    const isEditing = (record) => editingRowId === record.id
    const maybe = {
      row_code: {
        title: '编码',
        dataIndex: 'row_code',
        width: 120,
      },
      name: {
        title: '名称',
        dataIndex: 'name',
        width: 220,
        render: (text, record) =>
          isEditing(record) ? (
            <Input
              value={editingDraft.name}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, name: v }))}
            />
          ) : (
            <Typography.Text strong>{text}</Typography.Text>
          ),
      },
      category: {
        title: '分类',
        dataIndex: 'category',
        width: 110,
        render: (value) => CATEGORY_MAP[value] || value || '-',
      },
      owner: {
        title: '负责人',
        dataIndex: 'owner',
        width: 120,
        render: (text, record) =>
          isEditing(record) ? (
            <Input
              value={editingDraft.owner}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, owner: v }))}
            />
          ) : (
            text || '-'
          ),
      },
      status: {
        title: '状态',
        dataIndex: 'status',
        width: 120,
        render: (value, record) =>
          isEditing(record) ? (
            <Select
              value={editingDraft.status}
              optionList={STATUS_OPTIONS}
              style={{ width: 110 }}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, status: v }))}
            />
          ) : (
            <Tag color={STATUS_META[value]?.color || 'grey'}>{STATUS_META[value]?.label || value}</Tag>
          ),
      },
      priority: {
        title: '优先级',
        dataIndex: 'priority',
        width: 100,
        render: (value, record) =>
          isEditing(record) ? (
            <InputNumber
              min={0}
              max={100}
              value={editingDraft.priority}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, priority: v ?? 0 }))}
            />
          ) : (
            value ?? 0
          ),
      },
      progress: {
        title: '进度(%)',
        dataIndex: 'progress',
        width: 120,
        render: (value, record) =>
          isEditing(record) ? (
            <InputNumber
              min={0}
              max={100}
              value={editingDraft.progress}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, progress: v ?? 0 }))}
            />
          ) : (
            value ?? 0
          ),
      },
      score: {
        title: '评分',
        dataIndex: 'score',
        width: 100,
        render: (value, record) =>
          isEditing(record) ? (
            <InputNumber
              min={0}
              max={100}
              value={editingDraft.score}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, score: v ?? 0 }))}
            />
          ) : (
            Number(value || 0).toFixed(1)
          ),
      },
      tags: {
        title: '标签',
        dataIndex: 'tags',
        width: 180,
        render: (value, record) =>
          isEditing(record) ? (
            <Input
              value={editingDraft.tags}
              onChange={(v) => setEditingDraft((prev) => ({ ...prev, tags: v }))}
            />
          ) : (
            value || '-'
          ),
      },
      is_active: {
        title: '启用',
        dataIndex: 'is_active',
        width: 88,
        render: (value, record) => (
          <Switch
            size="small"
            checked={Boolean(value)}
            onChange={(checked) => {
              updateAdvancedTableRow(record.id, { is_active: checked })
                .then(() => fetchData())
                .catch((err) => Toast.error(err?.error || '更新失败'))
            }}
          />
        ),
      },
      is_pinned: {
        title: '置顶',
        dataIndex: 'is_pinned',
        width: 88,
        render: (value, record) => (
          <Switch
            size="small"
            checked={Boolean(value)}
            onChange={(checked) => {
              updateAdvancedTableRow(record.id, { is_pinned: checked })
                .then(() => {
                  fetchData()
                  fetchStats()
                })
                .catch((err) => Toast.error(err?.error || '更新失败'))
            }}
          />
        ),
      },
      updated_at: {
        title: '更新时间',
        dataIndex: 'updated_at',
        width: 165,
        render: formatDateTime,
      },
    }
    return ALL_COLUMNS.filter((item) => visibleColumns.includes(item.key)).map((item) => maybe[item.key])
  }, [editingDraft, editingRowId, page, filters, visibleColumns])

  const tableColumns = [
    ...columns,
    {
      title: '操作',
      fixed: 'right',
      width: 210,
      render: (_, record) => {
        const editing = editingRowId === record.id
        return editing ? (
          <Space>
            <Button
              size="small"
              theme="solid"
              icon={<IconSave />}
              onClick={() => saveInlineEdit(record)}
            >
              保存
            </Button>
            <Button size="small" onClick={() => setEditingRowId(null)}>取消</Button>
          </Space>
        ) : (
          <Space>
            <Button
              size="small"
              icon={<IconEdit />}
              onClick={() => openInlineEdit(record)}
            >
              行内编辑
            </Button>
            <Popconfirm
              title="确认删除该记录？"
              content={record.name}
              onConfirm={() => {
                deleteAdvancedTableRow(record.id)
                  .then(() => {
                    Toast.success('删除成功')
                    fetchData()
                    fetchStats()
                  })
                  .catch((err) => Toast.error(err?.error || '删除失败'))
              }}
            >
              <Button size="small" type="danger" icon={<IconDelete />}>删除</Button>
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  const statusTabs = [
    { label: '全部', itemKey: '' },
    { label: '草稿', itemKey: 'draft' },
    { label: '已发布', itemKey: 'published' },
    { label: '已归档', itemKey: 'archived' },
  ]

  return (
    <div style={{ padding: 20 }}>
      <Typography.Title heading={4} style={{ marginTop: 0 }}>
        高级表格页
      </Typography.Title>
      <Typography.Paragraph type="tertiary" style={{ marginTop: 4 }}>
        支持行内编辑、拖拽排序、批量操作、列显隐、置顶与快速视图切换
      </Typography.Paragraph>

      <div style={CARD_STYLE}>
        <Space wrap style={{ width: '100%' }}>
          <Tag color="blue">总记录 {stats?.total ?? '-'}</Tag>
          <Tag color="green">已发布 {stats?.published_count ?? '-'}</Tag>
          <Tag color="purple">置顶 {stats?.pinned_count ?? '-'}</Tag>
          <Tag color="orange">平均进度 {stats?.avg_progress ?? '-'}%</Tag>
          <Tag color="grey">平均评分 {stats?.avg_score ?? '-'}</Tag>
        </Space>
      </div>

      <div style={CARD_STYLE}>
        <Space wrap>
          <Input
            value={search}
            onChange={setSearch}
            placeholder="搜索名称/编码/标签/负责人"
            style={{ width: 260 }}
          />
          <Select
            value={category}
            onChange={setCategory}
            placeholder="分类"
            optionList={[{ label: '全部分类', value: '' }, ...CATEGORY_OPTIONS]}
            style={{ width: 130 }}
          />
          <Switch checked={pinnedOnly} onChange={setPinnedOnly} />
          <Typography.Text type="tertiary">仅看置顶</Typography.Text>
          <Button icon={<IconSearch />} theme="solid" onClick={onSearch}>查询</Button>
          <Button icon={<IconRefresh />} onClick={() => {
            fetchData()
            fetchStats()
          }}>
            刷新
          </Button>
          <Button icon={<IconSetting />} onClick={() => setColumnSettingVisible(true)}>列设置</Button>
          <Button onClick={openSortSheet}>拖拽排序</Button>
          <Button icon={<IconUndo />} disabled={!lastSnapshot} onClick={undoLastEdit}>撤销上次编辑</Button>
          <Button
            icon={<IconPlus />}
            theme="solid"
            type="primary"
            onClick={() => setCreateVisible(true)}
          >
            新增
          </Button>
        </Space>
      </div>

      <div style={CARD_STYLE}>
        <Tabs
          type="card"
          collapsible
          activeKey={filters.status ?? ''}
          onChange={(key) => {
            list.handleSearch({ status: key })
          }}
        >
          {statusTabs.map((tab) => (
            <Tabs.TabPane tab={tab.label} itemKey={tab.itemKey} key={tab.itemKey} />
          ))}
        </Tabs>
        <Space>
          <Button onClick={() => doBatchSetStatus('published')}>批量发布</Button>
          <Button onClick={() => doBatchSetStatus('archived')}>批量归档</Button>
          <Popconfirm
            title="确认批量删除选中记录？"
            onConfirm={doBatchDelete}
          >
            <Button type="danger">批量删除</Button>
          </Popconfirm>
        </Space>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={tableColumns}
        dataSource={data}
        pagination={{
          currentPage: page,
          pageSize: 20,
          total,
          onPageChange: (nextPage) => handlePageChange(nextPage),
        }}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys),
        }}
        scroll={{ x: 1600 }}
      />

      <Modal
        title="新增记录"
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => {
          const rowCode = `ADV-${Date.now().toString().slice(-6)}`
          const safeSortOrder = Math.floor(Date.now() / 1000)
          createAdvancedTableRow({
            name: `新记录-${new Date().toLocaleTimeString('zh-CN', { hour12: false })}`,
            row_code: rowCode,
            category: 'general',
            owner: 'admin',
            status: 'draft',
            priority: 50,
            progress: 0,
            score: 0,
            tags: '新建',
            is_active: true,
            is_pinned: false,
            sort_order: safeSortOrder,
            remark: '可立即进行行内编辑',
          })
            .then(() => {
              Toast.success('新增成功')
              setCreateVisible(false)
              list.handleSearch()
              fetchStats()
            })
            .catch((err) => Toast.error(err?.error || '新增失败'))
        }}
      >
        <Typography.Text type="tertiary">将创建一条可直接行内编辑的默认记录。</Typography.Text>
      </Modal>

      <Modal
        title="列设置"
        visible={columnSettingVisible}
        onCancel={() => setColumnSettingVisible(false)}
        onOk={() => setColumnSettingVisible(false)}
      >
        <Checkbox.Group
          value={visibleColumns}
          options={ALL_COLUMNS.map((item) => ({ label: item.label, value: item.key }))}
          onChange={(values) => setVisibleColumns(values)}
          direction="vertical"
        />
      </Modal>

      <SideSheet
        title="拖拽排序"
        visible={sortSheetVisible}
        onCancel={() => setSortSheetVisible(false)}
        size="medium"
        footer={
          <Space>
            <Button onClick={() => setSortSheetVisible(false)}>取消</Button>
            <Button theme="solid" type="primary" onClick={saveSort}>保存排序</Button>
          </Space>
        }
      >
        <Typography.Paragraph type="tertiary">
          拖动条目后保存，系统会更新 `sort_order`，表格将按新顺序展示。
        </Typography.Paragraph>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            const { active, over } = event
            if (!over || active.id === over.id) return
            setSortItems((prev) => {
              const oldIndex = prev.findIndex((item) => item.id === active.id)
              const newIndex = prev.findIndex((item) => item.id === over.id)
              if (oldIndex < 0 || newIndex < 0) return prev
              return arrayMove(prev, oldIndex, newIndex)
            })
          }}
        >
          <SortableContext items={sortItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
            {sortItems.map((item) => (
              <SortableItem key={item.id} item={item} />
            ))}
          </SortableContext>
        </DndContext>
      </SideSheet>
    </div>
  )
}
