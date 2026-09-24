import { CARD_STYLE } from '@/shared/styles'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import {
  Button, Input, Select, Tag, Toast, Typography, Tooltip,
} from '@douyinfe/semi-ui'
import { IconPlus, IconDelete, IconCopy, IconSearch, IconTick } from '@douyinfe/semi-icons'
import {
  getPromptTemplates, createPromptTemplate, updatePromptTemplate, deletePromptTemplate,
} from '@/modules/component_center/api/ai_prompt'

// ── 样式常量 ─────────────────────────────────────────────────────────

const C = {
  blue: '#4080FF', green: '#00B96B', orange: '#FA8C16',
  purple: '#9254DE', red: '#FF4D4F', cyan: '#13C2C2',
  border: 'var(--semi-color-border)',
  text0: 'var(--semi-color-text-0)',
  text1: 'var(--semi-color-text-1)',
  text2: 'var(--semi-color-text-2)',
}

// ── 分类配置 ──────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: 'product',   label: '产品',   color: 'blue' },
  { value: 'dev',       label: '开发',   color: 'green' },
  { value: 'marketing', label: '营销',   color: 'orange' },
  { value: 'data',      label: '数据',   color: 'purple' },
  { value: 'office',    label: '办公',   color: 'cyan' },
  { value: 'custom',    label: '自定义', color: 'grey' },
]

const categoryMeta = Object.fromEntries(CATEGORY_OPTIONS.map(c => [c.value, c]))

// ── 从模板内容中提取变量名 ────────────────────────────────────────────
function extractVars(content) {
  const matches = [...(content || '').matchAll(/\{\{(\w+)\}\}/g)]
  const seen = new Set()
  return matches.map(m => m[1]).filter(v => {
    if (seen.has(v)) return false
    seen.add(v)
    return true
  })
}

// ── 前端实时预览：将变量值代入模板 ────────────────────────────────────
function buildPreview(content, varValues) {
  return (content || '').replace(/\{\{(\w+)\}\}/g, (_, key) =>
    varValues[key] !== undefined && varValues[key] !== ''
      ? varValues[key]
      : `{{${key}}}`
  )
}

// ── 左侧模板卡片 ─────────────────────────────────────────────────────
function TemplateCard({ template, selected, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false)
  const meta = categoryMeta[template.category] || categoryMeta.custom

  return (
    <div
      onClick={() => onSelect(template)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        padding: '10px 12px',
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 6,
        border: selected
          ? `1px solid ${C.blue}`
          : `1px solid ${C.border}`,
        borderLeft: selected ? `3px solid ${C.blue}` : `3px solid transparent`,
        background: selected ? 'var(--semi-color-primary-light-default)' : hovered ? 'var(--semi-color-fill-0)' : 'var(--semi-color-bg-1)',
        transition: 'all 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <Typography.Text
          ellipsis
          style={{ fontWeight: 500, fontSize: 13, color: C.text0, flex: 1 }}
        >
          {template.name}
        </Typography.Text>
        {hovered && (
          <Tooltip content="删除模板">
            <span
              onClick={(e) => { e.stopPropagation(); onDelete(template) }}
              style={{
                cursor: 'pointer', color: C.red, fontSize: 14, flexShrink: 0,
                display: 'flex', alignItems: 'center',
              }}
            >
              <IconDelete size="small" />
            </span>
          </Tooltip>
        )}
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Tag size="small" color={meta.color}>{meta.label}</Tag>
        {template.variables?.length > 0 && (
          <Typography.Text type="tertiary" style={{ fontSize: 11 }}>
            {template.variables.length} 个变量
          </Typography.Text>
        )}
      </div>
    </div>
  )
}

// ── 右侧预览区 ────────────────────────────────────────────────────────
function PreviewPanel({ content, varValues }) {
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)
  const preview = buildPreview(content, varValues)
  const charCount = preview.length

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
    }
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(preview).then(() => {
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    }).catch(() => Toast.error({ content: '复制失败', duration: 2 }))
  }

  // 将未填写的变量高亮显示
  const renderPreview = () => {
    const parts = preview.split(/(\{\{\w+\}\})/g)
    return parts.map((part, i) => {
      if (/^\{\{\w+\}\}$/.test(part)) {
        return (
          <span
            key={i}
            style={{
              background: 'rgba(250,140,22,0.12)',
              color: C.orange,
              border: `1px solid rgba(250,140,22,0.3)`,
              borderRadius: 4,
              padding: '0 4px',
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          >
            {part}
          </span>
        )
      }
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography.Title heading={6} style={{ margin: 0, color: C.text0 }}>预览</Typography.Title>
        <Button
          size="small"
          icon={copied ? <IconTick /> : <IconCopy />}
          onClick={handleCopy}
          style={{
            background: copied ? C.green : C.blue,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
          }}
        >
          {copied ? '已复制' : '复制提示词'}
        </Button>
      </div>

      <div style={{
        flex: 1,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
        overflowY: 'auto',
        background: 'var(--semi-color-fill-0)',
        fontSize: 13,
        lineHeight: 1.7,
        color: C.text1,
        minHeight: 200,
      }}>
        {content ? renderPreview() : (
          <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
            请在左侧编辑模板内容，预览将在此处实时显示...
          </Typography.Text>
        )}
      </div>

      <div style={{ textAlign: 'right' }}>
        <Typography.Text type="tertiary" style={{ fontSize: 12 }}>
          {charCount} 字符
        </Typography.Text>
      </div>
    </div>
  )
}

// ── 主组件 ────────────────────────────────────────────────────────────
export default function AiPromptPage() {
  const isMobile = useIsMobile()
  // 模板列表
  const [templates, setTemplates] = useState([])
  const [listLoading, setListLoading] = useState(false)
  const [searchText, setSearchText] = useState('')

  // 当前选中/编辑的模板
  const [selectedId, setSelectedId] = useState(null)  // null = 新建模式
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('custom')
  const [editContent, setEditContent] = useState('')
  const [saveLoading, setSaveLoading] = useState(false)

  // 变量值（key: varName, value: 用户填写的值）
  const [varValues, setVarValues] = useState({})

  // 从编辑内容中实时解析变量
  const detectedVars = useMemo(() => extractVars(editContent), [editContent])

  // 变量值变化时同步 key（保留已有值）
  useEffect(() => {
    setVarValues(prev => {
      const next = {}
      detectedVars.forEach(v => { next[v] = prev[v] || '' })
      return next
    })
  }, [detectedVars])

  // 加载模板列表
  const loadTemplates = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await getPromptTemplates()
      setTemplates(res.data?.data || [])
    } catch (err) {
      Toast.error({ content: '加载模板失败', duration: 2 })
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // 过滤模板（前端搜索）
  const filteredTemplates = useMemo(() => {
    if (!searchText.trim()) return templates
    const kw = searchText.trim().toLowerCase()
    return templates.filter(t => t.name.toLowerCase().includes(kw))
  }, [templates, searchText])

  // 选中模板，填入编辑区
  const handleSelectTemplate = (tpl) => {
    setSelectedId(tpl.id)
    setEditName(tpl.name)
    setEditCategory(tpl.category || 'custom')
    setEditContent(tpl.content || '')
    setVarValues({})
  }

  // 新建（清空编辑区）
  const handleNew = () => {
    setSelectedId(null)
    setEditName('')
    setEditCategory('custom')
    setEditContent('')
    setVarValues({})
  }

  // 保存（POST 或 PUT）
  const handleSave = async () => {
    const name = editName.trim()
    const content = editContent.trim()
    if (!name) { Toast.warning({ content: '请填写模板名称', duration: 2 }); return }
    if (!content) { Toast.warning({ content: '请填写模板内容', duration: 2 }); return }

    setSaveLoading(true)
    try {
      const payload = { name, category: editCategory, content }
      if (selectedId) {
        await updatePromptTemplate(selectedId, payload)
        Toast.success({ content: '模板已更新', duration: 2 })
      } else {
        const res = await createPromptTemplate(payload)
        setSelectedId(res.data?.id || null)
        Toast.success({ content: '模板已创建', duration: 2 })
      }
      await loadTemplates()
    } catch (err) {
      Toast.error({ content: err?.response?.data?.error || '保存失败', duration: 3 })
    } finally {
      setSaveLoading(false)
    }
  }

  // 删除模板
  const handleDelete = async (tpl) => {
    try {
      await deletePromptTemplate(tpl.id)
      Toast.success({ content: '已删除', duration: 2 })
      if (selectedId === tpl.id) handleNew()
      await loadTemplates()
    } catch (err) {
      Toast.error({ content: err?.response?.data?.error || '删除失败', duration: 3 })
    }
  }

  return (
    <div style={{ height: isMobile ? 'auto' : 'calc(100dvh - 108px)', display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* 顶部标题 */}
      <div style={{ marginBottom: 14 }}>
        <Typography.Title heading={5} style={{ margin: 0, color: C.text0 }}>AI 提示词工坊</Typography.Title>
        <Typography.Text type="tertiary" style={{ fontSize: 13 }}>
          管理和预览 AI 提示词模板，支持 {'{{变量}}'} 语法，实时预览填充效果
        </Typography.Text>
      </div>

      {/* 三列主体 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 14, minHeight: 0 }}>

        {/* 左侧：模板库 */}
        <div style={{ ...CARD_STYLE, width: isMobile ? '100%' : 260, flexShrink: 0, display: 'flex', flexDirection: 'column', padding: '14px 12px', overflow: isMobile ? 'visible' : 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 4, paddingRight: 4 }}>
            <Typography.Text strong style={{ fontSize: 14, color: C.text0 }}>模板库</Typography.Text>
            <Button
              size="small"
              icon={<IconPlus />}
              onClick={handleNew}
              style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 6 }}
            >
              新建
            </Button>
          </div>

          <Input
            prefix={<IconSearch style={{ color: C.text2 }} />}
            placeholder="搜索模板名称..."
            value={searchText}
            onChange={setSearchText}
            size="small"
            style={{ marginBottom: 10, borderRadius: 6 }}
          />

          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {listLoading ? (
              <Typography.Text type="tertiary" style={{ fontSize: 12, paddingLeft: 4 }}>加载中...</Typography.Text>
            ) : filteredTemplates.length === 0 ? (
              <Typography.Text type="tertiary" style={{ fontSize: 12, paddingLeft: 4 }}>
                {searchText ? '无匹配模板' : '暂无模板，点击「新建」创建'}
              </Typography.Text>
            ) : filteredTemplates.map(tpl => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                selected={selectedId === tpl.id}
                onSelect={handleSelectTemplate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </div>

        {/* 中间：编辑区 */}
        <div style={{ ...CARD_STYLE, flex: 1, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden', padding: '16px 18px' }}>
          <Typography.Title heading={6} style={{ margin: '0 0 14px', color: C.text0 }}>
            {selectedId ? '编辑模板' : '新建模板'}
          </Typography.Title>

          {/* 名称 */}
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 13, color: C.text1, display: 'block', marginBottom: 6 }}>
              模板名称
            </Typography.Text>
            <Input
              value={editName}
              onChange={setEditName}
              placeholder="请输入模板名称..."
              style={{ borderRadius: 7 }}
            />
          </div>

          {/* 分类 */}
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 13, color: C.text1, display: 'block', marginBottom: 6 }}>
              分类
            </Typography.Text>
            <Select
              value={editCategory}
              onChange={setEditCategory}
              style={{ width: '100%', borderRadius: 7 }}
              optionList={CATEGORY_OPTIONS.map(c => ({ value: c.value, label: c.label }))}
            />
          </div>

          {/* 模板内容 */}
          <div style={{ marginBottom: 10 }}>
            <Typography.Text strong style={{ fontSize: 13, color: C.text1, display: 'block', marginBottom: 6 }}>
              模板内容
              <Typography.Text type="tertiary" style={{ fontSize: 12, fontWeight: 400, marginLeft: 8 }}>
                使用 {'{{变量名}}'} 语法定义变量
              </Typography.Text>
            </Typography.Text>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              placeholder={'请输入提示词模板内容...\n例如：你是一位{{role}}，请帮我分析{{topic}}的相关问题。'}
              style={{
                width: '100%',
                height: 220,
                padding: '10px 12px',
                border: `1px solid ${C.border}`,
                borderRadius: 7,
                fontSize: 13,
                lineHeight: 1.65,
                color: C.text0,
                resize: 'vertical',
                fontFamily: 'inherit',
                outline: 'none',
                boxSizing: 'border-box',
                background: 'var(--semi-color-fill-0)',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { e.target.style.borderColor = C.blue }}
              onBlur={e => { e.target.style.borderColor = C.border }}
            />
          </div>

          {/* 已识别变量 */}
          {detectedVars.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Typography.Text strong style={{ fontSize: 13, color: C.text1 }}>已识别变量</Typography.Text>
                {detectedVars.map(v => (
                  <Tag key={v} size="small" color="orange" style={{ fontFamily: 'monospace' }}>{`{{${v}}}`}</Tag>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detectedVars.map(v => (
                  <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Typography.Text style={{
                      width: 140,
                      flexShrink: 0,
                      fontSize: 12,
                      color: C.orange,
                      fontFamily: 'monospace',
                      background: 'var(--semi-color-warning-light-default)',
                      border: '1px solid var(--semi-color-warning-light-hover)',
                      borderRadius: 4,
                      padding: '2px 6px',
                    }}>
                      {`{{${v}}}`}
                    </Typography.Text>
                    <Input
                      size="small"
                      placeholder={`填写 ${v} 的值...`}
                      value={varValues[v] || ''}
                      onChange={val => setVarValues(prev => ({ ...prev, [v]: val }))}
                      style={{ flex: 1, borderRadius: 6 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 保存按钮 */}
          <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', gap: 8 }}>
            <Button
              onClick={handleSave}
              loading={saveLoading}
              style={{ background: C.blue, color: '#fff', border: 'none', borderRadius: 8, minWidth: 88 }}
            >
              {selectedId ? '保存更改' : '创建模板'}
            </Button>
            <Button
              onClick={handleNew}
              style={{ borderRadius: 8 }}
            >
              新建
            </Button>
          </div>
        </div>

        {/* 右侧：实时预览 */}
        <div style={{ ...CARD_STYLE, width: isMobile ? '100%' : 340, flexShrink: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PreviewPanel content={editContent} varValues={varValues} />
        </div>
      </div>
    </div>
  )
}
