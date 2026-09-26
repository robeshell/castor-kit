import { useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Code2, Copy, Database, Play, Search, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { chartBase, useChartColors } from '@/lib/chart-theme'
import { fadeUp } from '@/lib/motion'
import { errorMessage, toast } from '@/lib/toast'
import { executeSQL, generateSQL } from '@/modules/component_center/api/ai_sql'
import SchemaSheet from '@/modules/component_center/pages/ai/ai_sql_page/SchemaSheet'
import DataTable from '@/shared/components/DataTable'
import EmptyState from '@/shared/components/EmptyState'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import StatusBadge from '@/shared/components/StatusBadge'

const PAGE_SIZE = 20

// Whether every value in the column is numeric
const isNumericColumn = (rows, col) => {
  if (!rows.length) return false
  return rows.every((r) => {
    const v = r[col]
    return v !== null && v !== '' && !isNaN(Number(v))
  })
}

// Whether the result can be charted (at least 2 columns, the second one numeric)
const canRenderChart = (columns, rows) => {
  if (!columns || columns.length < 2 || !rows || !rows.length) return false
  return isNumericColumn(rows, columns[1])
}

// Sample questions (demo content, not translated)
const EXAMPLE_QUESTIONS = [
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '最近 7 天每天新加入的成员数',
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '各部门分别有多少成员',
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '每个月新加入的成员数（最近 6 个月）',
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '看板每一列各有多少张卡片',
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '甘特图中还没完成的任务，按结束日期排序',
  // i18n-ignore-next-line: sample question sent to the AI as-is
  '统计列表中各分类的金额合计',
]

function ResultChart({ columns, rows }) {
  const c = useChartColors()
  const option = useMemo(() => {
    const base = chartBase(c)
    const xData = rows.map((r) => String(r[columns[0]] ?? ''))
    const yData = rows.map((r) => Number(r[columns[1]]))
    return {
      ...base,
      grid: { ...base.grid, top: 24, bottom: 8 },
      xAxis: {
        ...base.xAxis,
        type: 'category',
        data: xData,
        axisLabel: { ...base.xAxis.axisLabel, rotate: xData.length > 8 ? 30 : 0 },
      },
      yAxis: { ...base.yAxis, type: 'value' },
      series: [
        {
          name: columns[1],
          type: 'bar',
          data: yData,
          barMaxWidth: 40,
          itemStyle: {
            borderRadius: [6, 6, 0, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: c['brand-to'] },
                { offset: 1, color: c['brand-from'] },
              ],
            },
          },
        },
      ],
    }
  }, [c, columns, rows])
  return <ReactECharts option={option} style={{ height: 320 }} notMerge opts={{ renderer: 'svg' }} />
}

export default function AiSqlPage() {
  const { t } = useTranslation()
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null) // { sql, columns, rows, row_count }
  const [sqlEditing, setSqlEditing] = useState('')
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('table')
  const [page, setPage] = useState(1)
  const [schemaOpen, setSchemaOpen] = useState(false)

  const handleGenerate = async () => {
    if (!question.trim()) {
      toast.warning('请输入问题')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await generateSQL({ question: question.trim() })
      setResult(res)
      setSqlEditing(res.sql)
      setActiveTab('table')
      setPage(1)
    } catch (e) {
      setError(errorMessage(e, '请求失败'))
      // Show the SQL too if there is one, to help debugging
      if (e?.sql) setSqlEditing(e.sql)
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!sqlEditing.trim()) {
      toast.warning('SQL 不能为空')
      return
    }
    setExecuting(true)
    setError('')
    try {
      const res = await executeSQL({ sql: sqlEditing.trim() })
      setResult(res)
      setActiveTab('table')
      setPage(1)
    } catch (e) {
      setError(errorMessage(e, '执行失败'))
    } finally {
      setExecuting(false)
    }
  }

  const handleCopySQL = () => {
    navigator.clipboard
      .writeText(sqlEditing)
      .then(() => toast.success('SQL 已复制'))
      .catch(() => toast.error('复制失败'))
  }

  const handleQueryTable = (table) => {
    setSqlEditing(`SELECT * FROM ${table} LIMIT 20`)
    setSchemaOpen(false)
  }

  const rows = useMemo(() => result?.rows || [], [result])
  const columns = useMemo(() => result?.columns || [], [result])
  const pageRows = rows.length > PAGE_SIZE ? rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : rows

  const tableColumns = columns.map((col) => ({
    key: col,
    title: col,
    dataIndex: col,
    ellipsis: true,
    className: 'max-w-[320px] truncate',
    render: (val) =>
      val === null || val === undefined ? (
        <span className="text-muted-foreground font-mono text-xs">NULL</span>
      ) : (
        <span title={String(val)}>{String(val)}</span>
      ),
  }))

  const showChart = result && canRenderChart(result.columns, result.rows)
  const showSqlPanel = !loading && (result || sqlEditing)

  return (
    <div className="space-y-4">
      <PageHeader
        title="AI 数据查询"
        actions={
          <Button variant="outline" size="sm" onClick={() => setSchemaOpen(true)}>
            <Database />
            {t('表结构')}
          </Button>
        }
      />

      {/* Question input */}
      <Panel>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleGenerate()
              }}
              placeholder={t('用自然语言描述你想查什么，例如：最近7天每天新增的用户数')}
              className="h-10 pl-9"
            />
          </div>
          <Button variant="brand" className="h-10 px-5" onClick={handleGenerate} disabled={loading}>
            {loading ? <Spinner /> : <Sparkles />}
            {t('AI 生成')}
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 text-xs">{t('示例：')}</span>
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setQuestion(q)}
              className="bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-accent rounded-full border px-2.5 py-1 text-xs transition-colors duration-150"
            >
              {q}
            </button>
          ))}
        </div>
      </Panel>

      {/* Loading */}
      {loading ? (
        <motion.div {...fadeUp}>
          <Panel>
            <div className="flex flex-col items-center gap-3 py-10">
              <div className="bg-brand-soft text-primary flex size-10 items-center justify-center rounded-xl">
                <Spinner className="size-5" />
              </div>
              <p className="text-muted-foreground text-[13px]">{t('AI 正在分析数据库结构并生成 SQL…')}</p>
            </div>
          </Panel>
        </motion.div>
      ) : null}

      {/* Error */}
      <AnimatePresence>
        {!loading && error ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            role="alert"
            className="bg-danger-soft text-danger flex items-start gap-2 rounded-xl px-4 py-3 text-[13px]"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{error}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* SQL display + editing */}
      {showSqlPanel ? (
        <motion.div {...fadeUp}>
          <Panel
            title={
              <span className="flex items-center gap-2">
                <Code2 className="text-primary size-4" />
                {t('生成的 SQL')}
                <StatusBadge tone="brand">{t('可编辑')}</StatusBadge>
              </span>
            }
            actions={
              <>
                <Button variant="ghost" size="icon-sm" aria-label={t('复制 SQL')} title={t('复制 SQL')} onClick={handleCopySQL}>
                  <Copy />
                </Button>
                <Button variant="outline" size="sm" onClick={handleExecute} disabled={executing}>
                  {executing ? <Spinner /> : <Play />}
                  {t('重新执行')}
                </Button>
              </>
            }
          >
            <textarea
              value={sqlEditing}
              onChange={(e) => setSqlEditing(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  handleExecute()
                }
              }}
              spellCheck={false}
              aria-label={t('SQL 编辑区')}
              className="bg-muted/40 focus-visible:border-ring focus-visible:ring-ring/20 min-h-[110px] w-full resize-y rounded-lg border px-3 py-2.5 font-mono text-[13px] leading-relaxed outline-none focus-visible:ring-2"
            />
            <p className="text-muted-foreground mt-1.5 text-xs">{t('仅允许只读查询 · Ctrl / ⌘ + Enter 执行')}</p>
          </Panel>
        </motion.div>
      ) : null}

      {/* Results */}
      {!loading && result ? (
        <motion.div {...fadeUp}>
          <Panel
            padded={false}
            title={
              <span className="flex items-center gap-2">
                {t('查询结果')}
                <StatusBadge tone="success">{t('{{count}} 行', { count: result.row_count })}</StatusBadge>
              </span>
            }
            actions={
              showChart ? (
                <SegmentedTabs
                  variant="pill"
                  value={activeTab}
                  onChange={setActiveTab}
                  items={[
                    { value: 'table', label: '表格' },
                    { value: 'chart', label: '图表' },
                  ]}
                />
              ) : null
            }
          >
            {rows.length === 0 ? (
              <EmptyState title="查询结果为空" description="换个问题或修改 SQL 后重新执行" />
            ) : activeTab === 'table' || !showChart ? (
              <DataTable
                bordered={false}
                dense
                className="border-t"
                columns={tableColumns}
                data={pageRows}
                rowKey={(row, i) => `${page}-${i}`}
                minWidth={tableColumns.length > 5 ? tableColumns.length * 160 : undefined}
                pagination={rows.length > PAGE_SIZE ? { page, perPage: PAGE_SIZE, total: rows.length, onChange: setPage } : undefined}
              />
            ) : (
              <div className="border-t px-3 pt-2 pb-3">
                <ResultChart columns={columns} rows={rows} />
              </div>
            )}
          </Panel>
        </motion.div>
      ) : null}

      {/* Empty-state guide */}
      {!loading && !result && !error && !sqlEditing ? (
        <Panel>
          <EmptyState
            icon={Search}
            title="在上方输入自然语言问题，AI 会自动生成 SQL 并执行"
            description="支持查询用户、角色、菜单、日志等所有业务数据"
            className="py-16"
          />
        </Panel>
      ) : null}

      <SchemaSheet open={schemaOpen} onOpenChange={setSchemaOpen} onQueryTable={handleQueryTable} />
    </div>
  )
}
