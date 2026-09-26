import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { KeyRound, ShieldCheck, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { disableTwoFactor, getMe, getTwoFactor, regenerateRecoveryCodes } from '@/modules/admin/api/auth'
import RecoveryCodes from '@/modules/admin/components/two-factor/RecoveryCodes'
import TotpEnrollment from '@/modules/admin/components/two-factor/TotpEnrollment'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'

/** Asks for the current password before a sensitive 2FA change */
function PasswordDialog({ open, onOpenChange, title, description, submitText, onConfirm }) {
  const form = useForm({ defaultValues: { password: '' } })
  useEffect(() => {
    if (open) form.reset({ password: '' })
  }, [open, form])
  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      submitText={submitText}
      size="sm"
      form={form}
      onSubmit={(values) => onConfirm(values.password)}
    >
      <FormInput
        control={form.control}
        name="password"
        type="password"
        autoComplete="current-password"
        label="当前密码"
        placeholder="请输入当前登录密码"
        rules={{ required: '请输入当前密码' }}
      />
    </FormDialog>
  )
}

/**
 * Two-step verification on the profile. Hidden while the feature is off and the user has no binding, so a
 * deployment that doesn't use 2FA doesn't see it at all.
 */
export default function TwoFactorPanel() {
  const { t } = useTranslation()
  const { updateUser } = useAuth()
  const [status, setStatus] = useState(null)
  /** null | enroll | disable | regenerate */
  const [dialog, setDialog] = useState(null)
  const [codes, setCodes] = useState(null)

  const load = useCallback(
    () =>
      getTwoFactor()
        .then(setStatus)
        .catch(() => setStatus(null)),
    [],
  )

  useEffect(() => {
    load()
  }, [load])

  // The user dict carries totp_enabled (shown on the users page); keep the signed-in copy in sync
  const refreshUser = () =>
    getMe()
      .then((res) => updateUser(res.user))
      .catch(() => {})

  if (!status || (!status.available && !status.enabled)) return null

  const disable = async (password) => {
    try {
      await disableTwoFactor(password)
      toast.success('两步验证已关闭')
      setDialog(null)
      load()
      refreshUser()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  const regenerate = async (password) => {
    try {
      const res = await regenerateRecoveryCodes(password)
      setDialog(null)
      setCodes(res.recovery_codes)
      load()
    } catch (err) {
      toast.apiError(err, '操作失败')
      throw err
    }
  }

  return (
    <Panel
      title="两步验证"
      description="登录时除了密码，还需要输入手机验证器 App 上的动态验证码"
      className="mb-4"
      actions={
        status.enabled ? (
          <StatusBadge tone="success" dot>
            {t('已开启')}
          </StatusBadge>
        ) : (
          <StatusBadge tone="neutral" dot>
            {t('未开启')}
          </StatusBadge>
        )
      }
    >
      {status.enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-muted-foreground space-y-0.5 text-xs">
            <div>{t('开启于 {{time}}', { time: formatDateTime(status.enabled_at) })}</div>
            <div>{t('剩余恢复码 {{count}} 个', { count: status.recovery_codes_left })}</div>
            {status.required ? <div>{t('你所在的角色要求开启两步验证')}</div> : null}
            {!status.available ? <div>{t('管理员已暂停两步验证：登录时暂不需要验证码，绑定会保留')}</div> : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialog('regenerate')}>
              <KeyRound />
              {t('重新生成恢复码')}
            </Button>
            {!status.required ? (
              <Button variant="outline" size="sm" className="text-danger hover:text-danger" onClick={() => setDialog('disable')}>
                <ShieldOff />
                {t('关闭')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-muted-foreground text-xs">
            {status.required ? t('你所在的角色要求开启两步验证，下次登录时会要求绑定') : t('开启后即使密码泄露，别人也无法登录你的账号')}
          </p>
          <Button variant="brand" size="sm" onClick={() => setDialog('enroll')}>
            <ShieldCheck />
            {t('开启两步验证')}
          </Button>
        </div>
      )}

      <Dialog open={dialog === 'enroll'} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t('开启两步验证')}</DialogTitle>
            <DialogDescription>{t('用验证器 App 扫码绑定')}</DialogDescription>
          </DialogHeader>
          {dialog === 'enroll' ? (
            <TotpEnrollment
              onEnabled={(res) => {
                toast.success('两步验证已开启')
                setDialog(null)
                setCodes(res.recovery_codes)
                load()
                refreshUser()
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(codes)} onOpenChange={(open) => !open && setCodes(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>{t('保存恢复码')}</DialogTitle>
          </DialogHeader>
          {codes ? <RecoveryCodes codes={codes} /> : null}
          <DialogFooter>
            <Button onClick={() => setCodes(null)}>{t('我已保存')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordDialog
        open={dialog === 'disable'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="关闭两步验证"
        description="关闭后登录只需要密码，现有恢复码全部作废"
        submitText="关闭"
        onConfirm={disable}
      />
      <PasswordDialog
        open={dialog === 'regenerate'}
        onOpenChange={(open) => !open && setDialog(null)}
        title="重新生成恢复码"
        description="旧的恢复码将全部作废"
        submitText="生成"
        onConfirm={regenerate}
      />
    </Panel>
  )
}
