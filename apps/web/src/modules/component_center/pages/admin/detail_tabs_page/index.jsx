import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { Briefcase, Building2, CalendarDays, Mail, Pencil, Phone, Plus, Trash2, UserRound, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/lib/toast'
import { EASE_OUT, layoutSpring } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  createDetailMember,
  deleteDetailMember,
  getDetailMembers,
  updateDetailMember,
} from '@/modules/component_center/api/detail_tabs_page'
import ConfirmAction from '@/shared/components/ConfirmAction'
import EmptyState from '@/shared/components/EmptyState'
import { SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormCustom, FormDate, FormGrid, FormInput, FormSelect, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'

// 头像颜色是持久化到数据库的业务数据（后端默认 #4080FF），不是页面样式
const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#06B6D4', '#FF4D4F', '#8C8C8C']
const DEFAULT_COLOR = COLOR_PALETTE[0]

const STATUS_META = {
  active: { label: '在职', tone: 'success' },
  leave: { label: '已离职', tone: 'neutral' },
  probation: { label: '试用期', tone: 'warning' },
}
const STATUS_OPTIONS = [
  { value: 'active', label: '在职' },
  { value: 'leave', label: '已离职' },
  { value: 'probation', label: '试用期' },
]

// ── 静态演示数据（与原页面一致） ──────────────────────────────────────
const STATIC_WORK_HISTORY = [
  { time: '2022-03 – 至今', title: '高级前端工程师', company: 'castor-kit 科技', desc: '负责核心产品前端架构设计与研发，主导组件库建设。' },
  { time: '2019-07 – 2022-02', title: '前端工程师', company: '字节跳动', desc: '参与飞书文档模块迭代，负责协作编辑功能开发。' },
  { time: '2017-07 – 2019-06', title: '初级前端工程师', company: '阿里巴巴（实习）', desc: '参与淘宝活动页面开发，使用 React + TypeScript。' },
  { time: '2013-09 – 2017-06', title: '计算机科学与技术', company: '同济大学', desc: '本科毕业，GPA 3.8/4.0，多次获得奖学金。' },
]
const STATIC_LOGS = [
  { time: '2026-03-18 14:32', action: '编辑成员', operator: 'admin', tone: 'info' },
  { time: '2026-03-15 09:10', action: '状态变更', operator: 'hr_zhang', tone: 'warning' },
  { time: '2026-03-10 16:50', action: '新建成员', operator: 'admin', tone: 'success' },
  { time: '2026-02-28 11:05', action: '附件上传', operator: 'hr_zhang', tone: 'brand' },
  { time: '2026-01-15 08:30', action: '权限调整', operator: 'admin', tone: 'danger' },
]
const TABS = [
  { value: 'info', label: '基本信息' },
  { value: 'history', label: '工作经历' },
  { value: 'logs', label: '操作日志' },
]

const EMPTY_FORM = {
  name: '',
  department: '',
  role_title: '',
  email: '',
  phone: '',
  status: 'active',
  join_date: '',
  avatar_color: DEFAULT_COLOR,
  bio: '',
}

// ── 小组件 ─────────────────────────────────────────────────────────
function MemberAvatar({ name, color, className }) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)] select-none',
        className,
      )}
      style={{ background: color || DEFAULT_COLOR }}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </span>
  )
}

function ColorPicker({ value, onChange }) {
  const sel = (value || DEFAULT_COLOR).toUpperCase()
  return (
    <div className="flex items-center gap-2.5">
      {COLOR_PALETTE.map((c) => {
        const selected = sel === c.toUpperCase()
        return (
          <button
            key={c}
            type="button"
            aria-label={`颜色 ${c}`}
            aria-pressed={selected}
            onClick={() => onChange(c)}
            className={cn(
              'ring-offset-background size-6 rounded-full transition-[box-shadow,transform] duration-150 hover:scale-110',
              selected && 'ring-foreground/70 ring-2 ring-offset-2',
            )}
            style={{ background: c }}
          />
        )
      })}
    </div>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {Icon ? <Icon className="text-muted-foreground size-3.5 shrink-0" /> : null}
        <span className={cn('truncate', !value && 'text-muted-foreground/60')}>{value || '-'}</span>
      </dd>
    </div>
  )
}

function InfoTab({ member }) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <InfoItem icon={Building2} label="部门" value={member.department} />
        <InfoItem icon={Briefcase} label="职位" value={member.role_title} />
        <InfoItem icon={Mail} label="邮箱" value={member.email} />
        <InfoItem icon={Phone} label="电话" value={member.phone} />
        <InfoItem icon={CalendarDays} label="入职日期" value={member.join_date ? member.join_date.slice(0, 10) : ''} />
      </dl>
      {member.bio ? (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">个人简介</p>
          <p className="bg-muted/60 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed whitespace-pre-wrap">{member.bio}</p>
        </div>
      ) : null}
    </div>
  )
}

function HistoryTab() {
  return (
    <ol className="relative space-y-6 pl-6">
      <span className="bg-border absolute top-1.5 bottom-1.5 left-[5px] w-px" aria-hidden />
      {STATIC_WORK_HISTORY.map((item, idx) => (
        <li key={item.time} className="relative">
          <span
            className={cn(
              'absolute top-1 -left-6 size-[11px] rounded-full ring-4 ring-[var(--card)]',
              idx === 0 ? 'bg-brand-gradient' : 'bg-muted-foreground/35',
            )}
            aria-hidden
          />
          <p className="text-muted-foreground font-mono text-xs tabular-nums">{item.time}</p>
          <p className="mt-1 text-sm font-medium">{item.title}</p>
          <p className="text-muted-foreground text-xs">{item.company}</p>
          <p className="text-muted-foreground mt-1.5 text-[13px] leading-relaxed">{item.desc}</p>
        </li>
      ))}
    </ol>
  )
}

function LogsTab() {
  return (
    <ul className="divide-y">
      {STATIC_LOGS.map((log) => (
        <li key={log.time} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
          <StatusBadge tone={log.tone} dot>
            {log.action}
          </StatusBadge>
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">操作人：{log.operator}</span>
          <span className="text-muted-foreground/80 font-mono text-xs tabular-nums">{log.time}</span>
        </li>
      ))}
    </ul>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-2 py-2.5">
          <Skeleton className="size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────
export default function DetailTabsPage() {
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('info')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const form = useForm({ defaultValues: EMPTY_FORM })

  const fetchMembers = useCallback(
    () =>
      getDetailMembers()
        .then((res) => {
          const list = res?.items || res || []
          setMembers(list)
          // 首次进入默认选中第一位成员，右侧不留空
          setSelectedId((cur) => (cur === null && list.length ? list[0].id : cur))
        })
        .catch(() => toast.error('加载成员列表失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.department || '').toLowerCase().includes(q) ||
        (m.role_title || '').toLowerCase().includes(q),
    )
  }, [members, search])

  const selectedMember = members.find((m) => m.id === selectedId) || null

  // ── CRUD ───────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    form.reset(EMPTY_FORM)
    setFormOpen(true)
  }
  const openEdit = (member) => {
    setEditing(member)
    form.reset({
      name: member.name,
      department: member.department || '',
      role_title: member.role_title || '',
      email: member.email || '',
      phone: member.phone || '',
      status: member.status || 'active',
      join_date: member.join_date ? member.join_date.slice(0, 10) : '',
      avatar_color: member.avatar_color || DEFAULT_COLOR,
      bio: member.bio || '',
    })
    setFormOpen(true)
  }

  const submit = async (values) => {
    const payload = {
      name: values.name,
      department: values.department || '',
      role_title: values.role_title || '',
      email: values.email || '',
      phone: values.phone || '',
      status: values.status || 'active',
      join_date: values.join_date || null,
      avatar_color: values.avatar_color || DEFAULT_COLOR,
      bio: values.bio || '',
    }
    try {
      if (editing) {
        await updateDetailMember(editing.id, payload)
      } else {
        const created = await createDetailMember(payload)
        if (created?.id) setSelectedId(created.id)
      }
      toast.success(editing ? '成员已更新' : '成员已创建')
      setFormOpen(false)
      fetchMembers()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const remove = async (member) => {
    try {
      await deleteDetailMember(member.id)
      toast.success('成员已删除')
      if (selectedId === member.id) setSelectedId(null)
      fetchMembers()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const status = selectedMember ? STATUS_META[selectedMember.status] || STATUS_META.active : null

  return (
    <div>
      <PageHeader
        title="详情标签页"
        actions={
          <Button size="sm" variant="brand" onClick={openCreate}>
            <Plus />
            新建成员
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* ── 左侧成员列表 ── */}
        <Panel padded={false} className="flex flex-col lg:h-[calc(100dvh-210px)] lg:min-h-[480px]" bodyClassName="flex min-h-0 flex-1 flex-col">
          <div className="border-b p-3">
            <SearchInput value={search} onChange={setSearch} placeholder="搜索姓名 / 部门 / 职位" className="sm:w-full" />
          </div>
          <div className="max-h-[360px] min-h-0 flex-1 overflow-y-auto lg:max-h-none">
            {loading ? (
              <ListSkeleton />
            ) : filteredMembers.length === 0 ? (
              <EmptyState icon={Users} title="暂无成员" description={search ? '换个关键词试试' : '点击右上角「新建成员」添加'} />
            ) : (
              <ul className="space-y-0.5 p-2">
                {filteredMembers.map((m, i) => {
                  const sm = STATUS_META[m.status] || STATUS_META.active
                  const selected = selectedId === m.id
                  return (
                    <motion.li
                      key={m.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, ease: EASE_OUT, delay: Math.min(i, 10) * 0.025 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedId(m.id)}
                        aria-current={selected ? 'true' : undefined}
                        className={cn(
                          'relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors',
                          !selected && 'hover:bg-muted/60',
                        )}
                      >
                        {selected ? (
                          <motion.span
                            layoutId="detail-member-active"
                            transition={layoutSpring}
                            className="bg-brand-soft absolute inset-0 rounded-lg shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_18%,transparent)]"
                          />
                        ) : null}
                        <MemberAvatar name={m.name} color={m.avatar_color} className="relative size-9 text-sm" />
                        <span className="relative min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-medium">{m.name}</span>
                            <StatusBadge tone={sm.tone} variant="plain" dot className="shrink-0">
                              {sm.label}
                            </StatusBadge>
                          </span>
                          <span className="text-muted-foreground block truncate text-xs">
                            {[m.department, m.role_title].filter(Boolean).join(' · ') || '-'}
                          </span>
                        </span>
                      </button>
                    </motion.li>
                  )
                })}
              </ul>
            )}
          </div>
          {!loading && members.length ? (
            <div className="text-muted-foreground border-t px-4 py-2.5 text-xs tabular-nums">
              {search.trim() ? `${filteredMembers.length} / ${members.length} 位成员` : `共 ${members.length} 位成员`}
            </div>
          ) : null}
        </Panel>

        {/* ── 右侧详情 ── */}
        <Panel padded={false} className="min-h-[420px] lg:h-[calc(100dvh-210px)] lg:min-h-[480px]" bodyClassName="h-full">
          {!selectedMember ? (
            <div className="flex h-full min-h-[420px] items-center justify-center">
              <EmptyState icon={UserRound} title="选择左侧成员查看详情" />
            </div>
          ) : (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selectedMember.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                className="flex h-full flex-col"
              >
                <div className="flex flex-col gap-4 p-5 pb-0 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-4">
                    <MemberAvatar name={selectedMember.name} color={selectedMember.avatar_color} className="size-14 text-xl" />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="truncate text-lg font-semibold tracking-tight">{selectedMember.name}</h2>
                        <StatusBadge tone={status.tone} dot>
                          {status.label}
                        </StatusBadge>
                      </div>
                      <p className="text-muted-foreground truncate text-[13px]">
                        {[selectedMember.role_title, selectedMember.department].filter(Boolean).join(' · ') || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={() => openEdit(selectedMember)}>
                      <Pencil />
                      编辑
                    </Button>
                    <ConfirmAction
                      title={`确定删除成员「${selectedMember.name}」？`}
                      description="此操作不可恢复。"
                      confirmText="删除"
                      onConfirm={() => remove(selectedMember)}
                    >
                      <Button variant="ghost" size="sm" className="text-danger hover:text-danger">
                        <Trash2 />
                        删除
                      </Button>
                    </ConfirmAction>
                  </div>
                </div>

                <SegmentedTabs value={tab} onChange={setTab} items={TABS} className="mt-5 px-5" />

                <div className="min-h-0 flex-1 overflow-y-auto p-5">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={tab}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                    >
                      {tab === 'info' ? <InfoTab member={selectedMember} /> : tab === 'history' ? <HistoryTab /> : <LogsTab />}
                    </motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </Panel>
      </div>

      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editing ? '编辑成员' : '新建成员'}
        description={editing ? `正在编辑 ${editing.name}` : undefined}
        form={form}
        onSubmit={submit}
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="姓名" placeholder="请输入姓名" rules={{ required: '请输入姓名' }} />
          <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
          <FormInput control={form.control} name="department" label="部门" placeholder="请输入部门" />
          <FormInput control={form.control} name="role_title" label="职位" placeholder="请输入职位" />
          <FormInput control={form.control} name="email" label="邮箱" placeholder="请输入邮箱" />
          <FormInput control={form.control} name="phone" label="电话" placeholder="请输入电话" />
        </FormGrid>
        <FormDate control={form.control} name="join_date" label="入职日期" placeholder="请选择入职日期" />
        <FormCustom
          control={form.control}
          name="avatar_color"
          label="头像颜色"
          render={({ value, onChange }) => <ColorPicker value={value} onChange={onChange} />}
        />
        <FormTextarea control={form.control} name="bio" label="个人简介" placeholder="请输入个人简介（选填）" rows={3} />
      </FormDialog>
    </div>
  )
}
