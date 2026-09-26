import { useState } from 'react'
import { ArrowLeft, KeyRound, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/toast'
import { loginTwoFactor } from '@/modules/admin/api/auth'
import TotpCodeInput from '@/modules/admin/components/two-factor/TotpCodeInput'
import { AuthHeading } from '@/modules/auth/components/AuthShell'

/** Second sign-in step: the code from the authenticator app, or a recovery code */
export default function TwoFactorStep({ onSuccess, onBack }) {
  const { t } = useTranslation()
  const [mode, setMode] = useState('code')
  const [code, setCode] = useState('')
  const [recoveryCode, setRecoveryCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (value) => {
    if (submitting) return
    const payload = mode === 'code' ? { code: value ?? code } : { recovery_code: recoveryCode.trim() }
    if (mode === 'code' ? payload.code.length !== 6 : !payload.recovery_code) return
    setSubmitting(true)
    setError('')
    try {
      const data = await loginTwoFactor(payload)
      await onSuccess(data.user)
    } catch (err) {
      setError(errorMessage(err, '验证失败'))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = () => {
    setMode((m) => (m === 'code' ? 'recovery' : 'code'))
    setError('')
  }

  return (
    <div>
      <AuthHeading
        title={t('两步验证')}
        description={mode === 'code' ? t('打开手机上的验证器 App，输入 6 位验证码') : t('输入一个未使用过的恢复码')}
      />
      <form
        className="mt-7 space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        {mode === 'code' ? (
          <TotpCodeInput
            value={code}
            onChange={(v) => {
              setCode(v)
              setError('')
            }}
            onComplete={submit}
            disabled={submitting}
            invalid={Boolean(error)}
          />
        ) : (
          <Input
            autoFocus
            value={recoveryCode}
            onChange={(e) => {
              setRecoveryCode(e.target.value)
              setError('')
            }}
            placeholder="xxxxx-xxxxx"
            autoComplete="off"
            spellCheck={false}
            aria-label={t('恢复码')}
            aria-invalid={Boolean(error)}
            className="h-10 text-center font-mono tracking-wider"
          />
        )}
        {error ? <p className="text-destructive text-center text-xs">{error}</p> : null}
        <Button
          type="submit"
          variant="brand"
          className="h-10 w-full"
          disabled={submitting || (mode === 'code' ? code.length !== 6 : !recoveryCode.trim())}
        >
          {submitting ? <Spinner /> : null}
          {t('验证')}
        </Button>
      </form>
      <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs">
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          {t('返回登录')}
        </button>
        <button type="button" onClick={switchMode} className="text-primary inline-flex items-center gap-1 hover:underline">
          {mode === 'code' ? <KeyRound className="size-3.5" /> : <Smartphone className="size-3.5" />}
          {mode === 'code' ? t('使用恢复码') : t('使用验证码')}
        </button>
      </div>
    </div>
  )
}
