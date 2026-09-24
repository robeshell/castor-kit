import React, { useState, useRef } from 'react'
import {
  Typography, Button, Input, Table, Tag, Spin, Toast,
  Empty, Tooltip, Tabs, TabPane,
} from '@douyinfe/semi-ui'
import {
  IconSend, IconPlay, IconCopy, IconRefresh, IconCode,
  IconSearch,
} from '@douyinfe/semi-icons'
import ReactECharts from 'echarts-for-react'
import { generateSQL, executeSQL } from '@/modules/component_center/api/ai_sql'

const { Title, Text, Paragraph } = Typography

const CARD_STYLE = {
  background: 'var(--semi-color-bg-1)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
}

// 判断列的值是否全为数字
const isNumericColumn = (rows, col) => {
  if (!rows.length) return false
  return rows.every(r => {
    const v = r[col]
    return v !== null && v !== '' && !isNaN(Number(v))
  })
}

// 自动推断是否可以出图（2列，第二列是数字）
const canRenderChart = (columns, rows) => {
  if (!columns || columns.length < 2 || !rows || !rows.length) return false
  return isNumericColumn(rows, columns[1])
}

// 构建 ECharts 配置
const buildChartOption = (columns, rows) => {
  const xData = rows.map(r => String(r[columns[0]] ?? ''))
  const yData = rows.map(r => Number(r[columns[1]]))
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 60, containLabel: true },
    xAxis: {
      type: 'category',
      data: xData,
      axisLabel: { rotate: xData.length > 8 ? 30 : 0, fontSize: 12 },
    },
    yAxis: { type: 'value' },
    series: [{
      name: columns[1],
      type: 'bar',
      data: yData,
      itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 48,
    }],
  }
}

// 示例问题
const EXAMPLE_QUESTIONS = [
  '最近 7 天每天新增的用户数',
  '每个角色分别有多少用户',
  '各类型菜单各有多少条',
  '登录日志中登录失败次数最多的前 10 个用户',
  '所有定时任务及其状态',
  '每个月新增用户数趋势（最近 6 个月）',
]

export default function AiSqlPage() {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)  // { sql, columns, rows, row_count }
  const [sqlEditing, setSqlEditing] = useState('')
  const [executing, setExecuting] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('table')
  const textAreaRef = useRef(null)

  const handleGenerate = async () => {
    if (!question.trim()) {
      Toast.warning('请输入问题')
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
    } catch (e) {
      const msg = e?.response?.data?.error || e.message || '请求失败'
      setError(msg)
      // 如果有 sql 也展示出来，方便调试
      if (e?.response?.data?.sql) {
        setSqlEditing(e.response.data.sql)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleExecute = async () => {
    if (!sqlEditing.trim()) {
      Toast.warning('SQL 不能为空')
      return
    }
    setExecuting(true)
    setError('')
    try {
      const res = await executeSQL({ sql: sqlEditing.trim() })
      setResult(res)
      setActiveTab('table')
    } catch (e) {
      setError(e?.response?.data?.error || e.message || '执行失败')
    } finally {
      setExecuting(false)
    }
  }

  const handleCopySQL = () => {
    navigator.clipboard.writeText(sqlEditing).then(() => Toast.success('SQL 已复制'))
  }

  const handleExampleClick = (q) => {
    setQuestion(q)
  }

  // 构建表格列定义
  const tableColumns = result?.columns?.map(col => ({
    title: col,
    dataIndex: col,
    key: col,
    ellipsis: true,
    render: val => (val === null ? <Text type="tertiary">NULL</Text> : String(val)),
  })) || []

  const showChart = result && canRenderChart(result.columns, result.rows)

  return (
    <div style={{ padding: 0 }}>
      <Title heading={5} style={{ marginBottom: 16 }}>AI 数据查询</Title>

      {/* 问题输入区 */}
      <div style={CARD_STYLE}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input
            style={{ flex: 1 }}
            size="large"
            placeholder="用自然语言描述你想查什么，例如：最近7天每天新增的用户数"
            value={question}
            onChange={setQuestion}
            onEnterPress={handleGenerate}
            prefix={<IconSearch />}
          />
          <Button
            theme="solid"
            type="primary"
            size="large"
            icon={<IconSend />}
            loading={loading}
            onClick={handleGenerate}
          >
            AI 生成
          </Button>
        </div>

        {/* 示例问题 */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Text type="tertiary" size="small">示例：</Text>
          {EXAMPLE_QUESTIONS.map(q => (
            <Tag
              key={q}
              style={{ cursor: 'pointer' }}
              onClick={() => handleExampleClick(q)}
            >
              {q}
            </Tag>
          ))}
        </div>
      </div>

      {/* 加载中 */}
      {loading && (
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 12 }}>
            <Text type="tertiary">AI 正在分析数据库结构并生成 SQL…</Text>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {!loading && error && (
        <div style={{
          ...CARD_STYLE,
          borderLeft: '3px solid var(--semi-color-danger)',
          background: 'var(--semi-color-danger-light-default)',
        }}>
          <Text type="danger">❌ {error}</Text>
        </div>
      )}

      {/* SQL + 结果区 */}
      {!loading && result && (
        <>
          {/* SQL 展示 + 编辑 */}
          <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <IconCode style={{ color: 'var(--semi-color-primary)' }} />
                <Text strong>生成的 SQL</Text>
                <Tag color="violet" size="small">可编辑</Tag>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Tooltip content="复制 SQL">
                  <Button size="small" icon={<IconCopy />} onClick={handleCopySQL} />
                </Tooltip>
                <Button
                  size="small"
                  theme="solid"
                  type="primary"
                  icon={<IconPlay />}
                  loading={executing}
                  onClick={handleExecute}
                >
                  重新执行
                </Button>
              </div>
            </div>
            <textarea
              ref={textAreaRef}
              value={sqlEditing}
              onChange={e => setSqlEditing(e.target.value)}
              style={{
                width: '100%',
                minHeight: 100,
                padding: '10px 12px',
                fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
                fontSize: 13,
                lineHeight: 1.6,
                background: 'var(--semi-color-fill-0)',
                border: '1px solid var(--semi-color-border)',
                borderRadius: 6,
                color: 'var(--semi-color-text-0)',
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              spellCheck={false}
            />
          </div>

          {/* 结果区 */}
          <div style={CARD_STYLE}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Text strong>查询结果</Text>
                <Tag color="green" size="small">{result.row_count} 行</Tag>
              </div>
              {showChart && (
                <div style={{ display: 'flex', gap: 4 }}>
                  <Button
                    size="small"
                    type={activeTab === 'table' ? 'primary' : 'tertiary'}
                    theme={activeTab === 'table' ? 'solid' : 'light'}
                    onClick={() => setActiveTab('table')}
                  >
                    表格
                  </Button>
                  <Button
                    size="small"
                    type={activeTab === 'chart' ? 'primary' : 'tertiary'}
                    theme={activeTab === 'chart' ? 'solid' : 'light'}
                    onClick={() => setActiveTab('chart')}
                  >
                    图表
                  </Button>
                </div>
              )}
            </div>

            {result.rows.length === 0 ? (
              <Empty description="查询结果为空" />
            ) : activeTab === 'table' ? (
              <Table
                columns={tableColumns}
                dataSource={result.rows}
                rowKey={(r, i) => i}
                pagination={result.rows.length > 20 ? { pageSize: 20 } : false}
                scroll={{ x: tableColumns.length > 5 ? tableColumns.length * 160 : undefined }}
                size="small"
              />
            ) : (
              <ReactECharts
                option={buildChartOption(result.columns, result.rows)}
                style={{ height: 300 }}
                notMerge
              />
            )}
          </div>
        </>
      )}

      {/* 空状态引导 */}
      {!loading && !result && !error && (
        <div style={{ ...CARD_STYLE, padding: 60, textAlign: 'center' }}>
          <Empty
            image={<IconSearch size="extra-large" style={{ color: 'var(--semi-color-text-2)', fontSize: 48 }} />}
            description={
              <div>
                <div style={{ marginBottom: 8 }}>
                  <Text type="secondary">在上方输入自然语言问题，AI 会自动生成 SQL 并执行</Text>
                </div>
                <Text type="tertiary" size="small">支持查询用户、角色、菜单、日志等所有业务数据</Text>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
