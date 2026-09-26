import { useCallback, useEffect, useMemo, useState } from 'react'
import { Hammer, RotateCcw, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/lib/toast'
import { getAppInfo } from '@/modules/admin/api/auth'
import { getModelerHistory, getModelerMeta, startGenerate, suggestSpec, undoModule, validateSpec } from '@/modules/admin/api/modeler'
import ReauthDialog from '@/modules/admin/components/ReauthDialog'
import FieldEditor from '@/modules/admin/pages/modeler/FieldEditor'
import HistoryPanel from '@/modules/admin/pages/modeler/HistoryPanel'
import JobView from '@/modules/admin/pages/modeler/JobView'
import SpecPreview from '@/modules/admin/pages/modeler/SpecPreview'
import TranslationsEditor from '@/modules/admin/pages/modeler/TranslationsEditor'
import { emptySpec, fromSpec, toPayload } from '@/modules/admin/pages/modeler/spec'
import EmptyState from '@/shared/components/EmptyState'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import { useReauth } from '@/shared/hooks/useReauth'

const BIZ = '__biz__'

/**
 * Visual modeler (development only, super admins): describe a module — or let AI draft it — edit its fields, see the
 * page it will become, then generate it: code, migration, menu and permissions, API docs, and the verify gate, with
 * the output shown live. Generated modules can be undone from the history tab.
 */
export default function Modeler() {
  const { t } = useTranslation()
  const { refreshMenus } = useAuth()
  const [meta, setMeta] = useState(null)
  const [unavailable, setUnavailable] = useState(false)
  const [tab, setTab] = useState('new')
  const [spec, setSpec] = useState(emptySpec)
  const [description, setDescription] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [errors, setErrors] = useState([])
  const [generating, setGenerating] = useState(false)
  const [job, setJob] = useState(null)
  const [history, setHistory] = useState({ modules: [], jobs: [] })
  const reauth = useReauth()

  const loadHistory = useCallback(
    () =>
      getModelerHistory()
        .then(setHistory)
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    // app-info says whether the modeler exists here (development only)
    getAppInfo()
      .then((info) => {
        if (!info.modeler) {
          setUnavailable(true)
          return
        }
        getModelerMeta()
          .then((res) => {
            setMeta(res)
            // A job still running (e.g. the page was reloaded): follow it
            if (res.running) setJob({ id: res.running })
          })
          .catch((err) => toast.apiError(err, '加载失败'))
        loadHistory()
      })
      .catch((err) => toast.apiError(err, '加载失败'))
  }, [loadHistory])

  const bizExists = useMemo(() => meta?.parents.some((p) => p.code === 'biz'), [meta])
  const update = (patch) => setSpec((s) => ({ ...s, ...patch }))

  const suggest = async () => {
    setSuggesting(true)
    try {
      const res = await suggestSpec(description)
      setSpec((s) => fromSpec(res.spec, { ...s, parentId: s.parentId, dataScope: s.dataScope }))
      setErrors(res.errors ?? [])
      toast.success('已生成字段清单，请检查后再生成模块')
    } catch (err) {
      toast.apiError(err, 'AI 生成失败')
    } finally {
      setSuggesting(false)
    }
  }

  const generate = async () => {
    const payload = toPayload(spec)
    setGenerating(true)
    try {
      const check = await validateSpec(payload)
      setErrors(check.errors ?? [])
      if (check.errors?.length) return
      const started = await reauth.run(() => startGenerate(payload))
      setJob({ id: started.id, path: `/biz/${payload.name.replaceAll('_', '-')}s` })
    } catch (err) {
      if (err?.cancelled) return
      const list = err?.response?.data?.errors ?? err?.errors
      if (Array.isArray(list)) setErrors(list)
      else toast.apiError(err, '生成失败')
    } finally {
      setGenerating(false)
    }
  }

  const undo = async (m) => {
    try {
      const started = await reauth.run(() => undoModule(m.name))
      setJob({ id: started.id })
      setTab('new')
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '操作失败')
      throw err
    }
  }

  const finished = (state) => {
    loadHistory()
    if (state.status === 'success') {
      refreshMenus().catch(() => {})
      toast.success(state.kind === 'undo' ? '模块已撤销' : '模块已生成')
    }
  }

  if (unavailable) {
    return (
      <div>
        <PageHeader title="在线建模" />
        <EmptyState
          icon={Hammer}
          title="在线建模只在开发环境可用"
          description="它会把代码写进仓库并执行数据库迁移，所以只在本地开发（pnpm dev）时开放，且仅限超级管理员。"
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="在线建模" />
      <SegmentedTabs
        value={tab}
        onChange={(next) => {
          setTab(next)
          if (next === 'history') loadHistory()
        }}
        items={[
          { value: 'new', label: '新建模块' },
          { value: 'history', label: '已生成的模块' },
        ]}
        className="mb-4"
      />

      {job ? (
        <div className="mb-4">
          <JobView key={job.id} jobId={job.id} openPath={job.path} onFinished={finished} onClose={() => setJob(null)} />
        </div>
      ) : null}

      {tab === 'history' ? (
        <HistoryPanel history={history} busy={Boolean(job)} onUndo={undo} onOpenJob={(j) => setJob({ id: j.id })} />
      ) : meta === null ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-4">
            {meta.ai_configured ? (
              <Panel title="AI 起草" description="用一句话描述要做的功能，AI 按字段类型规则生成字段清单，再在下面修改">
                <div className="space-y-2">
                  <Textarea
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t('如：做一个设备台账，记录名称、编号、状态、采购日期和价格')}
                    aria-label={t('功能描述')}
                  />
                  <Button type="button" variant="outline" size="sm" disabled={suggesting || !description.trim()} onClick={suggest}>
                    {suggesting ? <Spinner /> : <Sparkles />}
                    {t('AI 生成字段')}
                  </Button>
                </div>
              </Panel>
            ) : null}

            <Panel title="基本信息">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="modeler-name" className="text-[13px]">
                    {t('模块名')}
                  </Label>
                  <Input
                    id="modeler-name"
                    className="font-mono"
                    placeholder="device"
                    value={spec.name}
                    onChange={(e) => update({ name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                  />
                  <p className="text-muted-foreground text-xs">{t('英文 snake_case，决定表名、接口地址和权限码')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="modeler-title" className="text-[13px]">
                    {t('标题')}
                  </Label>
                  <Input id="modeler-title" placeholder={t('如：设备台账')} value={spec.title} onChange={(e) => update({ title: e.target.value })} />
                  <p className="text-muted-foreground text-xs">{t('页面标题和菜单名')}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">{t('上级菜单')}</Label>
                  <Select value={spec.parentId ? String(spec.parentId) : BIZ} onValueChange={(v) => update({ parentId: v === BIZ ? null : Number(v) })}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BIZ}>{bizExists ? t('业务管理') : t('业务管理（第一次生成时创建）')}</SelectItem>
                      {meta.parents
                        .filter((p) => p.code !== 'biz')
                        .map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[13px]">{t('数据权限')}</Label>
                  <div className="flex h-9 items-center gap-2">
                    <Switch checked={spec.dataScope} onCheckedChange={(v) => update({ dataScope: v })} aria-label={t('按数据权限过滤')} />
                    <span className="text-muted-foreground text-xs">{t('记录归属部门和创建人，按角色的数据范围过滤')}</span>
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="字段" description="编号 / 编码类通常必填且唯一；ID、创建时间、更新时间自动添加">
              <FieldEditor fields={spec.fields} dicts={meta.dicts} onChange={(fields) => update({ fields })} />
            </Panel>

            <Panel title="多语言" description="页面文字与菜单名的英文、日文；留空时使用字段名">
              <TranslationsEditor spec={spec} aiConfigured={meta.ai_configured} onChange={(i18n) => update({ i18n })} />
            </Panel>
          </div>

          <div className="min-w-0 space-y-4 xl:sticky xl:top-4">
            <Panel title="预览">
              <SpecPreview spec={spec} />
            </Panel>
            <Panel>
              {errors.length > 0 ? (
                <ul className="bg-danger-soft text-danger mb-3 list-disc space-y-1 rounded-lg px-6 py-3 text-[13px]">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              ) : null}
              <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
                {t('生成会依次执行：生成代码 → 迁移数据库 → 同步菜单权限 → 更新接口文档 → 门禁检查，任何一步失败都会撤销本次生成的内容。生成的代码在仓库里，可以继续手动修改后提交。')}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="brand" disabled={generating || Boolean(job) || !spec.name || !spec.title} onClick={generate}>
                  {generating ? <Spinner /> : <Hammer />}
                  {t('生成模块')}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setSpec(emptySpec())
                    setErrors([])
                  }}
                >
                  <RotateCcw />
                  {t('清空')}
                </Button>
              </div>
            </Panel>
          </div>
        </div>
      )}
      <ReauthDialog {...reauth.dialogProps} />
    </div>
  )
}
