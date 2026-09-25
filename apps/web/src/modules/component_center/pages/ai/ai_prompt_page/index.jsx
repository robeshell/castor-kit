import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Check, Copy, FilePlus2, Plus, Save, Search, Trash2, Variable, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/lib/toast'
import { layoutSpring, stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import {
  createPromptTemplate,
  deletePromptTemplate,
  getPromptTemplates,
  updatePromptTemplate,
} from '@/modules/component_center/api/ai_prompt'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { FormInput, FormSelect, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

// ── Categories ────────────────────────────────────────────────────────
const CATEGORY_OPTIONS = [
  { value: 'product', label: '产品', tone: 'brand' },
  { value: 'dev', label: '开发', tone: 'success' },
  { value: 'marketing', label: '营销', tone: 'warning' },
  { value: 'data', label: '数据', tone: 'info' },
  { value: 'office', label: '办公', tone: 'neutral' },
  { value: 'custom', label: '自定义', tone: 'neutral' },
]
const categoryMeta = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c]))

const EMPTY_FORM = { name: '', category: 'custom', content: '' }
const notBlank = (message) => (v) => Boolean(String(v ?? '').trim()) || message

// ── Extract variable names from the template content ─────────────────
function extractVars(content) {
  const matches = [...(content || '').matchAll(/\{\{(\w+)\}\}/g)]
  const seen = new Set()
  return matches
    .map((m) => m[1])
    .filter((v) => {
      if (seen.has(v)) return false
      seen.add(v)
      return true
    })
}

// ── Live preview: substitute variable values into the template ───────
function buildPreview(content, varValues) {
  return (content || '').replace(/\{\{(\w+)\}\}/g, (_, key) =>
    varValues[key] !== undefined && varValues[key] !== '' ? varValues[key] : `{{${key}}}`,
  )
}

// ── Template card (left column) ──────────────────────────────────────
function TemplateCard({ template, selected, onSelect, onDelete }) {
  const { t } = useTranslation()
  const meta = categoryMeta[template.category] || categoryMeta.custom
  return (
    <motion.div variants={stagger.item} className="group relative">
      <button
        type="button"
        onClick={() => onSelect(template)}
        className={cn(
          'relative w-full rounded-lg border px-3 py-2.5 text-left transition-colors duration-150',
          selected ? 'border-primary/40 bg-brand-soft' : 'bg-card hover:bg-muted/60 border-border',
        )}
      >
        {selected ? (
          <motion.span
            layoutId="prompt-template-active"
            transition={layoutSpring}
            className="bg-brand-gradient absolute top-2 bottom-2 left-0 w-[3px] rounded-full"
          />
        ) : null}
        <span className="block truncate pr-6 text-[13px] font-medium">{template.name}</span>
        <span className="mt-1.5 flex items-center gap-2">
          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
          {template.variables?.length > 0 ? (
            <span className="text-muted-foreground text-[11px] tabular-nums">{t('{{count}} 个变量', { count: template.variables.length })}</span>
          ) : null}
        </span>
      </button>
      <ConfirmAction
        title={t('删除模板「{{name}}」？', { name: template.name })}
        description="删除后不可恢复。"
        confirmText="删除"
        onConfirm={() => onDelete(template)}
      >
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={t('删除模板')}
          className="text-muted-foreground hover:text-danger absolute top-2 right-2 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 md:opacity-0"
        >
          <Trash2 />
        </Button>
      </ConfirmAction>
    </motion.div>
  )
}

// ── Preview (right column) ───────────────────────────────────────────
function PreviewPanel({ content, varValues }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef(null)
  const preview = buildPreview(content, varValues)

  useEffect(() => () => clearTimeout(copyTimerRef.current), [])

  const handleCopy = () => {
    navigator.clipboard
      .writeText(preview)
      .then(() => {
        setCopied(true)
        clearTimeout(copyTimerRef.current)
        copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => toast.error('复制失败'))
  }

  // Highlight variables that have no value yet
  const parts = preview.split(/(\{\{\w+\}\})/g)

  return (
    <Panel
      title="预览"
      description="未填写的变量会高亮显示"
      className="flex min-h-[320px] flex-col md:w-[340px] md:shrink-0"
      bodyClassName="flex min-h-0 flex-1 flex-col gap-2"
      actions={
        <Button variant="outline" size="sm" onClick={handleCopy} disabled={!preview}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={copied ? 'done' : 'copy'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.15 }}
              className="inline-flex"
            >
              {copied ? <Check className="text-success" /> : <Copy />}
            </motion.span>
          </AnimatePresence>
          {copied ? t('已复制') : t('复制提示词')}
        </Button>
      }
    >
      <div className="bg-muted/40 min-h-[200px] flex-1 overflow-y-auto rounded-lg border p-3.5 text-[13px] leading-relaxed">
        {content ? (
          parts.map((part, i) =>
            /^\{\{\w+\}\}$/.test(part) ? (
              <span key={i} className="bg-warning-soft text-warning rounded px-1 font-mono text-xs">
                {part}
              </span>
            ) : (
              <span key={i} className="whitespace-pre-wrap">
                {part}
              </span>
            ),
          )
        ) : (
          <span className="text-muted-foreground">{t('请在左侧编辑模板内容，预览将在此处实时显示...')}</span>
        )}
      </div>
      <p className="text-muted-foreground text-right text-xs tabular-nums">{t('{{count}} 字符', { count: preview.length })}</p>
    </Panel>
  )
}

// ── Page ──────────────────────────────────────────────────────────────
export default function AiPromptPage() {
  const { t } = useTranslation()
  const [templates, setTemplates] = useState([])
  const [listLoading, setListLoading] = useState(true)
  const [searchText, setSearchText] = useState('')

  // Currently selected / edited template (null = create mode)
  const [selectedId, setSelectedId] = useState(null)
  const form = useForm({ defaultValues: EMPTY_FORM })
  const editContent = useWatch({ control: form.control, name: 'content' })

  // Variable values keyed by name; only variables detected in the current content are kept
  const [rawVarValues, setRawVarValues] = useState({})
  const detectedVars = useMemo(() => extractVars(editContent), [editContent])
  const varValues = useMemo(
    () => Object.fromEntries(detectedVars.map((v) => [v, rawVarValues[v] || ''])),
    [detectedVars, rawVarValues],
  )

  const loadTemplates = useCallback(async () => {
    setListLoading(true)
    try {
      const res = await getPromptTemplates()
      setTemplates(Array.isArray(res?.data) ? res.data : [])
    } catch (err) {
      toast.apiError(err, '加载模板失败')
    } finally {
      setListLoading(false)
    }
  }, [])

  // Initial load (refreshes go through loadTemplates)
  useEffect(() => {
    let cancelled = false
    getPromptTemplates()
      .then((res) => {
        if (!cancelled) setTemplates(Array.isArray(res?.data) ? res.data : [])
      })
      .catch((err) => {
        if (!cancelled) toast.apiError(err, '加载模板失败')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Filter by name on the client
  const filteredTemplates = useMemo(() => {
    const kw = searchText.trim().toLowerCase()
    if (!kw) return templates
    return templates.filter((tpl) => tpl.name.toLowerCase().includes(kw))
  }, [templates, searchText])

  const handleSelectTemplate = (tpl) => {
    setSelectedId(tpl.id)
    form.reset({ name: tpl.name, category: tpl.category || 'custom', content: tpl.content || '' })
    setRawVarValues({})
  }

  const handleNew = () => {
    setSelectedId(null)
    form.reset(EMPTY_FORM)
    setRawVarValues({})
  }

  const handleSave = async (values) => {
    const payload = { name: values.name.trim(), category: values.category, content: values.content.trim() }
    try {
      if (selectedId) {
        await updatePromptTemplate(selectedId, payload)
        toast.success('模板已更新')
      } else {
        const res = await createPromptTemplate(payload)
        setSelectedId(res?.id ?? null)
        toast.success('模板已创建')
      }
      form.reset(values)
      await loadTemplates()
    } catch (err) {
      toast.apiError(err, '保存失败')
    }
  }

  const handleDelete = async (tpl) => {
    try {
      await deletePromptTemplate(tpl.id)
      toast.success('已删除')
      if (selectedId === tpl.id) handleNew()
      await loadTemplates()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const saving = form.formState.isSubmitting

  return (
    <div className="flex flex-col md:h-[calc(100svh-112px)]">
      <PageHeader
        title="AI 提示词工坊"
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 md:flex-row">
        {/* Left: template library */}
        <Panel
          title="模板库"
          actions={
            <Button variant="outline" size="sm" className="h-7" onClick={handleNew}>
              <Plus />
              {t('新建')}
            </Button>
          }
          className="flex max-h-[420px] flex-col md:max-h-none md:w-[260px] md:shrink-0"
          bodyClassName="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3"
        >
          <div className="relative">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder={t('搜索模板名称...')}
              className="h-8 pr-7 pl-8 text-[13px]"
            />
            {searchText ? (
              <button
                type="button"
                aria-label={t('清空')}
                onClick={() => setSearchText('')}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>

          <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
            {listLoading && templates.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[58px] rounded-lg" />
                ))}
              </div>
            ) : filteredTemplates.length === 0 ? (
              <p className="text-muted-foreground px-1 py-6 text-center text-xs">
                {searchText ? t('无匹配模板') : t('暂无模板，点击「新建」创建')}
              </p>
            ) : (
              <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-1.5">
                {filteredTemplates.map((tpl) => (
                  <TemplateCard
                    key={tpl.id}
                    template={tpl}
                    selected={selectedId === tpl.id}
                    onSelect={handleSelectTemplate}
                    onDelete={handleDelete}
                  />
                ))}
              </motion.div>
            )}
          </div>
        </Panel>

        {/* Middle: editor */}
        <Panel
          title={selectedId ? '编辑模板' : '新建模板'}
          
          className="flex min-w-0 flex-1 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col"
        >
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSave)} className="flex min-h-0 flex-1 flex-col">
              <div className="-mx-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-1">
                <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                  <FormInput
                    control={form.control}
                    name="name"
                    label="模板名称"
                    placeholder="请输入模板名称..."
                    rules={{ validate: notBlank('请填写模板名称') }}
                    required
                  />
                  <FormSelect
                    control={form.control}
                    name="category"
                    label="分类"
                    options={CATEGORY_OPTIONS.map((c) => ({ value: c.value, label: c.label }))}
                  />
                </div>
                <FormTextarea
                  control={form.control}
                  name="content"
                  label="模板内容"
                  description={'使用 {{变量名}} 语法定义变量'}
                  rows={9}
                  placeholder={'请输入提示词模板内容...\n例如：你是一位{{role}}，请帮我分析{{topic}}的相关问题。'}
                  inputClassName="min-h-[220px] text-[13px] leading-relaxed"
                  rules={{ validate: notBlank('请填写模板内容') }}
                  required
                />

                <AnimatePresence initial={false}>
                  {detectedVars.length > 0 ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-2.5 rounded-lg border border-dashed p-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mr-1 flex items-center gap-1 text-[13px] font-medium">
                            <Variable className="text-muted-foreground size-3.5" />
                            {t('已识别变量')}
                          </span>
                          {detectedVars.map((v) => (
                            <span key={v} className="bg-warning-soft text-warning rounded px-1.5 py-0.5 font-mono text-[11px]">
                              {`{{${v}}}`}
                            </span>
                          ))}
                        </div>
                        {detectedVars.map((v) => (
                          <div key={v} className="flex items-center gap-2">
                            <span className="text-muted-foreground w-28 shrink-0 truncate font-mono text-xs sm:w-36" title={v}>
                              {v}
                            </span>
                            <Input
                              value={varValues[v] || ''}
                              onChange={(e) => setRawVarValues((prev) => ({ ...prev, [v]: e.target.value }))}
                              placeholder={t('填写 {{name}} 的值...', { name: v })}
                              className="h-8 flex-1 text-[13px]"
                            />
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="mt-4 flex gap-2 border-t pt-4">
                <Button type="submit" variant="brand" size="sm" disabled={saving}>
                  {saving ? <Spinner /> : <Save />}
                  {selectedId ? t('保存更改') : t('创建模板')}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleNew} disabled={saving}>
                  <FilePlus2 />
                  {t('新建')}
                </Button>
              </div>
            </form>
          </Form>
        </Panel>

        {/* Right: live preview */}
        <PreviewPanel content={editContent} varValues={varValues} />
      </div>
    </div>
  )
}
