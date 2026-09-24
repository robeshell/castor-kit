import { CARD_STYLE } from '@/shared/styles'
import { useState, useEffect, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { useCrudList } from '@/shared/hooks/useCrudList'
import {
  Table, Button, Modal, Form, Toast,
  Popconfirm, Tag, Space, Typography, Select, Switch,
} from '@douyinfe/semi-ui'
import {
  IconBell, IconPlus, IconRefresh, IconCheckboxTick, IconDelete,
} from '@douyinfe/semi-icons'
import {
  getNotifications, createNotification, markAsRead, markAllAsRead, deleteNotification,
} from '@/modules/admin/api/notifications'
import { getUsers } from '@/modules/admin/api/users'


const TYPE_COLOR_MAP = {
  info: 'blue',
  success: 'green',
  warning: 'orange',
  error: 'red',
}

const TYPE_LABEL_MAP = {
  info: '信息',
  success: '成功',
  warning: '警告',
  error: '错误',
}

const FILTER_OPTIONS = [
  { label: '全部', value: 'all' },
  { label: '未读', value: 'false' },
  { label: '已读', value: 'true' },
]

const TYPE_OPTIONS = [
  { label: '信息 (info)', value: 'info' },
  { label: '成功 (success)', value: 'success' },
  { label: '警告 (warning)', value: 'warning' },
  { label: '错误 (error)', value: 'error' },
]

export default function Notifications() {
  const isMobile = useIsMobile()
  const list = useCrudList(
    (params) => getNotifications(params).catch(() => {
      Toast.error('加载失败')
      return { items: [], total: 0 }
    }),
    { defaultPerPage: 20 },
  )
  const { data, total, loading, page, filters, fetchData, handleSearch, handlePageChange } = list
  const [modalVisible, setModalVisible] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [isGlobal, setIsGlobal] = useState(true)
  const [users, setUsers] = useState([])
  const formApiRef = useRef()

  useEffect(() => {
    handleSearch({ is_read: 'all' })
    getUsers({ page: 1, per_page: 100 })
      .then((res) => setUsers(Array.isArray(res.items) ? res.items : []))
      .catch(() => {})
  }, [])

  const handleFilterChange = (val) => {
    handleSearch({ is_read: val })
  }

  const handleMarkRead = (id) => {
    markAsRead(id)
      .then(() => {
        Toast.success('已标记为已读')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '操作失败'))
  }

  const handleMarkAllRead = () => {
    markAllAsRead()
      .then((res) => {
        Toast.success(`已将 ${res?.marked ?? 0} 条通知标记为已读`)
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '操作失败'))
  }

  const handleDelete = (id) => {
    deleteNotification(id)
      .then(() => {
        Toast.success('删除成功')
        fetchData()
      })
      .catch((err) => Toast.error(err?.error || '删除失败'))
  }

  const handleSubmit = () => {
    formApiRef.current.validate().then((values) => {
      setSubmitting(true)
      createNotification(values)
        .then(() => {
          Toast.success('通知创建成功')
          setModalVisible(false)
          handleSearch()
        })
        .catch((err) => Toast.error(err?.error || '创建失败'))
        .finally(() => setSubmitting(false))
    })
  }

  const openCreate = () => {
    setIsGlobal(true)
    setModalVisible(true)
  }

  const columns = [
    {
      title: '类型',
      dataIndex: 'noti_type',
      width: 80,
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
        <span style={{ fontWeight: record.is_read ? 400 : 600, color: record.is_read ? 'var(--semi-color-text-2)' : 'var(--semi-color-text-0)' }}>
          {v}
        </span>
      ),
    },
    {
      title: '内容',
      dataIndex: 'content',
      render: (v) => (
        <span
          style={{
            display: 'inline-block',
            maxWidth: 260,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: 'var(--semi-color-text-2)',
            fontSize: 13,
          }}
          title={v}
        >
          {v || '-'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_read',
      width: 80,
      render: (v) =>
        v ? (
          <Tag color="grey" size="small">已读</Tag>
        ) : (
          <Tag color="blue" size="small">未读</Tag>
        ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v) => v?.slice(0, 19).replace('T', ' '),
    },
    {
      title: '操作',
      width: 140,
      render: (_, record) => (
        <Space>
          {!record.is_read && (
            <Button
              size="small"
              icon={<IconCheckboxTick />}
              onClick={() => handleMarkRead(record.id)}
              title="标记为已读"
            >
              已读
            </Button>
          )}
          <Popconfirm
            title="确认删除该通知？"
            content="删除后不可恢复"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button size="small" type="danger" icon={<IconDelete />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Typography.Title heading={5} style={{ marginBottom: 16 }}>
        <Space>
          <IconBell />
          消息通知
        </Space>
      </Typography.Title>

      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <Select
              value={filters.is_read ?? 'all'}
              onChange={handleFilterChange}
              optionList={FILTER_OPTIONS}
              style={{ width: 120 }}
            />
            <Button icon={<IconRefresh />} onClick={() => fetchData()}>刷新</Button>
          </Space>
          <Space>
            <Button onClick={handleMarkAllRead}>全部已读</Button>
            <Button icon={<IconPlus />} theme="solid" type="primary" onClick={openCreate}>
              新建通知
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
          scroll={{}}
          pagination={{
            total,
            currentPage: page,
            pageSize: 20,
            onPageChange: (p) => handlePageChange(p),
          }}
          rowStyle={(record) => ({
            background: record.is_read ? 'transparent' : 'var(--semi-color-primary-light-default)',
          })}
        />
      </div>

      <Modal
        title="新建通知"
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        afterClose={() => {
          formApiRef.current?.reset()
          setIsGlobal(true)
        }}
        width={isMobile ? '95vw' : 520}
      >
        <Form
          getFormApi={(api) => { formApiRef.current = api }}
          initValues={{ noti_type: 'info', is_global: true }}
          labelPosition="left"
          labelWidth={90}
        >
          <Form.Input
            field="title"
            label="标题"
            rules={[{ required: true, message: '请输入通知标题' }]}
            placeholder="请输入通知标题"
          />
          <Form.TextArea
            field="content"
            label="内容"
            placeholder="请输入通知内容（可选）"
            autosize={{ minRows: 3, maxRows: 6 }}
          />
          <Form.Select
            field="noti_type"
            label="类型"
            optionList={TYPE_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.Input
            field="link"
            label="跳转链接"
            placeholder="可选，如 /system/users"
          />
          <Form.Switch
            field="is_global"
            label="全局通知"
            onChange={(v) => setIsGlobal(v)}
          />
          {!isGlobal && (
            <Form.Select
              field="user_id"
              label="指定用户"
              optionList={users.map((u) => ({ label: u.username, value: u.id }))}
              style={{ width: '100%' }}
              placeholder="请选择目标用户"
              rules={[{ required: true, message: '请选择目标用户' }]}
              filter
            />
          )}
        </Form>
      </Modal>
    </div>
  )
}
