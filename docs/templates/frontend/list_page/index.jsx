/**
 * 标准列表页模板（含导入导出）
 *
 * TODO: 替换所有 <Resource>、<resource> 占位符
 * TODO: 补充实际字段定义（columns、EXPORT_FIELDS、表单字段）
 * TODO: 调整搜索条件
 *
 * 参考实现：frontend/src/modules/admin/pages/users/index.jsx
 */
import { useEffect, useRef, useState } from 'react'
import {
  Button, Form, Input, Modal, Popconfirm,
  Space, Table, Toast, Typography,
} from '@douyinfe/semi-ui'
import { IconPlus, IconSearch } from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  getItems, createItem, updateItem, deleteItem,
  exportItems, downloadTemplate, importItems,
} from '../../api/<resource>'

const { Title } = Typography

// TODO: 按实际字段调整（与后端 EXPORT_FIELD_MAP key 对应）
const EXPORT_FIELDS = [
  { label: 'ID', value: 'id' },
  { label: '名称', value: 'name' },
  // { label: '状态', value: 'status' },
  { label: '创建时间', value: 'created_at' },
]

const PER_PAGE = 20

export default function <Resource>Page() {
  const [list, setList] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [importModalVisible, setImportModalVisible] = useState(false)
  const formApiRef = useRef()

  // ── 数据加载 ────────────────────────────────────────────────────────────────
  const fetchList = (p = page, s = search) => {
    setLoading(true)
    getItems({ page: p, per_page: PER_PAGE, search: s })
      .then((res) => {
        setList(res.items || [])
        setTotal(res.total || 0)
      })
      .catch(() => Toast.error('加载失败'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchList() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 搜索 ────────────────────────────────────────────────────────────────────
  const handleSearch = () => {
    setPage(1)
    fetchList(1, search)
  }

  // ── 新增 / 编辑弹窗 ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingItem(null)
    setModalVisible(true)
    setTimeout(() => formApiRef.current?.reset(), 0)
  }

  const openEdit = (item) => {
    setEditingItem(item)
    setModalVisible(true)
    setTimeout(() => formApiRef.current?.setValues(item), 0)
  }

  const handleModalOk = async () => {
    let values
    try {
      values = await formApiRef.current.validate()
    } catch {
      return
    }
    try {
      if (editingItem) {
        await updateItem(editingItem.id, values)
        Toast.success('更新成功')
      } else {
        await createItem(values)
        Toast.success('创建成功')
      }
      setModalVisible(false)
      fetchList()
    } catch (err) {
      Toast.error(err?.response?.data?.error || '操作失败')
    }
  }

  // ── 删除 ────────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      await deleteItem(id)
      Toast.success('删除成功')
      fetchList()
    } catch {
      Toast.error('删除失败')
    }
  }

  // ── 导出 ────────────────────────────────────────────────────────────────────
  const handleExport = ({ fields, fileType }) => {
    exportItems({ fields, file_type: fileType })
      .then((blob) => {
        downloadBlobFile(blob, `<resource>_export.${fileType}`)
        Toast.success('导出成功')
        setExportModalVisible(false)
      })
      .catch(() => Toast.error('导出失败'))
  }

  // ── 表格列定义 ───────────────────────────────────────────────────────────────
  // TODO: 替换为实际字段
  const columns = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '名称', dataIndex: 'name' },
    // { title: '状态', dataIndex: 'status', width: 100 },
    // { title: '创建时间', dataIndex: 'created_at', width: 180 },
    {
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button size="small" onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" type="danger">删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      {/* 页头 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title heading={4}>TODO: 页面标题</Title>
        <Space>
          <Button onClick={() => setImportModalVisible(true)}>导入</Button>
          <Button onClick={() => setExportModalVisible(true)}>导出</Button>
          <Button icon={<IconPlus />} type="primary" onClick={openCreate}>新增</Button>
        </Space>
      </div>

      {/* 搜索栏 */}
      <Space style={{ marginBottom: 16 }}>
        <Input
          prefix={<IconSearch />}
          placeholder="搜索名称…"
          value={search}
          onChange={setSearch}
          onEnterPress={handleSearch}
          style={{ width: 240 }}
        />
        <Button onClick={handleSearch}>搜索</Button>
      </Space>

      {/* 表格 */}
      <Table
        columns={columns}
        dataSource={list}
        loading={loading}
        rowKey="id"
        pagination={{
          total,
          currentPage: page,
          pageSize: PER_PAGE,
          onPageChange: (p) => { setPage(p); fetchList(p) },
        }}
      />

      {/* 新增/编辑弹窗 */}
      <Modal
        title={editingItem ? '编辑' : '新增'}
        visible={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={480}
      >
        <Form getFormApi={(api) => { formApiRef.current = api }} labelPosition="left" labelWidth={80}>
          {/* TODO: 补充实际表单字段 */}
          <Form.Input
            field="name"
            label="名称"
            rules={[{ required: true, message: '请输入名称' }]}
          />
        </Form>
      </Modal>

      {/* 导出弹窗 */}
      <ExportFieldsModal
        visible={exportModalVisible}
        title="导出设置"
        fieldOptions={EXPORT_FIELDS}
        onCancel={() => setExportModalVisible(false)}
        onConfirm={handleExport}
      />

      {/* 导入弹窗 */}
      <ImportCsvModal
        visible={importModalVisible}
        title="导入数据"
        targetLabel="TODO: 资源名称"
        onCancel={() => setImportModalVisible(false)}
        onDownloadTemplate={(fileType) =>
          downloadTemplate(fileType)
            .then((blob) => {
              downloadBlobFile(blob, `<resource>_import_template.${fileType}`)
              Toast.success('模板下载成功')
            })
            .catch(() => Toast.error('模板下载失败'))
        }
        onImport={importItems}
        onImported={() => { setImportModalVisible(false); fetchList() }}
        errorExportFileName="<resource>_import_errors.csv"
      />
    </div>
  )
}
