import { useState } from 'react'
import { KeyRound, ShieldCheck, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/toast'
import { reauth } from '@/modules/admin/api/auth'
import TotpCodeInput from '@/modules/admin/components/two-factor/TotpCodeInput'

/**
 * "Confirm it's you" before a sensitive change: the current password, plus the two-step code (or a recovery code)
 * when the account uses 2FA. Driven by useReauth (shared/hooks/useReauth.js).
 */
export default function ReauthDialog({ open, onVerified, onCancel }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [needCode, setNeedCode] = useState(false)
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setPassword('')
    setNeedCode(false)
    setUseRecovery(false)
    setCode('')
    setRecoveryCode('')
    setError('')
  }

  const submit = async (event) => {
    event?.preventDefault()
    if (!password || submitting) return
    setSubmitting(true)
    setError('')
    try {
      const payload = { password }
      if (needCode) {
        if (useRecovery) payload.recovery_code = recoveryCode.trim()
        else payload.code = code
      }
      await reauth(payload)
      reset()
      onVerified()
    } catch (err) {
      if (err?.mfa_required && !needCode) {
        setNeedCode(true)
      } else {
        setError(errorMessage(err, '验证失败'))
        setCode('')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !submitting) {
          reset()
          onCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-4" />
            {t('验证身份')}
          </DialogTitle>
          <DialogDescription>{t('这是敏感操作，请先确认是你本人。验证后 10 分钟内不再询问。')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="reauth-password" className="text-[13px]">
              {t('当前密码')}
            </Label>
            <Input
              id="reauth-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
              disabled={needCode}
              className="h-9"
            />
          </div>
          {needCode ? (
            <div className="space-y-2">
              <Label className="text-[13px]">{useRecovery ? t('恢复码') : t('两步验证码')}</Label>
              {useRecovery ? (
                <Input
                  autoFocus
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="xxxxx-xxxxx"
                  spellCheck={false}
                  className="h-9 font-mono"
                />
              ) : (
                <TotpCodeInput
                  value={code}
                  onChange={(v) => {
                    setCode(v)
                    setError('')
                  }}
                  onComplete={() => submit()}
                  disabled={submitting}
                  invalid={Boolean(error)}
                />
              )}
              <button
                type="button"
                onClick={() => setUseRecovery((v) => !v)}
                className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
              >
                {useRecovery ? <Smartphone className="size-3.5" /> : <KeyRound className="size-3.5" />}
                {useRecovery ? t('使用验证码') : t('使用恢复码')}
              </button>
            </div>
          ) : null}
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => {
                reset()
                onCancel()
              }}
            >
              {t('取消')}
            </Button>
            <Button type="submit" variant="brand" disabled={submitting || !password || (needCode && (useRecovery ? !recoveryCode.trim() : code.length !== 6))}>
              {submitting ? <Spinner /> : null}
              {t('验证')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
