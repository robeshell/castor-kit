import { useCallback, useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { KeyRound, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime, formatRelative } from '@/lib/format'
import { menuLabel } from '@/lib/menu-label'
import { toast } from '@/lib/toast'
import { createApiToken, getApiTokenScopes, getMyApiTokens, revokeMyApiToken } from '@/modules/admin/api/api_tokens'
import ReauthDialog from '@/modules/admin/components/ReauthDialog'
import SecretDialog from '@/modules/admin/components/SecretDialog'
import CheckableTree from '@/shared/components/CheckableTree'
import ConfirmAction from '@/shared/components/ConfirmAction'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput, FormSelect } from '@/shared/components/FormFields'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import { useReauth } from '@/shared/hooks/useReauth'

const EXPIRY_OPTIONS = [
  { label: '30 天', value: '30' },
  { label: '90 天', value: '90' },
  { label: '180 天', value: '180' },
  { label: '1 年', value: '365' },
  { label: '永不过期', value: 'never' },
]

/** Flat scope items ({ id, parent_id, code, name, grantable }) → CheckableTree nodes keyed by code */
function toScopeTree(items) {
  const byId = new Map(items.map((i) => [i.id, { key: i.code, code: i.code, label: i.name, children: [] }]))
  const roots = []
  for (const item of items) {
    const node = byId.get(item.id)
    const parent = item.parent_id === null ? undefined : byId.get(item.parent_id)
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const prune = (node) => ({
    ...node,
    children: node.children.length ? node.children.map(prune) : undefined,
  })
  return roots.map(prune)
}

/**
 * The codes a token gets for the checked keys: grantable ones only, plus the grantable ancestors of anything
 * checked (ticking "新增用户" also grants the user list it lives on, as with roles)
 */
function scopesOf(checked, items) {
  const byCode = new Map(items.map((i) => [i.code, i]))
  const byId = new Map(items.map((i) => [i.id, i]))
  const out = new Set()
  for (const code of checked) {
    for (let item = byCode.get(code); item; item = item.parent_id === null ? undefined : byId.get(item.parent_id)) {
      if (item.grantable) out.add(item.code)
    }
  }
  return [...out]
}

function tokenStatus(token) {
  if (token.revoked_at) return 'revoked'
  if (token.expires_at && new Date(token.expires_at) <= new Date()) return 'expired'
  return 'active'
}

function CreateTokenDialog({ open, onOpenChange, onCreated }) {
  const { t } = useTranslation()
  const form = useForm({ defaultValues: { name: '', expires: '90' } })
  const [scopeItems, setScopeItems] = useState(null)
  const [checked, setChecked] = useState([])
  const reauth = useReauth()

  // Mounted afresh for every opening (keyed by the panel), so only the scopes need loading
  useEffect(() => {
    if (!open) return
    getApiTokenScopes()
      .then((res) => setScopeItems(res.items || []))
      .catch((err) => {
        toast.apiError(err, '加载失败')
        setScopeItems([])
      })
  }, [open])

  const tree = useMemo(() => toScopeTree(scopeItems || []), [scopeItems])
  const scopes = useMemo(() => scopesOf(checked, scopeItems || []), [checked, scopeItems])

  const submit = async (values) => {
    if (scopes.length === 0) {
      // The dialog stays open until onCreated closes it
      toast.error('请至少选择一项权限')
      return
    }
    try {
      const res = await reauth.run(() =>
        createApiToken({
          name: values.name.trim(),
          scopes,
          expires_in_days: values.expires === 'never' ? null : Number(values.expires),
        }),
      )
      onCreated(res)
    } catch (err) {
      if (!err?.cancelled) toast.apiError(err, '创建失败')
      throw err
    }
  }

  return (
    <>
      <FormDialog
        open={open}
        onOpenChange={onOpenChange}
        title="创建 API Token"
        description="脚本和其他系统带上 Token 调用接口，只能使用这里勾选的权限"
        submitText="创建"
        form={form}
        onSubmit={submit}
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_160px]">
          <FormInput
            control={form.control}
            name="name"
            label="名称"
            placeholder="如：数据同步脚本"
            rules={{
              required: '请填写名称',
              maxLength: { value: 100, message: '最多 100 个字符' },
            }}
          />
          <FormSelect control={form.control} name="expires" label="有效期" options={EXPIRY_OPTIONS} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium">{t('权限')}</span>
            <span className="text-muted-foreground text-xs tabular-nums">{t('已选 {{count}} 项', { count: scopes.length })}</span>
          </div>
          <div className="max-h-72 overflow-auto rounded-lg border p-1.5">
            {scopeItems === null ? (
              <div className="space-y-1.5 p-1">
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
                <Skeleton className="h-6" />
              </div>
            ) : tree.length > 0 ? (
              <CheckableTree
                tree={tree}
                value={checked}
                onChange={setChecked}
                renderText={(node) => menuLabel({ code: node.code, name: node.label })}
              />
            ) : (
              <p className="text-muted-foreground px-2 py-3 text-[13px]">{t('你还没有可以授予的权限')}</p>
            )}
          </div>
          <p className="text-muted-foreground text-xs">{t('只能勾选自己拥有的权限；之后你的权限变少时，Token 的权限也随之变少')}</p>
        </div>
      </FormDialog>
      <ReauthDialog {...reauth.dialogProps} />
    </>
  )
}

/**
 * API tokens on the profile: created here, shown once, revoked here. Hidden while the feature is off and the
 * user has no tokens; with the feature off, existing tokens are listed as paused so they can still be revoked.
 */
export default function ApiTokensPanel() {
  const { t } = useTranslation()
  const [data, setData] = useState(null)
  const [creating, setCreating] = useState(false)
  /** Remounts the create dialog on every opening so it starts empty */
  const [createKey, setCreateKey] = useState(0)
  /** { token, item, open }: kept after closing so the dialog doesn't go blank while it fades out */
  const [created, setCreated] = useState(null)

  const load = useCallback(
    () =>
      getMyApiTokens()
        .then(setData)
        .catch(() => setData(null)),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  if (!data || (!data.enabled && data.items.length === 0)) return null

  const revoke = async (token) => {
    try {
      await revokeMyApiToken(token.id)
      toast.success('已吊销')
      load()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const tokens = data.items.filter((token) => tokenStatus(token) !== 'revoked')

  return (
    <Panel
      title="API Token"
      description="给脚本或其他系统调用接口用，请求头带上 Authorization: Bearer <Token>"
      className="mb-4"
      actions={
        data.enabled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCreateKey((k) => k + 1)
              setCreating(true)
            }}
          >
            <Plus />
            {t('创建 Token')}
          </Button>
        ) : (
          <StatusBadge tone="warning" dot>
            {t('已暂停')}
          </StatusBadge>
        )
      }
    >
      {!data.enabled ? (
        <p className="text-muted-foreground mb-3 text-xs">{t('管理员已关闭 API Token，下面的 Token 暂时不能使用，重新开启后恢复')}</p>
      ) : null}
      {tokens.length === 0 ? (
        <p className="text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-[13px]">{t('还没有 API Token')}</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tokens.map((token) => {
            const expired = tokenStatus(token) === 'expired'
            return (
              <li key={token.id} className="flex items-center gap-3 px-3.5 py-3">
                <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <KeyRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-[13px] font-medium">{token.name}</span>
                    <code className="text-muted-foreground shrink-0 font-mono text-xs">{token.token_prefix}…</code>
                    {expired ? <StatusBadge tone="neutral">{t('已过期')}</StatusBadge> : null}
                  </div>
                  <div className="text-muted-foreground mt-1 truncate text-xs tabular-nums">
                    <span title={token.scopes.map((code) => menuLabel({ code, name: code })).join('、')}>
                      {t('{{count}} 项权限', { count: token.scopes.length })}
                    </span>
                    {' · '}
                    {token.expires_at
                      ? t('{{time}} 到期', {
                          time: formatDateTime(token.expires_at),
                        })
                      : t('永不过期')}
                    {' · '}
                    {token.last_used_at ? (
                      <span title={token.last_used_ip || undefined}>
                        {t('最近使用 {{time}}', {
                          time: formatRelative(token.last_used_at),
                        })}
                      </span>
                    ) : (
                      t('从未使用')
                    )}
                  </div>
                </div>
                <ConfirmAction
                  title={t('吊销「{{name}}」？', { name: token.name })}
                  description="使用它的脚本或系统会立即无法调用接口。"
                  confirmText="吊销"
                  onConfirm={() => revoke(token)}
                >
                  <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
                    {t('吊销')}
                  </Button>
                </ConfirmAction>
              </li>
            )
          })}
        </ul>
      )}

      <CreateTokenDialog
        key={createKey}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(res) => {
          setCreating(false)
          setCreated({ ...res, open: true })
          load()
        }}
      />
      <SecretDialog
        open={Boolean(created?.open)}
        onOpenChange={(open) => !open && setCreated((c) => ({ ...c, open: false }))}
        title="API Token 已创建"
        secret={created?.token}
        warning="Token 只显示这一次，关闭后无法再查看。请立即复制并妥善保存；泄露时到这里吊销。"
        doneText="我已保存"
      >
        <pre className="bg-muted/50 overflow-x-auto rounded-lg border px-3 py-2.5 font-mono text-xs leading-relaxed">
          {`curl -H "Authorization: Bearer <Token>" \\\n  ${window.location.origin}/api/admin/me`}
        </pre>
      </SecretDialog>
    </Panel>
  )
}
