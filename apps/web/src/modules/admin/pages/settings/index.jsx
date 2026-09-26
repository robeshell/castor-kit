import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { CircleCheck, CircleX, FlaskConical, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { roleName } from '@/lib/role-label'
import { errorMessage, toast } from '@/lib/toast'
import { getRoles } from '@/modules/admin/api/roles'
import { getSettings, saveSettings, testAiSettings, testMailSettings, testStorageSettings } from '@/modules/admin/api/settings'
import { fieldName, toChanges, toFormValues } from '@/modules/admin/pages/settings/form'
import ReauthDialog from '@/modules/admin/components/ReauthDialog'
import SettingField from '@/modules/admin/pages/settings/SettingField'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import SegmentedTabs from '@/shared/components/SegmentedTabs'
import { invalidateAppInfo } from '@/shared/hooks/useAppInfo'
import { useReauth } from '@/shared/hooks/useReauth'

const TABS = [
  { value: 'security', label: '安全' },
  { value: 'mail', label: '邮件' },
  { value: 'storage', label: '文件存储' },
  { value: 'ai', label: 'AI' },
]
const S3_CONNECTION = ['storage.s3_endpoint', 'storage.s3_access_key', 'storage.s3_secret_key', 'storage.s3_region', 'storage.s3_path_style']

/** Runs a test with the unsaved values of its tab and shows the outcome under the button */
function TestAction({ label, run, disabled, children }) {
  const { t } = useTranslation()
  const [state, setState] = useState(null)
  const [running, setRunning] = useState(false)
  const start = async () => {
    setRunning(true)
    setState(null)
    try {
      const res = await run()
      setState({ ok: true, text: res.message })
    } catch (err) {
      // Identity check cancelled: no result to show
      setState(err?.cancelled ? null : { ok: false, text: errorMessage(err, '测试失败') })
    } finally {
      setRunning(false)
    }
  }
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {children}
        <Button type="button" variant="outline" size="sm" className="h-9" disabled={disabled || running} onClick={start}>
          {running ? <Spinner /> : <FlaskConical />}
          {t(label)}
        </Button>
      </div>
      {state ? (
        <p className={`flex items-start gap-1.5 text-xs ${state.ok ? 'text-success' : 'text-destructive'}`}>
          {state.ok ? <CircleCheck className="mt-px size-3.5 shrink-0" /> : <CircleX className="mt-px size-3.5 shrink-0" />}
          <span className="break-all">{state.text}</span>
        </p>
      ) : null}
      <p className="text-muted-foreground text-xs">{t('使用表单里当前的值测试（包括还没保存的修改），不会保存')}</p>
    </div>
  )
}

/**
 * System settings: feature switches, security parameters, mail, file storage and the AI model — stored in the
 * database and applied within seconds. Values pinned by environment variables are read-only here. Only what the
 * server needs before it can reach the database (DATABASE_URL, SECRET_KEY, ports …) stays in environment variables.
 */
export default function Settings() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('system_settings_edit')
  const [params, setParams] = useSearchParams()
  const tab = TABS.some((x) => x.value === params.get('tab')) ? params.get('tab') : 'security'
  const [data, setData] = useState(null)
  const [roles, setRoles] = useState([])
  const [testTo, setTestTo] = useState('')
  const form = useForm({ defaultValues: {} })
  const saving = form.formState.isSubmitting
  // Saving and the test buttons ask to confirm identity when the last sign-in / check is over 10 minutes old
  const reauth = useReauth()

  const load = (res) => {
    setData(res)
    form.reset(toFormValues(res.items))
  }

  useEffect(() => {
    getSettings()
      .then(load)
      .catch((err) => toast.apiError(err, '加载失败'))
    getRoles()
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => {})
    // load only touches state and the form instance
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const items = useMemo(() => data?.items ?? [], [data])
  const byKey = useMemo(() => Object.fromEntries(items.map((i) => [i.key, i])), [items])
  const values = useWatch({ control: form.control })
  const initial = form.formState.defaultValues
  const changes = useMemo(() => toChanges(items, values, initial), [items, values, initial])
  const dirty = Object.keys(changes).length > 0
  const roleOptions = roles.map((r) => ({ label: `${roleName(r)} (${r.code})`, value: r.code }))
  const v = (key) => values?.[fieldName(key)]

  const save = form.handleSubmit(async () => {
    if (!dirty) return
    try {
      load(await reauth.run(() => saveSettings(changes)))
      invalidateAppInfo()
      toast.success('设置已保存')
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '保存失败')
    }
  })

  const draft = (...prefixes) => toChanges(items, form.getValues(), initial, prefixes)
  const field = (key, extra) => (
    <SettingField item={byKey[key]} control={form.control} canEdit={canEdit} switchOn={v(key)} roleOptions={roleOptions} {...extra} />
  )

  const s3Files = data?.file_counts?.s3 ?? 0
  const s3ConnectionChanged = S3_CONNECTION.some((key) => key in changes)

  return (
    <div>
      <PageHeader
        title="系统设置"
        actions={
          canEdit ? (
            <>
              <Button variant="outline" size="sm" disabled={!dirty || saving} onClick={() => form.reset()}>
                <RotateCcw />
                {t('撤销修改')}
              </Button>
              <Button variant="brand" size="sm" disabled={!dirty || saving} onClick={save}>
                {saving ? <Spinner /> : <Save />}
                {dirty ? t('保存 {{count}} 项修改', { count: Object.keys(changes).length }) : t('保存')}
              </Button>
            </>
          ) : null
        }
      />
      <SegmentedTabs
        value={tab}
        onChange={(next) => setParams(next === 'security' ? {} : { tab: next }, { replace: true })}
        items={TABS}
        className="mb-4"
      />
      {data === null ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={save} noValidate>
            {tab === 'security' ? (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <Panel title="两步验证" description="登录时除了密码，还要输入手机验证器 App 上的动态验证码">
                    <div className="space-y-3">
                      {field('security.totp_enabled')}
                      {field('security.totp_required_roles')}
                    </div>
                  </Panel>
                  <Panel title="找回密码" description="需要先在「邮件」里配置好 SMTP 和网站地址">
                    {field('security.password_reset_enabled')}
                  </Panel>
                </div>
                <div className="space-y-4">
                  <Panel title="密码规则" description="设置或修改密码时校验，已有密码不受影响">
                    <div className="space-y-3">
                      {field('security.password_min_length')}
                      {field('security.password_require_letters_digits')}
                      {field('security.password_require_symbol')}
                    </div>
                  </Panel>
                  <Panel title="登录与访问频率" description="限流按 IP 统计；多实例部署时每个实例分别计数">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {field('security.session_ttl_hours')}
                      {field('security.login_max_failures')}
                      {field('security.login_lockout_minutes')}
                      {field('security.rate_limit_per_minute')}
                      {field('security.auth_rate_limit_per_minute')}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === 'mail' ? (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <Panel title="发信服务器" description="用于发送找回密码等邮件">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">{field('mail.smtp_host')}</div>
                    {field('mail.smtp_port')}
                    {field('mail.smtp_security')}
                    {field('mail.smtp_user')}
                    {field('mail.smtp_password')}
                    <div className="sm:col-span-2">{field('mail.from')}</div>
                  </div>
                </Panel>
                <div className="space-y-4">
                  <Panel title="邮件中的链接">{field('general.app_base_url')}</Panel>
                  <Panel title="发送测试邮件">
                    <TestAction
                      label="发送测试邮件"
                      disabled={!canEdit || !testTo.trim()}
                      run={() => reauth.run(() => testMailSettings(draft('mail.'), testTo.trim()))}
                    >
                      <Input
                        type="email"
                        value={testTo}
                        onChange={(e) => setTestTo(e.target.value)}
                        placeholder={t('收件邮箱')}
                        aria-label={t('收件邮箱')}
                        className="h-9 w-64"
                      />
                    </TestAction>
                  </Panel>
                </div>
              </div>
            ) : null}

            {tab === 'storage' ? (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <div className="space-y-4">
                  <Panel title="存储方式" description="只影响之后上传的文件；已有文件仍从原来的位置读取">
                    <div className="space-y-4">
                      {field('storage.driver')}
                      <TestAction label="测试连接" disabled={!canEdit} run={() => reauth.run(() => testStorageSettings(draft('storage.')))} />
                    </div>
                  </Panel>
                  <Panel title="上传限制">
                    <div className="space-y-4">
                      {field('upload.max_size')}
                      {field('upload.allowed_types')}
                    </div>
                  </Panel>
                </div>
                <Panel title="S3 连接" description={v('storage.driver') === 's3' ? undefined : '选择「S3 兼容存储」时使用'}>
                  <div className="space-y-4">
                    {s3Files > 0 && s3ConnectionChanged ? (
                      <div className="bg-warning-soft text-foreground flex gap-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed">
                        <TriangleAlert className="text-warning mt-0.5 size-3.5 shrink-0" />
                        <span>
                          {t('已有 {{count}} 个文件存放在 S3 上。如果新的接口地址或密钥访问不到原来的桶，这些文件将无法读取；只改 Bucket 不影响已有文件。', {
                            count: s3Files,
                          })}
                        </span>
                      </div>
                    ) : null}
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">{field('storage.s3_endpoint')}</div>
                      {field('storage.s3_region')}
                      {field('storage.s3_bucket')}
                      {field('storage.s3_access_key')}
                      {field('storage.s3_secret_key')}
                      <div className="sm:col-span-2">{field('storage.s3_public_url')}</div>
                      <div className="sm:col-span-2">{field('storage.s3_path_style')}</div>
                    </div>
                  </div>
                </Panel>
              </div>
            ) : null}

            {tab === 'ai' ? (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <Panel title="模型接口" description="AI 对话、AI 数据查询等功能使用的 OpenAI 兼容接口">
                  <div className="space-y-4">
                    {field('ai.api_base')}
                    {field('ai.api_key')}
                    {field('ai.model')}
                  </div>
                </Panel>
                <Panel title="连通性测试" description="发一条很短的消息，确认地址、API Key 和模型名可用">
                  <TestAction label="测试调用" disabled={!canEdit} run={() => reauth.run(() => testAiSettings(draft('ai.')))} />
                </Panel>
              </div>
            ) : null}
          </form>
        </Form>
      )}
      <ReauthDialog {...reauth.dialogProps} />
    </div>
  )
}
