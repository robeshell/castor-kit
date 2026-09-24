import { CARD_STYLE } from '@/shared/styles'
import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Table, Button, Modal, Form, Toast,
  Popconfirm, Tag, Input, Space, Typography, Tree,
} from '@douyinfe/semi-ui'
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons'
import {
  getRoles, createRole, updateRole, deleteRole,
  exportRoles, downloadRolesTemplate, importRoles,
} from '@/modules/admin/api/roles'
import { getMenus } from '@/modules/admin/api/menus'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'

const ROLE_EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '角色名称', value: 'name' },
  { label: '角色编码', value: 'code' },
  { label: '描述', value: 'description' },
  { label: '菜单编码', value: 'menu_codes' },
  { label: '菜单名称', value: 'menu_names' },
  { label: '创建时间', value: 'created_at' },
]
const normalizeFileType = (raw) => (['csv', 'xls', 'xlsx'].includes(raw) ? raw : 'xlsx')

// 将后端菜单树转成 Semi Tree 需要的格式
const convertToTreeData = (menus = []) =>
  menus.map((m) => ({
    label: m.name,
    value: m.id,
    key: String(m.id),
    children: m.children?.length ? convertToTreeData(m.children) : undefined,
  }))

export default function Roles() {
  const isMobile = useIsMobile()
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [querySearch, setQuerySearch] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [menuTree, setMenuTree] = useState([])
  const [checkedMenus, setCheckedMenus] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [selectedRowKeys, setSelectedRowKeys] = useState([])
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const formApiRef = useRef()

  const fetchData = () => {
    setLoading(true)
    getRoles()
      .then((res) => setData(Array.isArray(res) ? res : []))
      .catch(() => Toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
    getMenus({ format: 'tree' }).then((res) =>
      setMenuTree(convertToTreeData(Array.isArray(res) ? res : []))
    )
  }, [])

  const openCreate = () => {
    setEditRecord(null)
    setCheckedMenus([])
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setCheckedMenus(Array.isArray(record.menu_ids) ? record.menu_ids : (record.menus?.map((m) => m.id) || []))
    setModalVisible(true)
  }

  const normalizeCheckedMenuIds = (vals) => {
    const raw = Array.isArray(vals) ? vals : (vals === undefined || vals === null ? [] : [vals])
    return raw
      .map((v) => (typeof v === 'object' && v !== null ? v.value : v))
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v))
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      const payload = { ...values, menu_ids: checkedMenus }
      const fn = editRecord ? updateRole(editRecord.id, payload) : createRole(payload)
      fn.then(() => {
        Toast.success(editRecord ? '修改成功' : '创建成功')
        setModalVisible(false)
        fetchData()
      })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleDelete = (id) => {
    deleteRole(id)
      .then(() => { Toast.success('删除成功'); fetchData() })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleSearch = () => {
    setQuerySearch(search.trim())
    setSelectedRowKeys([])
  }

  const handleReset = () => {
    setSearch('')
    setQuerySearch('')
    setSelectedRowKeys([])
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
    exportRoles(payload)
      .then((blob) => {
        downloadBlobFile(blob, `roles_export.${finalFileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch((err) => Toast.error(err?.error || '导出失败'))
  }

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 70 },
    { title: '角色名称', dataIndex: 'name' },
    {
      title: '角色编码',
      dataIndex: 'code',
      render: (v) => <Tag color="cyan">{v}</Tag>,
    },
    { title: '描述', dataIndex: 'description' },
    {
      title: '菜单权限',
      dataIndex: 'menus',
      render: (menus) => <Tag color="green">{menus?.length || 0} 个</Tag>,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      render: (v) => v?.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除该角色？"
            content="删除后不可恢复"
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

  const initValues = editRecord
    ? { name: editRecord.name, code: editRecord.code, description: editRecord.description }
    : {}
  const filteredData = data.filter((item) => {
    if (!querySearch) {
      return true
    }
    const keyword = querySearch.toLowerCase()
    return String(item.name || '').toLowerCase().includes(keyword)
      || String(item.code || '').toLowerCase().includes(keyword)
  })

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        角色管理
      </Typography.Title>

      <div style={CARD_STYLE}>
        <Space style={{ flexWrap: 'wrap' }}>
          <Input
            prefix={<IconSearch />}
            placeholder="搜索角色名称/编码"
            value={search}
            onChange={(v) => setSearch(v)}
            onEnterPress={handleSearch}
            style={{ width: isMobile ? '100%' : 240 }}
          />
          <Button icon={<IconSearch />} type="primary" onClick={handleSearch}>查询</Button>
          <Button icon={<IconRefresh />} onClick={handleReset}>重置</Button>
        </Space>
      </div>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
          <Typography.Text strong>角色列表</Typography.Text>
          <Space>
            <Button onClick={() => setImportModalVisible(true)}>导入</Button>
            <Button onClick={() => setExportModalVisible(true)}>导出</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>
              新建角色
            </Button>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={filteredData}
          loading={loading}
          rowKey="id"
          scroll={{}}
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys),
          }}
          pagination={false}
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
        title={editRecord ? '编辑角色' : '新建角色'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        width={isMobile ? '95vw' : 560}
        afterClose={() => formApiRef.current?.reset()}
      >
        <Form getFormApi={api => formApiRef.current = api} initValues={initValues} labelPosition="left" labelWidth={90}>
          <Form.Input
            field="name"
            label="角色名称"
            rules={[{ required: true, message: '请输入角色名称' }]}
          />
          <Form.Input
            field="code"
            label="角色编码"
            rules={[{ required: true, message: '请输入角色编码' }]}
            disabled={!!editRecord}
          />
          <Form.Input field="description" label="描述" />
        </Form>

        <div style={{ marginTop: 12 }}>
          <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'var(--semi-color-text-0)' }}>
            菜单权限
          </div>
          <div
            style={{
              border: '1px solid var(--semi-color-border)',
              borderRadius: 4,
              padding: '8px 12px',
              maxHeight: 280,
              overflow: 'auto',
            }}
          >
            {menuTree.length > 0 ? (
              <Tree
                treeData={menuTree}
                multiple
                expandAll
                autoMergeValue={false}
                value={checkedMenus}
                onChange={(vals) => setCheckedMenus(normalizeCheckedMenuIds(vals))}
                style={{ width: '100%' }}
              />
            ) : (
              <div style={{ color: 'var(--semi-color-text-2)', fontSize: 13 }}>暂无菜单数据</div>
            )}
          </div>
        </div>
      </Modal>

      <ExportFieldsModal
        visible={exportModalVisible}
        title="角色导出字段"
        ruleHint={
          selectedRowKeys.length > 0
            ? `已勾选 ${selectedRowKeys.length} 条，将优先导出勾选数据`
            : '未勾选数据时，将导出当前列表全部结果'
        }
        fieldOptions={ROLE_EXPORT_FIELDS}
        defaultFields={['name', 'code', 'description', 'menu_codes']}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importModalVisible}
        title="导入角色"
        targetLabel="角色管理"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadRolesTemplate(normalizeFileType(fileType))
            .then((blob) => {
              const ext = normalizeFileType(fileType)
              downloadBlobFile(blob, `roles_import_template.${ext}`)
              Toast.success('模板下载成功')
            })
            .catch((err) => Toast.error(err?.error || '模板下载失败'))
        }
        onImport={(file) => importRoles(file)}
        onImported={(res) => {
          Toast.success(`导入成功：新增 ${res?.created || 0} 条，更新 ${res?.updated || 0} 条`)
          fetchData()
        }}
        errorExportFileName="roles_import_error_rows.csv"
      />
    </div>
  )
}
