import { useState, useEffect, useCallback, useRef } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Typography,
  Button,
  Modal,
  Form,
  Toast,
  Tag,
  Table,
  Progress,
  Space,
  Spin,
  Empty,
} from '@douyinfe/semi-ui'
import { IconPlus, IconEdit, IconDelete } from '@douyinfe/semi-icons'
import ReactECharts from 'echarts-for-react'
import {
  getGanttTasks,
  createGanttTask,
  updateGanttTask,
  deleteGanttTask,
} from '@/modules/component_center/api/gantt_page'

const { Title, Paragraph, Text } = Typography

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: '16px 20px',
  boxShadow: '0 1px 4px rgba(0,0,0,.08)',
}

const PRIORITY_COLOR = {
  low:      '#8c8c8c',
  medium:   '#4080FF',
  high:     '#FA8C16',
  critical: '#FF4D4F',
}

const STATUS_META = {
  not_started: { label: '未开始', color: 'grey' },
  in_progress: { label: '进行中', color: 'blue' },
  completed:   { label: '已完成', color: 'green' },
  delayed:     { label: '已延期', color: 'red' },
}

const TYPE_META = {
  phase:     '阶段',
  task:      '任务',
  milestone: '里程碑',
}

const TYPE_COLOR = {
  phase:     'purple',
  task:      'blue',
  milestone: 'orange',
}

const COLOR_PALETTE = ['#4080FF', '#00B96B', '#FA8C16', '#9254DE', '#FF4D4F', '#8c8c8c']

const PRIORITY_OPTIONS = [
  { value: 'low',      label: '低' },
  { value: 'medium',   label: '中' },
  { value: 'high',     label: '高' },
  { value: 'critical', label: '紧急' },
]

const STATUS_OPTIONS = Object.entries(STATUS_META).map(([v, m]) => ({ value: v, label: m.label }))

const TYPE_OPTIONS = Object.entries(TYPE_META).map(([v, l]) => ({ value: v, label: l }))

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

// ── ECharts Gantt Option ────────────────────────────────────────────
function buildGanttOption(tasks) {
  if (!tasks || tasks.length === 0) return null

  const yAxisData = tasks.map((t) => t.title)

  let minTime = Infinity
  let maxTime = -Infinity
  tasks.forEach((t) => {
    if (t.start_date) {
      const s = +new Date(t.start_date)
      if (s < minTime) minTime = s
    }
    if (t.end_date) {
      const e = +new Date(t.end_date)
      if (e > maxTime) maxTime = e
    }
  })

  if (!isFinite(minTime) || !isFinite(maxTime)) return null

  // Pad a bit
  const pad = (maxTime - minTime) * 0.03 || 86400000
  const xMin = minTime - pad
  const xMax = maxTime + pad

  const seriesData = tasks.map((t, i) => ({
    name: t.title,
    value: [i, +new Date(t.start_date), +new Date(t.end_date), t.progress || 0],
    itemStyle: { color: t.color || PRIORITY_COLOR[t.priority] || '#4080FF' },
  }))

  return {
    backgroundColor: 'transparent',
    tooltip: {
      formatter: (params) => {
        const [yIdx, start, end, progress] = params.value
        const task = tasks[yIdx]
        if (!task) return ''
        const startStr = new Date(start).toISOString().slice(0, 10)
        const endStr = new Date(end).toISOString().slice(0, 10)
        return `<b>${task.title}</b><br/>开始：${startStr}<br/>结束：${endStr}<br/>进度：${progress}%`
      },
    },
    grid: { left: 20, right: 20, top: 40, bottom: 30, containLabel: true },
    xAxis: {
      type: 'time',
      min: xMin,
      max: xMax,
      axisLabel: { color: '#595959' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    yAxis: {
      data: yAxisData,
      inverse: true,
      axisLabel: {
        color: '#595959',
        width: 120,
        overflow: 'truncate',
      },
      splitLine: { show: false },
    },
    series: [
      {
        type: 'custom',
        renderItem: (params, api) => {
          const yIdx = api.value(0)
          const startCoord = api.coord([api.value(1), yIdx])
          const endCoord = api.coord([api.value(2), yIdx])
          const progress = api.value(3) / 100
          const barHeight = api.size([0, 1])[1] * 0.5
          const x = startCoord[0]
          const y = startCoord[1] - barHeight / 2
          const totalWidth = Math.max(endCoord[0] - startCoord[0], 1)
          const progressWidth = Math.max(totalWidth * progress, 0)

          const color = api.style().fill || '#4080FF'

          const children = [
            // background bar
            {
              type: 'rect',
              shape: { x, y, width: totalWidth, height: barHeight, r: 3 },
              style: { fill: color + '33' },
            },
            // progress bar
            {
              type: 'rect',
              shape: { x, y, width: progressWidth, height: barHeight, r: 3 },
              style: { fill: color },
            },
          ]

          // label inside progress bar when wide enough
          if (progressWidth > 30) {
            children.push({
              type: 'text',
              style: {
                x: x + progressWidth / 2,
                y: y + barHeight / 2,
                text: `${Math.round(progress * 100)}%`,
                textAlign: 'center',
                textVerticalAlign: 'middle',
                fill: '#fff',
                fontSize: 11,
                fontWeight: 'bold',
              },
            })
          }

          return { type: 'group', children }
        },
        encode: { x: [1, 2], y: 0 },
        data: seriesData,
      },
    ],
  }
}

// ── Main Page ──────────────────────────────────────────────────────
export default function GanttPage() {
  const isMobile = useIsMobile()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)

  // modal
  const [modalVisible, setModalVisible] = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const formApiRef = useRef(null)
  const [taskColor, setTaskColor] = useState(COLOR_PALETTE[0])

  // ── data ───────────────────────────────────────────────
  const fetchTasks = useCallback(() => {
    setLoading(true)
    getGanttTasks()
      .then((res) => setTasks(res?.items || res || []))
      .catch(() => Toast.error('加载任务失败'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── CRUD ───────────────────────────────────────────────
  const openCreate = () => {
    setEditRecord(null)
    setTaskColor(COLOR_PALETTE[0])
    setModalVisible(true)
  }

  const openEdit = (record) => {
    setEditRecord(record)
    setTaskColor(record.color || COLOR_PALETTE[0])
    setModalVisible(true)
  }

  const handleDelete = (record) => {
    Modal.confirm({
      title: `确定删除任务「${record.title}」？`,
      type: 'warning',
      onOk: () =>
        deleteGanttTask(record.id)
          .then(() => { Toast.success('任务已删除'); fetchTasks() })
          .catch((err) => Toast.error(err?.error || '删除失败')),
    })
  }

  const handleSubmit = () => {
    formApiRef.current?.validate().then((values) => {
      setSubmitting(true)

      const parseDate = (d) => {
        if (!d) return null
        if (typeof d === 'string') return d
        if (d instanceof Date) return d.toISOString().slice(0, 10)
        if (d?.format) return d.format('YYYY-MM-DD')
        return null
      }

      const payload = {
        title: values.title,
        task_type: values.task_type || 'task',
        start_date: parseDate(values.start_date),
        end_date: parseDate(values.end_date),
        progress: values.progress ?? 0,
        assignee: values.assignee || '',
        priority: values.priority || 'medium',
        status: values.status || 'not_started',
        color: taskColor,
      }

      const req = editRecord
        ? updateGanttTask(editRecord.id, payload)
        : createGanttTask(payload)

      req
        .then(() => {
          Toast.success(editRecord ? '任务已更新' : '任务已创建')
          setModalVisible(false)
          fetchTasks()
        })
        .catch((err) => Toast.error(err?.error || '操作失败'))
        .finally(() => setSubmitting(false))
    }).catch(() => {})
  }

  const initValues = editRecord
    ? {
        title: editRecord.title,
        task_type: editRecord.task_type || 'task',
        start_date: editRecord.start_date ? editRecord.start_date.slice(0, 10) : undefined,
        end_date: editRecord.end_date ? editRecord.end_date.slice(0, 10) : undefined,
        progress: editRecord.progress ?? 0,
        assignee: editRecord.assignee || '',
        priority: editRecord.priority || 'medium',
        status: editRecord.status || 'not_started',
      }
    : { task_type: 'task', priority: 'medium', status: 'not_started', progress: 0 }

  // ── table columns ──────────────────────────────────────
  const columns = [
    {
      title: '任务名',
      dataIndex: 'title',
      render: (v, record) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag size="small" color={TYPE_COLOR[record.task_type] || 'grey'}>
            {TYPE_META[record.task_type] || record.task_type || '任务'}
          </Tag>
          <Text strong style={{ fontSize: 13 }}>{v}</Text>
        </div>
      ),
    },
    {
      title: '负责人',
      dataIndex: 'assignee',
      width: 90,
      render: (v) => v || '-',
    },
    {
      title: '进度',
      dataIndex: 'progress',
      width: 120,
      render: (v) => (
        <Progress
          percent={v || 0}
          size="small"
          showInfo
          style={{ width: 100 }}
        />
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v) => {
        const m = STATUS_META[v] || { label: v, color: 'grey' }
        return <Tag size="small" color={m.color}>{m.label}</Tag>
      },
    },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Space>
          <Button
            icon={<IconEdit />}
            size="small"
            theme="borderless"
            type="tertiary"
            onClick={() => openEdit(record)}
          />
          <Button
            icon={<IconDelete />}
            size="small"
            theme="borderless"
            type="danger"
            onClick={() => handleDelete(record)}
          />
        </Space>
      ),
    },
  ]

  const ganttOption = buildGanttOption(tasks)

  // ── render ─────────────────────────────────────────────
  return (
    <div style={{ padding: 0 }}>
      {/* 标题栏 */}
      <div style={{ ...CARD_STYLE, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Title heading={5} style={{ marginBottom: 4 }}>甘特图页</Title>
            <Paragraph type="tertiary" size="small" style={{ margin: 0 }}>
              结合任务列表与 ECharts 自定义甘特图，展示项目进度与时间分布。
            </Paragraph>
          </div>
          <Button icon={<IconPlus />} theme="solid" onClick={openCreate}>
            新建任务
          </Button>
        </div>
      </div>

      {/* 主体区 */}
      <div style={{ ...CARD_STYLE }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <Spin size="large" />
          </div>
        ) : tasks.length === 0 ? (
          <Empty description="暂无任务，点击「新建任务」开始" style={{ padding: 60 }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 16, alignItems: 'flex-start', overflowX: 'auto' }}>
            {/* 左侧任务表格 40% */}
            <div style={{ width: isMobile ? '100%' : '40%', flexShrink: 0 }}>
              <Table
                columns={columns}
                dataSource={tasks}
                rowKey="id"
                pagination={false}
                size="small"
              />
            </div>

            {/* 右侧甘特图 60% */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {ganttOption ? (
                <ReactECharts
                  option={ganttOption}
                  style={{ height: Math.max(tasks.length * 50 + 80, 300) }}
                  notMerge
                />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
                  <Text type="tertiary">任务日期不完整，无法渲染甘特图</Text>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 新建/编辑 Modal */}
      <Modal
        title={editRecord ? '编辑任务' : '新建任务'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okButtonProps={{ loading: submitting }}
        afterClose={() => { formApiRef.current?.reset(); setEditRecord(null) }}
        width={isMobile ? '95vw' : 520}
      >
        <Form
          key={editRecord ? `et-${editRecord.id}` : 'nt'}
          initValues={initValues}
          getFormApi={(api) => { formApiRef.current = api }}
          labelPosition="left"
          labelWidth={80}
        >
          <Form.Input
            field="title"
            label="任务名称"
            placeholder="请输入任务名称"
            rules={[{ required: true, message: '请输入任务名称' }]}
          />
          <Form.Select
            field="task_type"
            label="任务类型"
            optionList={TYPE_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.DatePicker
            field="start_date"
            label="开始日期"
            style={{ width: '100%' }}
            placeholder="请选择开始日期"
            format="yyyy-MM-dd"
            type="date"
          />
          <Form.DatePicker
            field="end_date"
            label="结束日期"
            style={{ width: '100%' }}
            placeholder="请选择结束日期"
            format="yyyy-MM-dd"
            type="date"
          />
          <Form.InputNumber
            field="progress"
            label="进度 (%)"
            min={0}
            max={100}
            style={{ width: '100%' }}
          />
          <Form.Input field="assignee" label="负责人" placeholder="请输入负责人" />
          <Form.Select
            field="priority"
            label="优先级"
            optionList={PRIORITY_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.Select
            field="status"
            label="状态"
            optionList={STATUS_OPTIONS}
            style={{ width: '100%' }}
          />
          <Form.Slot label="任务颜色">
            <ColorPicker
              value={taskColor}
              onChange={(c) => setTaskColor(c)}
            />
          </Form.Slot>
        </Form>
      </Modal>
    </div>
  )
}
