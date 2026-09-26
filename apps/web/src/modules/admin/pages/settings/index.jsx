import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { RotateCcw, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { roleName } from '@/lib/role-label'
import { toast } from '@/lib/toast'
import { getRoles } from '@/modules/admin/api/roles'
import { getSettings, saveSettings } from '@/modules/admin/api/settings'
import { FormGrid, FormMultiSelect, FormNumber, FormSwitch } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import { invalidateAppInfo } from '@/shared/hooks/useAppInfo'

/** API keys are dotted ("security.totp_enabled"); react-hook-form treats dots as nesting, so fields use the part after the group */
const fieldOf = (key) => key.split('.').slice(1).join('.')
const toValues = (items) => Object.fromEntries(items.map((i) => [fieldOf(i.key), i.value]))

/**
 * System settings: feature switches that are off by default plus security parameters, stored in the database and
 * applied within a few seconds. Secrets and infrastructure (SMTP, S3, database) stay in environment variables.
 */
export default function Settings() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canEdit = hasPermission('system_settings_edit')
  const [items, setItems] = useState(null)
  const [roles, setRoles] = useState([])
  const form = useForm({ defaultValues: {} })
  const saving = form.formState.isSubmitting
  const dirty = form.formState.isDirty

  useEffect(() => {
    getSettings()
      .then((res) => {
        setItems(res.items)
        form.reset(toValues(res.items))
      })
      .catch((err) => toast.apiError(err, '加载失败'))
    getRoles()
      .then((res) => setRoles(Array.isArray(res) ? res : []))
      .catch(() => {})
  }, [form])

  const byField = useMemo(() => Object.fromEntries((items || []).map((i) => [fieldOf(i.key), i])), [items])
  const roleOptions = roles.map((r) => ({ label: `${roleName(r)} (${r.code})`, value: r.code }))

  const save = form.handleSubmit(async (values) => {
    const dirtyFields = Object.keys(form.formState.dirtyFields)
    const changes = Object.fromEntries(dirtyFields.map((field) => [byField[field].key, values[field]]))
    try {
      const res = await saveSettings(changes)
      setItems(res.items)
      form.reset(toValues(res.items))
      invalidateAppInfo()
      toast.success('设置已保存')
    } catch (err) {
      toast.apiError(err, '保存失败')
    }
  })

  /** Range hint for a number field, from the definition */
  const range = (field) => {
    const item = byField[field]
    return item ? t('{{min}} – {{max}}，默认 {{value}}', { min: item.min, max: item.max, value: item.default }) : undefined
  }

  const [totpOn, resetOn] = useWatch({ control: form.control, name: ['totp_enabled', 'password_reset_enabled'] })
  const switchOn = { totp_enabled: totpOn, password_reset_enabled: resetOn }
  /** A switch whose prerequisites are missing can't be turned on (its description says why); one already on can be turned off */
  const switchDisabled = (field) => !canEdit || (Boolean(byField[field]?.unavailable_reason) && !switchOn[field])

  const numberRules = (field) => {
    const item = byField[field]
    return {
      required: '请填写',
      validate: (v) => (Number.isInteger(v) && v >= item.min && v <= item.max) || t('请输入 {{min}} – {{max}} 之间的整数', { min: item.min, max: item.max }),
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
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
                {t('保存')}
              </Button>
            </>
          ) : null
        }
      />
      {items === null ? (
        <div className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <Form {...form}>
          <form onSubmit={save} noValidate className="space-y-4">
            <Panel title="两步验证" description="登录时除了密码，还要输入手机验证器 App 上的动态验证码">
              <div className="space-y-3">
                <FormSwitch
                  control={form.control}
                  name="totp_enabled"
                  label="启用两步验证"
                  disabled={switchDisabled('totp_enabled')}
                  description={byField.totp_enabled?.unavailable_reason || '关闭后登录不再询问验证码，用户已有的绑定会保留'}
                />
                <FormMultiSelect
                  control={form.control}
                  name="totp_required_roles"
                  label="必须开启的角色"
                  description="这些角色的成员登录时如果还没绑定，会先要求绑定，且不能自行关闭"
                  options={roleOptions}
                  placeholder="不强制"
                  disabled={!canEdit}
                />
              </div>
            </Panel>

            <Panel title="找回密码" description="登录页显示「忘记密码」，通过邮件链接重置">
              <FormSwitch
                control={form.control}
                name="password_reset_enabled"
                label="启用邮件找回密码"
                disabled={switchDisabled('password_reset_enabled')}
                description={byField.password_reset_enabled?.unavailable_reason || '链接 30 分钟内有效、只能使用一次；重置后该用户所有设备退出登录'}
              />
            </Panel>

            <Panel title="密码规则" description="设置或修改密码时校验，已有密码不受影响">
              <div className="space-y-3">
                <FormGrid>
                  <FormNumber
                    control={form.control}
                    name="password_min_length"
                    label="最短长度"
                    description={range('password_min_length')}
                    min={byField.password_min_length?.min}
                    max={byField.password_min_length?.max}
                    disabled={!canEdit}
                    rules={numberRules('password_min_length')}
                  />
                </FormGrid>
                <FormSwitch control={form.control} name="password_require_letters_digits" label="必须同时包含字母和数字" disabled={!canEdit} />
                <FormSwitch control={form.control} name="password_require_symbol" label="必须包含符号" disabled={!canEdit} />
              </div>
            </Panel>

            <Panel title="会话与访问频率" description="限流按 IP 统计；多实例部署时每个实例分别计数">
              <FormGrid columns={3}>
                <FormNumber
                  control={form.control}
                  name="session_ttl_hours"
                  label="登录有效期（小时）"
                  description={range('session_ttl_hours')}
                  disabled={!canEdit}
                  rules={numberRules('session_ttl_hours')}
                />
                <FormNumber
                  control={form.control}
                  name="rate_limit_per_minute"
                  label="每分钟请求上限"
                  description={range('rate_limit_per_minute')}
                  disabled={!canEdit}
                  rules={numberRules('rate_limit_per_minute')}
                />
                <FormNumber
                  control={form.control}
                  name="auth_rate_limit_per_minute"
                  label="每分钟登录类请求上限"
                  description={range('auth_rate_limit_per_minute')}
                  disabled={!canEdit}
                  rules={numberRules('auth_rate_limit_per_minute')}
                />
              </FormGrid>
            </Panel>
          </form>
        </Form>
      )}
    </div>
  )
}
