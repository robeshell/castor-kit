import { CARD_STYLE } from '@/shared/styles'
import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Table, Button, Modal, Form, Toast,
  Popconfirm, Tag, Space, Typography, Select,
} from '@douyinfe/semi-ui'
import {
  IconSend, IconPlus, IconRefresh, IconEdit, IconDelete,
  IconUpload, IconDownload,
} from '@douyinfe/semi-icons'
import ExportFieldsModal from '@/shared/components/import-export/ExportFieldsModal'
import ImportCsvModal from '@/shared/components/import-export/ImportCsvModal'
import { downloadBlobFile } from '@/shared/utils/file'
import {
  getAnnouncements, createAnnouncement, updateAnnouncement,
  deleteAnnouncement, publishAnnouncement, unpublishAnnouncement,
  exportAnnouncements, downloadAnnouncementTemplate, importAnnouncements,
} from '@/modules/admin/api/announcement'


const TYPE_OPTIONS = [
  { label: '系统公告', value: 'system' },
  { label: '活动公告', value: 'activity' },
  { label: '版本更新', value: 'update' },
]

const TYPE_COLOR_MAP = {
  system: 'blue',
  activity: 'orange',
  update: 'green',
}

const TYPE_LABEL_MAP = {
  system: '系统公告',
  activity: '活动公告',
  update: '版本更新',
}

const STATUS_FILTER_OPTIONS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发布', value: 'published' },
]

const EXPORT_FIELD_OPTIONS = [
  { label: 'ID', value: 'id' },
  { label: '标题', value: 'title' },
  { label: '公告类型', value: 'announce_type' },
  { label: '状态', value: 'status' },
  { label: '是否置顶', value: 'is_top' },
  { label: '排序权重', value: 'sort_order' },
  { label: '内容', value: 'content' },
  { label: '发布时间', value: 'publish_at' },
  { label: '创建时间', value: 'created_at' },
]

export default function Announcements() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getAnnouncements(params).catch(() => {
      Toast.error('加载失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handleSearch, handlePageChange } = list
  const [modalVisible, setModalVisible] = useState(false)
  const [editing, setEditing] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [exportVisible, setExportVisible] = useState(false)
  const [importVisible, setImportVisible] = useState(false)
  const formApiRef = useRef()

  useEffect(() => { fetchData() }, [])

  const handleStatusFilterChange = (val) => {
    handleSearch({ status: val })
  }

  const openCreate = () => {
    setEditing(null)
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditing(record)
    setModalVisible(true)
  }

  const handleDelete = (id) => {
    deleteAnnouncement(id)
      .then(() => {
        Toast.success('删除成功')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handlePublish = (record) => {
    publishAnnouncement(record.id)
      .then(() => {
        Toast.success('已发布')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '操作失败'))
  }

  const handleUnpublish = (record) => {
    unpublishAnnouncement(record.id)
      .then(() => {
        Toast.success('已撤回为草稿')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '操作失败'))
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      const action = editing
        ? updateAnnouncement(editing.id, values)
        : createAnnouncement(values)
      action
        .then(() => {
          Toast.success(editing ? '编辑成功' : '创建成功')
          setModalVisible(false)
          handleSearch()
        })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const handleExport = ({ fields, fileType }) => {
    exportAnnouncements({ fields, file_type: fileType, export_mode: 'all' })
      .then((blob) => {
        downloadBlobFile(blob, `announcements_export.${fileType}`)
        setExportVisible(false)
        Toast.success('导出成功')
      })
      .catch(() => Toast.error('导出失败'))
  }

  const handleDownloadTemplate = (fileType) => {
    downloadAnnouncementTemplate(fileType)
      .then((blob) => downloadBlobFile(blob, `announcements_template.${fileType}`))
      .catch(() => Toast.error('模板下载失败'))
  }

  const handleImport = (file) => importAnnouncements(file)

  const columns = [
    {
      title: '类型',
      dataIndex: 'announce_type',
      width: 100,
      render: (v) => (
        <Tag color={TYPE_COLOR_MAP[v] || 'blue'} size="small">
          {TYPE_LABEL_MAP[v] || v}
        </Tag>
      ),
    },
    {
      title: '标题',
      dataIndex: 'title',
      render: (v, record) => (
        <Space>
          {record.is_top && <Tag color="red" size="small">置顶</Tag>}
          <span style={{ fontWeight: 500 }}>{v}</span>
        </Space>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) =>
        v === 'published' ? (
          <Tag color="green" size="small">已发布</Tag>
        ) : (
          <Tag color="grey" size="small">草稿</Tag>
        ),
    },
    {
      title: '发布时间',
      dataIndex: 'publish_at',
      width: 160,
      render: (v) => v?.slice(0, 19).replace('T', ' ') || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v) => v?.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      width: 200,
      render: (_, record) => (
        <Space>
          {record.status === 'draft' ? (
            <Popconfirm title="确认发布该公告？" onConfirm={() => handlePublish(record)}>
              <Button size="small" type="primary" theme="light">发布</Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="确认撤回该公告？" onConfirm={() => handleUnpublish(record)}>
              <Button size="small" theme="light">撤回</Button>
            </Popconfirm>
          )}
          <Button size="small" icon={<IconEdit />} onClick={() => openEdit(record)}>编辑</Button>
          <Popconfirm
            title="确认删除该公告？"
            content="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" type="danger" icon={<IconDelete />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  const initValues = editing
    ? {
        title: editing.title,
        content: editing.content,
        announce_type: editing.announce_type,
        status: editing.status,
        is_top: editing.is_top,
        sort_order: editing.sort_order,
      }
    : { announce_type: 'system', status: 'draft', is_top: false, sort_order: 0 }

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        <Space>
          <IconSend />
          公告管理
        </Space>
      </Typography.Title>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Select
              value={filters.status ?? ''}
              onChange={handleStatusFilterChange}
              optionList={STATUS_FILTER_OPTIONS}
              style={{ width: 120 }}
            />
            <Button icon={<IconRefresh />} onClick={() => fetchData()}>刷新</Button>
          </Space>
          <Space>
            <Button icon={<IconUpload />} onClick={() => setImportVisible(true)}>导入</Button>
            <Button icon={<IconDownload />} onClick={() => setExportVisible(true)}>导出</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>
              新增公告
            </Button>
          </Space>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <Table
          columns={columns}
          dataSource={data}
          loading={loading}
          rowKey="id"
          pagination={{
            total,
            currentPage: page,
            pageSize: 20,
            onPageChange: (p) => handlePageChange(p),
          }}
        />
      </div>

      <Modal
        title={editing ? '编辑公告' : '新增公告'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        afterClose={() => formApiRef.current?.reset()}
        width={isMobile ? '95vw' : 560}
      >
        <Form
          key={editing?.id ?? 'create'}
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={initValues}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input
            field="title"
            label="标题"
            rules={[{ required: true, message: '请输入公告标题' }]}
            placeholder="请输入公告标题"
          />
          <Form.Select
            field="announce_type"
            label="公告类型"
            optionList={TYPE_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.TextArea
            field="content"
            label="内容"
            placeholder="请输入公告内容（可选）"
            autosize={{ minRows: 4, maxRows: 8 }}
          />
          <Form.Select
            field="status"
            label="状态"
            optionList={[
              { label: '草稿', value: 'draft' },
              { label: '已发布', value: 'published' },
            ]}
            style={{ width: '100%' }}
          />
          <Form.Switch field="is_top" label="是否置顶" />
          <Form.InputNumber
            field="sort_order"
            label="排序权重"
            placeholder="数字越小越靠前"
            style={{ width: '100%' }}
          />
        </Form>
      </Modal>

      <ExportFieldsModal
        visible={exportVisible}
        title="导出公告"
        fieldOptions={EXPORT_FIELD_OPTIONS}
        onCancel={() => setExportVisible(false)}
        onConfirm={handleExport}
      />

      <ImportCsvModal
        visible={importVisible}
        title="导入公告"
        targetLabel="公告列表"
        onCancel={() => setImportVisible(false)}
        onDownloadTemplate={handleDownloadTemplate}
        onImport={handleImport}
        onImported={() => { handleSearch() }}
        errorExportFileName="announcements_import_errors.csv"
      />
    </div>
  )
}
