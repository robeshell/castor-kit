import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Plus, RefreshCw, RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toast } from '@/lib/toast'
import {
  createWebhook,
  deleteWebhook,
  getWebhookEvents,
  getWebhooks,
  getWebhookSecret,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
} from '@/modules/admin/api/webhooks'
import ReauthDialog from '@/modules/admin/components/ReauthDialog'
import SecretDialog from '@/modules/admin/components/SecretDialog'
import DeliveriesSheet, { DeliveryStatus } from '@/modules/admin/pages/webhooks/DeliveriesSheet'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormMultiSelect, FormSwitch } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import RowActions from '@/shared/components/RowActions'
import StatusBadge from '@/shared/components/StatusBadge'
import { useReauth } from '@/shared/hooks/useReauth'

const EMPTY_FORM = { name: '', url: '', events: [], is_active: true }

/**
 * Subscription options: everything, "<prefix>.*" for groups of events, then each event. Values already on the
 * webhook that aren't offered (set through the API) are kept so saving doesn't drop them. `ping` is only sent by
 * the test button, so it isn't offered.
 */
function eventOptions(events, t, current = []) {
  const names = events.map((e) => e.event).filter((e) => e !== 'ping')
  const prefixes = [...new Set(names.map((e) => e.split('.')[0]))].filter((p) => names.filter((e) => e.startsWith(`${p}.`)).length > 1)
  const options = [
    { label: t('全部事件（*）'), value: '*' },
    ...prefixes.map((p) => ({
      label: t('{{prefix}}.* · 这一类的全部事件', { prefix: p }),
      value: `${p}.*`,
    })),
    ...events.filter((e) => e.event !== 'ping').map((e) => ({ label: `${e.event} · ${t(e.label)}`, value: e.event })),
  ]
  for (const value of current) if (!options.some((o) => o.value === value)) options.push({ label: value, value })
  return options
}

/**
 * Webhooks: push events (user.created, role.updated …) to other systems. Creating, editing and the signing secret
 * need a recent identity check; every new receiver or changed address is announced to the super admins.
 */
export default function Webhooks() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('system_webhooks_add')
  const canEdit = hasPermission('system_webhooks_edit')
  const canDelete = hasPermission('system_webhooks_delete')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState([])
  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  /** { hook, secret, created, open }: kept after closing so the dialog doesn't go blank while it fades out */
  const [secret, setSecret] = useState(null)
  const [rotating, setRotating] = useState(false)
  const [testing, setTesting] = useState(null)
  const [deliveriesOf, setDeliveriesOf] = useState(null)
  const form = useForm({ defaultValues: EMPTY_FORM })
  const reauth = useReauth()

  const load = useCallback(
    () =>
      getWebhooks()
        .then((res) => setItems(res.items || []))
        .catch((err) => toast.apiError(err, '加载失败'))
        .finally(() => setLoading(false)),
    [],
  )

  useEffect(() => {
    load()
    getWebhookEvents()
      .then((res) => setEvents(res.items || []))
      .catch(() => {})
  }, [load])

  const options = useMemo(() => eventOptions(events, t, editing?.events), [events, t, editing])

  const openForm = (record = null) => {
    setEditing(record)
    form.reset(
      record
        ? {
            name: record.name,
            url: record.url,
            events: record.events,
            is_active: record.is_active,
          }
        : EMPTY_FORM,
    )
    setDialogOpen(true)
  }

  const save = async (values) => {
    const payload = {
      ...values,
      name: values.name.trim(),
      url: values.url.trim(),
    }
    try {
      if (editing) {
        await reauth.run(() => updateWebhook(editing.id, payload))
        toast.success('已保存')
      } else {
        const res = await reauth.run(() => createWebhook(payload))
        setSecret({ hook: res.item, secret: res.secret, created: true, open: true })
      }
      setDialogOpen(false)
      load()
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '保存失败')
      throw err
    }
  }

  const remove = async (record) => {
    try {
      await deleteWebhook(record.id)
      toast.success('已删除')
      load()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const showSecret = async (record) => {
    try {
      const res = await reauth.run(() => getWebhookSecret(record.id))
      setSecret({ hook: record, secret: res.secret, created: false, open: true })
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '操作失败')
    }
  }

  const rotate = async () => {
    setRotating(true)
    try {
      const res = await reauth.run(() => rotateWebhookSecret(secret.hook.id))
      setSecret({ ...secret, secret: res.secret })
      toast.success('已生成新密钥，旧密钥立即失效')
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '操作失败')
    } finally {
      setRotating(false)
    }
  }

  const test = async (record) => {
    setTesting(record.id)
    try {
      const res = await testWebhook(record.id)
      if (res.status === 'success') toast.success(t('测试成功：HTTP {{code}}', { code: res.response_code }))
      else
        toast.error(
          t('测试失败：{{reason}}', {
            reason: res.response_code ? `HTTP ${res.response_code}` : res.response_body,
          }),
        )
      load()
    } catch (err) {
      toast.apiError(err, '操作失败')
    } finally {
      setTesting(null)
    }
  }

  const columns = [
    {
      key: 'name',
      title: '名称',
      dataIndex: 'name',
      minWidth: 200,
      render: (value, record) => (
        <div className="grid min-w-0 leading-tight">
          <span className="truncate font-medium">{value}</span>
          <span className="text-muted-foreground truncate font-mono text-xs" title={record.url}>
            {record.url}
          </span>
        </div>
      ),
    },
    {
      key: 'events',
      title: '订阅事件',
      dataIndex: 'events',
      minWidth: 160,
      render: (value = []) => (
        <div className="flex flex-wrap gap-1" title={value.join('\n')}>
          {value.slice(0, 3).map((e) => (
            <code key={e} className="bg-muted rounded px-1.5 py-0.5 font-mono text-[11px]">
              {e === '*' ? t('全部事件') : e}
            </code>
          ))}
          {value.length > 3 ? <span className="text-muted-foreground text-xs">+{value.length - 3}</span> : null}
        </div>
      ),
    },
    {
      key: 'is_active',
      title: '状态',
      dataIndex: 'is_active',
      width: 88,
      render: (value) => (
        <StatusBadge tone={value ? 'success' : 'neutral'} dot>
          {value ? t('启用') : t('停用')}
        </StatusBadge>
      ),
    },
    {
      key: 'last',
      title: '最近投递',
      dataIndex: 'last_status',
      width: 190,
      render: (value, record) =>
        value ? (
          <div className="grid gap-0.5 leading-tight">
            <span className="flex items-center gap-2">
              <DeliveryStatus status={value} attempts={1} />
              <span className="text-muted-foreground text-xs tabular-nums" title={formatDateTime(record.last_at)}>
                {formatRelative(record.last_at)}
              </span>
            </span>
            {record.failed_24h > 0 ? (
              <span className="text-danger text-xs">{t('24 小时内失败 {{count}} 次', { count: record.failed_24h })}</span>
            ) : null}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">{t('还没有投递')}</span>
        ),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 260,
      render: (_, record) => (
        <RowActions
          inline={3}
          actions={[
            {
              label: '发送测试',
              hidden: !canEdit,
              render: () => (
                <Button variant="ghost" size="sm" className="h-7 px-2" disabled={testing === record.id} onClick={() => test(record)}>
                  {testing === record.id ? <Spinner /> : null}
                  {t('发送测试')}
                </Button>
              ),
            },
            { label: '投递记录', onClick: () => setDeliveriesOf(record) },
            {
              label: '编辑',
              hidden: !canEdit,
              onClick: () => openForm(record),
            },
            {
              label: '签名密钥',
              hidden: !canEdit,
              onClick: () => showSecret(record),
            },
            {
              label: '删除',
              hidden: !canDelete,
              render: () => (
                <ConfirmAction
                  title={t('删除「{{name}}」？', { name: record.name })}
                  description="投递记录一并删除，接收方不再收到事件。"
                  confirmText="删除"
                  onConfirm={() => remove(record)}
                >
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                    {t('删除')}
                  </Button>
                </ConfirmAction>
              ),
            },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Webhook"
        description="数据变动时把事件推送到其他系统；失败会自动重试 5 次（1 分钟到 6 小时）"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw />
              {t('刷新')}
            </Button>
            {canAdd ? (
              <Button variant="brand" size="sm" onClick={() => openForm()}>
                <Plus />
                {t('新增 Webhook')}
              </Button>
            ) : null}
          </>
        }
      />
      <DataTable
        columns={columns}
        data={items}
        loading={loading}
        minWidth={880}
        emptyTitle="还没有 Webhook"
        emptyDescription="新增后，用户、角色、部门等数据变动时会推送到你填写的地址"
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? '编辑 Webhook' : '新增 Webhook'}
        form={form}
        onSubmit={save}
      >
        <FormInput
          control={form.control}
          name="name"
          label="名称"
          placeholder="如：同步到 CRM"
          rules={{
            required: '请填写名称',
            maxLength: { value: 100, message: '最多 100 个字符' },
          }}
        />
        <FormInput
          control={form.control}
          name="url"
          label="推送地址"
          placeholder="https://example.com/webhooks/castor"
          description="收到 POST 请求后返回 2xx 表示成功；不跟随重定向"
          rules={{
            required: '请填写推送地址',
            pattern: {
              value: /^https?:\/\/\S+$/i,
              message: '请填写正确的地址（http:// 或 https://）',
            },
          }}
        />
        <FormMultiSelect
          control={form.control}
          name="events"
          label="订阅事件"
          placeholder="选择事件"
          options={options}
          rules={{
            validate: (v) => (v && v.length > 0) || '请至少订阅一个事件',
          }}
        />
        <FormSwitch control={form.control} name="is_active" label="启用" description="停用后不再推送新事件，排队中的重试也会停止" />
      </FormDialog>

      <SecretDialog
        open={Boolean(secret?.open)}
        onOpenChange={(open) => !open && setSecret((x) => ({ ...x, open: false }))}
        title={secret?.created ? 'Webhook 已创建' : '签名密钥'}
        description={secret?.hook?.name}
        secret={secret?.secret}
        warning={
          secret?.created ? '把签名密钥配置到接收方，用来确认请求来自本系统。之后可以在「签名密钥」里再次查看（需要验证身份）。' : undefined
        }
      >
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t(
            '验证方法：用密钥对「X-Castor-Timestamp 的值、英文句点、原始请求体依次拼接」计算 HMAC-SHA256，结果应等于 X-Castor-Signature 中 sha256= 后面的部分。',
          )}
        </p>
        {!secret?.created ? (
          <ConfirmAction
            title={t('重新生成签名密钥？')}
            description="旧密钥立即失效，需要同时更新接收方的配置。"
            confirmText="重新生成"
            onConfirm={rotate}
          >
            <Button variant="outline" size="sm" disabled={rotating}>
              {rotating ? <Spinner /> : <RotateCw />}
              {t('重新生成')}
            </Button>
          </ConfirmAction>
        ) : null}
      </SecretDialog>

      {deliveriesOf ? (
        <DeliveriesSheet
          key={deliveriesOf.id}
          hook={deliveriesOf}
          onOpenChange={(open) => !open && setDeliveriesOf(null)}
          canRedeliver={canEdit}
          onChanged={load}
        />
      ) : null}
      <ReauthDialog {...reauth.dialogProps} />
    </div>
  )
}
