import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Typography,
  Button,
  Input,
  Modal,
  Form,
  Toast,
  Tag,
  Tabs,
  TabPane,
  Divider,
  Empty,
  Spin,
  Timeline,
} from '@douyinfe/semi-ui'
import {
  IconPlus,
  IconEdit,
  IconDelete,
  IconSearch,
  IconMail,
  IconPhone,
  IconCalendar,
} from '@douyinfe/semi-icons'
import {
  getDetailMembers,
  createDetailMember,
  updateDetailMember,
  deleteDetailMember,
} from '@/modules/component_center/api/detail_tabs_page'

const { Title, Paragraph, Text } = Typography

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
}

const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#9254DE', '#FF4D4F', '#8c8c8c']

const STATUS_META = {
  active:    { label: '在职',   color: 'green' },
  leave:     { label: '已离职', color: 'grey' },
  probation: { label: '试用期', color: 'orange' },
}

const STATUS_OPTIONS = [
  { value: 'active',    label: '在职' },
  { value: 'leave',     label: '已离职' },
  { value: 'probation', label: '试用期' },
]

// ── 静态 Timeline 数据 ──────────────────────────────────────────────
const STATIC_WORK_HISTORY = [
  { time: '2022-03 – 至今',   title: '高级前端工程师',  company: 'castor-kit 科技',    desc: '负责核心产品前端架构设计与研发，主导组件库建设。' },
  { time: '2019-07 – 2022-02', title: '前端工程师',      company: '字节跳动',          desc: '参与飞书文档模块迭代，负责协作编辑功能开发。' },
  { time: '2017-07 – 2019-06', title: '初级前端工程师',  company: '阿里巴巴（实习）',  desc: '参与淘宝活动页面开发，使用 React + TypeScript。' },
  { time: '2013-09 – 2017-06', title: '计算机科学与技术', company: '同济大学',          desc: '本科毕业，GPA 3.8/4.0，多次获得奖学金。' },
]

// ── 静态操作日志 ──────────────────────────────────────────────────
const STATIC_LOGS = [
  { time: '2026-03-18 14:32', action: '编辑成员',   operator: 'admin',    type: 'blue' },
  { time: '2026-03-15 09:10', action: '状态变更',   operator: 'hr_zhang', type: 'orange' },
  { time: '2026-03-10 16:50', action: '新建成员',   operator: 'admin',    type: 'green' },
  { time: '2026-02-28 11:05', action: '附件上传',   operator: 'hr_zhang', type: 'purple' },
  { time: '2026-01-15 08:30', action: '权限调整',   operator: 'admin',    type: 'red' },
]

// ── ColorPicker ────────────────────────────────────────────────────
function ColorPicker({ value, onChange }) {
  const [sel, setSel] = useState(value || COLOR_PALETTE[0])

  useEffect(() => {
    if (value) setSel(value)
  }, [value])

  const pick = (c) => {
    setSel(c)
    onChange && onChange(c)
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
      {COLOR_PALETTE.map((c) => (
        <div
          key={c}
          onClick={() => pick(c)}
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: c,
            cursor: 'pointer',
            boxSizing: 'border-box',
            border: sel === c ? '2px solid #fff' : '2px solid transparent',
            outline: sel === c ? `2px solid ${c}` : 'none',
            transition: 'outline .12s',
          }}
        />
      ))}
    </div>
  )
}

// ── Avatar 圆形 ────────────────────────────────────────────────────
function Avatar({ name, color, size = 36 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || '#4080FF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontWeight: 600,
        fontSize: size * 0.38,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  )
}

// ── InfoRow ────────────────────────────────────────────────────────
function InfoRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Text type="tertiary" size="small">{label}</Text>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {icon && <span style={{ color: 'var(--semi-color-text-2)', display: 'flex' }}>{icon}</span>}
        <Text>{value || '-'}</Text>
      </div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function DetailTabsPage() {
  const isMobile = useIsMobile()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  // modal
  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const formApiRef = useRef(null)
  const [avatarColor, setAvatarColor] = useState(COLOR_PALETTE[0])

  // ── data ───────────────────────────────────────────────
  const fetchMembers = useCallback(() => {
    setLoading(true)
    getDetailMembers()
      .then((res) => setMembers(res?.items || res || []))
      .catch(() => Toast.error('加载成员列表失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      (m.name || '').toLowerCase().includes(q) ||
      (m.department || '').toLowerCase().includes(q) ||
      (m.role_title || '').toLowerCase().includes(q)
    )
  })

  const selectedMember = members.find((m) => m.id === selectedId) || null

  // ── CRUD ───────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null)
    setAvatarColor(COLOR_PALETTE[0])
    setModalVisible(true)
  }

  const openEdit = (member) => {
    setEditRecord(member)
    setAvatarColor(member.avatar_color || COLOR_PALETTE[0])
    setModalVisible(true)
  }

  const handleDelete = (member) => {
    Modal.confirm({
      title: `确定删除成员「${member.name}」？`,
      content: '此操作不可恢复。',
      type: 'warning',
      onOk: () =>
        deleteDetailMember(member.id)
          .then(() => {
            Toast.success('成员已删除')
            if (selectedId === member.id) setSelectedId(null)
            fetchMembers()
          })
          .catch((err) => Toast.error(err?.error || '删除失败')),
    })
  }

  const handleSubmit = () => {
    formApiRef.current?.validate().then((values) => {
      setSubmitting(true)
      let joinDate = null
      if (values.join_date) {
        if (typeof values.join_date === 'string') {
          joinDate = values.join_date
        } else if (values.join_date instanceof Date) {
          joinDate = values.join_date.toISOString().slice(0, 10)
        } else if (values.join_date?.format) {
          joinDate = values.join_date.format('YYYY-MM-DD')
        }
      }
      const payload = {
        name: values.name,
        department: values.department || '',
        role_title: values.role_title || '',
        email: values.email || '',
        phone: values.phone || '',
        status: values.status || 'active',
        join_date: joinDate,
        avatar_color: avatarColor,
        bio: values.bio || '',
      }
      const req = editRecord
        ? updateDetailMember(editRecord.id, payload)
        : createDetailMember(payload)
      req
        .then(() => {
          Toast.success(editRecord ? '成员已更新' : '成员已创建')
          setModalVisible(false)
          fetchMembers()
        })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setSubmitting(false))
    }).catch(() => {})
  }

  const initValues = editRecord
    ? {
        name: editRecord.name,
        department: editRecord.department || '',
        role_title: editRecord.role_title || '',
        email: editRecord.email || '',
        phone: editRecord.phone || '',
        status: editRecord.status || 'active',
        join_date: editRecord.join_date ? editRecord.join_date.slice(0, 10) : undefined,
        bio: editRecord.bio || '',
      }
    : { status: 'active' }

  // ── render ─────────────────────────────────────────────
  return (
    <div style={{ padding: 0 }}>
      <div style={{ ...CARD_STYLE, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 0, minHeight: isMobile ? 'auto' : 'calc(100vh - 140px)' }}>
        {/* ── 左侧面板 ── */}
        <div
          style={{
            width: isMobile ? '100%' : 280,
            flexShrink: 0,
            borderRight: isMobile ? 'none' : '1px solid var(--semi-color-border)',
            borderBottom: isMobile ? '1px solid var(--semi-color-border)' : 'none',
            display: 'flex',
            flexDirection: 'column',
            paddingRight: isMobile ? 0 : 16,
            marginRight: 16,
          }}
        >
          {/* 标题 + 新建 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Title heading={5} style={{ margin: 0 }}>详情标签页</Title>
            <Button icon={<IconPlus />} size="small" theme="solid" onClick={openCreate}>
              新建成员
            </Button>
          </div>

          {/* 搜索框 */}
          <Input
            prefix={<IconSearch />}
            placeholder="搜索姓名 / 部门 / 职位"
            value={search}
            onChange={(v) => setSearch(v)}
            style={{ marginBottom: 10 }}
          />

          {/* 成员列表 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
                <Spin />
              </div>
            ) : filteredMembers.length === 0 ? (
              <Empty description="暂无成员" style={{ paddingTop: 40 }} />
            ) : (
              filteredMembers.map((m) => {
                const sm = STATUS_META[m.status] || STATUS_META.active
                const isSelected = selectedId === m.id
                return (
                  <div
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      marginBottom: 2,
                      background: isSelected
                        ? 'var(--semi-color-primary-light-default)'
                        : 'transparent',
                      transition: 'background .15s',
                    }}
                  >
                    <Avatar name={m.name} color={m.avatar_color} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <Text strong style={{ fontSize: 13 }}>{m.name}</Text>
                        <Tag size="small" color={sm.color}>{sm.label}</Tag>
                      </div>
                      <Text type="tertiary" size="small" ellipsis>
                        {[m.department, m.role_title].filter(Boolean).join(' · ') || '-'}
                      </Text>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ── 右侧详情区 ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!selectedMember ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 400 }}>
              <Empty description="选择左侧成员查看详情" />
            </div>
          ) : (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <Avatar name={selectedMember.name} color={selectedMember.avatar_color} size={50} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Title heading={5} style={{ margin: 0 }}>{selectedMember.name}</Title>
                    <Tag size="small" color={(STATUS_META[selectedMember.status] || STATUS_META.active).color}>
                      {(STATUS_META[selectedMember.status] || STATUS_META.active).label}
                    </Tag>
                  </div>
                  <Text type="tertiary">{selectedMember.role_title || '-'}</Text>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button icon={<IconEdit />} size="small" onClick={() => openEdit(selectedMember)}>编辑</Button>
                  <Button icon={<IconDelete />} size="small" type="danger" theme="light" onClick={() => handleDelete(selectedMember)}>删除</Button>
                </div>
              </div>

              <Divider style={{ margin: '0 0 16px' }} />

              {/* Tabs */}
              <Tabs type="line">
                {/* Tab 1：基本信息 */}
                <TabPane tab="基本信息" itemKey="1">
                  <div style={{ padding: '16px 0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                      <InfoRow label="部门" value={selectedMember.department} />
                      <InfoRow label="职位" value={selectedMember.role_title} />
                      <InfoRow icon={<IconMail size="small" />} label="邮箱" value={selectedMember.email} />
                      <InfoRow icon={<IconPhone size="small" />} label="电话" value={selectedMember.phone} />
                      <InfoRow
                        icon={<IconCalendar size="small" />}
                        label="入职日期"
                        value={selectedMember.join_date ? selectedMember.join_date.slice(0, 10) : '-'}
                      />
                    </div>
                    {selectedMember.bio && (
                      <div>
                        <Text type="tertiary" size="small" style={{ display: 'block', marginBottom: 6 }}>个人简介</Text>
                        <div
                          style={{
                            background: 'var(--semi-color-fill-0)',
                            borderRadius: 6,
                            padding: '10px 12px',
                            lineHeight: '1.7',
                          }}
                        >
                          <Paragraph style={{ margin: 0 }}>{selectedMember.bio}</Paragraph>
                        </div>
                      </div>
                    )}
                  </div>
                </TabPane>

                {/* Tab 2：工作经历 */}
                <TabPane tab="工作经历" itemKey="2">
                  <div style={{ padding: '16px 0' }}>
                    <Timeline>
                      {STATIC_WORK_HISTORY.map((item, idx) => (
                        <Timeline.Item key={idx} time={item.time}>
                          <div>
                            <Text strong style={{ fontSize: 14 }}>{item.title}</Text>
                            <Text type="tertiary" size="small" style={{ display: 'block', margin: '2px 0 4px' }}>
                              {item.company}
                            </Text>
                            <Paragraph type="tertiary" size="small" style={{ margin: 0 }}>
                              {item.desc}
                            </Paragraph>
                          </div>
                        </Timeline.Item>
                      ))}
                    </Timeline>
                  </div>
                </TabPane>

                {/* Tab 3：操作日志 */}
                <TabPane tab="操作日志" itemKey="3">
                  <div style={{ padding: '16px 0' }}>
                    {STATIC_LOGS.map((log, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 0',
                          borderBottom: idx < STATIC_LOGS.length - 1 ? '1px solid var(--semi-color-border)' : 'none',
                        }}
                      >
                        <Tag size="small" color={log.type}>{log.action}</Tag>
                        <Text type="tertiary" size="small" style={{ flex: 1 }}>
                          操作人：{log.operator}
                        </Text>
                        <Text type="quaternary" size="small">{log.time}</Text>
                      </div>
                    ))}
                  </div>
                </TabPane>
              </Tabs>
            </div>
          )}
        </div>
      </div>

      {/* 新建/编辑 Modal */}
      <Modal
        title={editRecord ? '编辑成员' : '新建成员'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        afterClose={() => { formApiRef.current?.reset(); setEditRecord(null) }}
        width={isMobile ? '95vw' : 480}
      >
        <Form
          key={editRecord ? `em-${editRecord.id}` : 'nm'}
          initValues={initValues}
          getFormApi={(api) => { formApiRef.current = api }}
          labelPosition="left"
          labelWidth={80}
        >
          <Form.Input
            field="name"
            label="姓名"
            placeholder="请输入姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          />
          <Form.Input field="department" label="部门" placeholder="请输入部门" />
          <Form.Input field="role_title" label="职位" placeholder="请输入职位" />
          <Form.Input field="email" label="邮箱" placeholder="请输入邮箱" />
          <Form.Input field="phone" label="电话" placeholder="请输入电话" />
          <Form.Select
            field="status"
            label="状态"
            optionList={STATUS_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.DatePicker
            field="join_date"
            label="入职日期"
            style={{ width: '100%' }}
            placeholder="请选择入职日期"
            format="yyyy-MM-dd"
            type="date"
          />
          <Form.Slot label="头像颜色">
            <ColorPicker
              value={avatarColor}
              onChange={(c) => setAvatarColor(c)}
            />
          </Form.Slot>
          <Form.TextArea
            field="bio"
            label="个人简介"
            placeholder="请输入个人简介（选填）"
            rows={3}
          />
        </Form>
      </Modal>
    </div>
  )
}
