import { CARD_STYLE } from '@/shared/styles'
import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Table, Button, Modal, Form, Toast,
  Popconfirm, Tag, Input, Space, Typography, Tooltip,
} from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconSearch, IconArrowUp, IconArrowDown } from '@douyinfe/semi-icons'
import {
  getMenus, createMenu, updateMenu, deleteMenu, sortMenu,
  exportMenus, downloadMenusTemplate, importMenus,
} from '@/modules/admin/api/menus'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'

const MENU_TYPE_OPTIONS = [
  { label: '目录', value: 'directory' },
  { label: '菜单', value: 'menu' },
  { label: '按钮', value: 'button' },
]

const MENU_TYPE_COLOR = { directory: 'violet', menu: 'blue', button: 'orange' }
const MENU_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '菜单名称', value: 'name' },
  { label: '菜单编码', value: 'code' },
  { label: '类型', value: 'menu_type' },
  { label: '路径', value: 'path' },
  { label: '组件', value: 'component' },
  { label: '图标', value: 'icon' },
  { label: '父级编码', value: 'parent_code' },
  { label: '排序', value: 'sort_order' },
  { label: '是否显示', value: 'is_visible' },
  { label: '是否启用', value: 'is_active' },
  { label: '描述', value: 'description' },
]
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')

// 递归压平树，用于父菜单选择器
const flattenTree = (menus, depth = 0) =>
  menus.flatMap((m) => [
    { label: '\u00a0\u00a0'.repeat(depth) + m.name, value: m.id },
    ...(m.children?.length ? flattenTree(m.children, depth + 1) : []),
  ])

export default function Menus() {
  const isMobile = useIsMobile()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [querySearch, setQuerySearch] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [parentOptions, setParentOptions] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const formApiRef = useRef()

  const fetchData = (searchValue = querySearch) => {
    setQuerySearch(searchValue)
    setLoading(true)
    getMenus({ format: 'tree', search: searchValue })
      .then((res) => {
        const list = Array.isArray(res) ? res : []
        setData(list)
        setParentOptions([
          { label: '无（顶级菜单）', value: null },
          ...flattenTree(list),
        ])
      })
      .catch(() => Toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData('') }, [])

  const openCreate = (parentId = null) => {
    setEditRecord(parentId !== null ? { parent_id: parentId } : null)
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setModalVisible(true)
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      const fn = editRecord?.id
        ? updateMenu(editRecord.id, values)
        : createMenu(values)
      fn.then(() => {
        Toast.success(editRecord?.id ? '修改成功' : '创建成功')
        setModalVisible(false)
        fetchData(querySearch)
      })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleDelete = (id) => {
    deleteMenu(id)
      .then(() => { Toast.success('删除成功'); fetchData(querySearch) })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleSort = (id, direction) => {
    sortMenu(id, direction)
      .then((res) => {
        if (res?.changed) {
          Toast.success('排序成功')
        } else {
          Toast.info(res?.message || '无需调整')
        }
        fetchData(querySearch)
      })
      .catch((err) => Toast.error(err?.error || '排序失败'))
  }

  const handleSearch = () => {
    setSelectedRowKeys([])
    fetchData(search.trim())
  }

  const handleReset = () => {
    setSearch('')
    setSelectedRowKeys([])
    fetchData('')
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
      payload.filters = { search: querySearch }
    }
    exportMenus(payload)
      .then((blob) => {
        downloadBlobFile(blob, `menus_export.${finalFileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  const columns = [
    {
      title: '菜单名称',
      dataIndex: 'name',
      width: 180,
    },
    {
      title: '编码',
      dataIndex: 'code',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: '类型',
      dataIndex: 'menu_type',
      width: 70,
      render: (v) => (
        <Tag color={MENU_TYPE_COLOR[v] || 'grey'}>
          {MENU_TYPE_OPTIONS.find((t) => t.value === v)?.label || v}
        </Tag>
      ),
    },
    { title: '路径', dataIndex: 'path' },
    { title: '组件', dataIndex: 'component', width: 130 },
    { title: '图标', dataIndex: 'icon', width: 90 },
    { title: '排序', dataIndex: 'sort_order', width: 60 },
    {
      title: '显示',
      dataIndex: 'is_visible',
      width: 60,
      render: (v) => <Tag color={v ? 'green' : 'grey'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '启用',
      dataIndex: 'is_active',
      width: 60,
      render: (v) => <Tag color={v ? 'green' : 'grey'}>{v ? '是' : '否'}</Tag>,
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openCreate(record.id)}>
            添加子项
          </Button>
          <Button
            size="small"
            type="tertiary"
            icon={<IconArrowUp />}
            onClick={() => handleSort(record.id, 'up')}
          >
            上移
          </Button>
          <Button
            size="small"
            type="tertiary"
            icon={<IconArrowDown />}
            onClick={() => handleSort(record.id, 'down')}
          >
            下移
          </Button>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该菜单？"
            content="有子菜单时无法删除"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" type="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const initValues = editRecord || { menu_type: 'menu', sort_order: 0, is_visible: true, is_active: true }

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        菜单管理
      </Typography.Title>

      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索菜单名称/编码"
            value={search}
            onChange={(v) => setSearch(v)}
            onEnterPress={handleSearch}
            style={{ width: isMobile ? '100%' : 260 }}
          />
          <Button icon={<IconSearch />} type="primary" onClick={handleSearch}>查询</Button>
          <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <Typography.Text strong>菜单列表</Typography.Text>
          <Space>
            <Button onClick={() => setImportModalVisible(true)}>导入</Button>
            <Button onClick={() => setExportModalVisible(true)}>导出</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={() => openCreate()}>
              新建菜单
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          scroll={{}}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={false}
          expandAllRows
          childrenRecordName="children"
        />
        <div style={{ marginTop: 8 }}>
          <Space>
            <Typography.Text type="tertiary">已勾选 {selectedRowKeys.length} 条</Typography.Text>
            {selectedRowKeys.length > 0 ? (
              <Button size="small" type="tertiary" onClick={() => setSelectedRowKeys([])}>
                清空勾选
              </Button>
            ) : null}
          </Space>
        </div>
      </div>

      <Modal
        title={editRecord?.id ? '编辑菜单' : '新建菜单'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 560}
        afterClose={() => formApiRef.current?.reset()}
      >
        <Form
          getFormApi={api => formApiRef.current = api}
          initValues={initValues}
          labelPosition="left"
          labelWidth={80}
        >
          <Form.Input
            field="name"
            label="名称"
            rules={[{ required: true, message: '请输入菜单名称' }]}
          />
          <Form.Input
            field="code"
            label="编码"
            rules={[{ required: true, message: '请输入菜单编码' }]}
          />
          <Form.Select
            field="menu_type"
            label="类型"
            optionList={MENU_TYPE_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="parent_id"
            label="父菜单"
            optionList={parentOptions}
            style={{ width: '100%' }}
            showClear
          />
          <Form.Input field="path" label="路径" placeholder="/example" />
          <Form.Input
            field="component"
            label="组件"
            placeholder="例如：admin/users、component_center/list_page"
          />
          <Form.Input field="icon" label="图标" placeholder="图标名称" />
          <Form.InputNumber field="sort_order" label="排序" min={0} />
          <Form.Switch field="is_visible" label="显示" />
          <Form.Switch field="is_active" label="启用" />
        </Form>
        <div style={{ marginTop: 8 }}>
          <Tooltip content="组件名需对应 frontend/src/modules/**/pages/**/index.jsx，例如 admin/users -> /modules/admin/pages/users/index.jsx">
            <Typography.Text type="tertiary" size="small">
              提示：动态路由模式下，菜单的路径和组件名都需要配置
            </Typography.Text>
          </Tooltip>
        </div>
      </Modal>

      <ExportFieldsModal
        visible={exportModalVisible}
        title="菜单导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将导出当前列表全部结果'
        }
        fieldOptions={MENU_EXPORT_FIELDS}
        defaultFields={['name', 'code', 'menu_type', 'path', 'component', 'parent_code', 'sort_order']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importModalVisible}
        title="导入菜单"
        targetLabel="菜单管理"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadMenusTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `menus_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importMenus(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="menus_import_error_rows.csv"
      />
    </div>
  )
}
