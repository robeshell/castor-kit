import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage, toast } from '@/lib/toast'
import { enableTwoFactor, setupTwoFactor } from '@/modules/admin/api/auth'
import TotpCodeInput from '@/modules/admin/components/two-factor/TotpCodeInput'

/** Base32 secret in groups of four, easier to type by hand */
const groupSecret = (secret) => secret.replace(/(.{4})/g, '$1 ').trim()

/**
 * Two-step enrollment: fetch a new secret, show it as a QR code (and as text), confirm with the first code.
 * Used from the profile and from sign-in when a role requires 2FA. `onEnabled(response)` receives the API response
 * ({ recovery_codes } — plus user / csrf_token when it finishes a sign-in).
 */
export default function TotpEnrollment({ onEnabled, submitText = '开启两步验证' }) {
  const { t } = useTranslation()
  const [setup, setSetup] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setupTwoFactor()
      .then((res) => alive && setSetup(res))
      .catch((err) => alive && setLoadError(errorMessage(err, '获取密钥失败')))
    return () => {
      alive = false
    }
  }, [attempt])

  const retry = () => {
    setLoadError('')
    setSetup(null)
    setAttempt((n) => n + 1)
  }

  const submit = async (value = code) => {
    if (value.length !== 6 || submitting) return
    setSubmitting(true)
    setError('')
    try {
      onEnabled?.(await enableTwoFactor(value))
    } catch (err) {
      setError(errorMessage(err, '验证失败'))
      setCode('')
    } finally {
      setSubmitting(false)
    }
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(setup.secret)
      toast.success('已复制')
    } catch {
      toast.error('复制失败，请手动选择复制')
    }
  }

  if (loadError) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-destructive text-sm">{loadError}</p>
        <Button type="button" variant="outline" size="sm" onClick={retry}>
          <RefreshCw />
          {t('重试')}
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <ol className="text-muted-foreground list-decimal space-y-1 pl-4 text-[13px] leading-relaxed">
        <li>{t('在手机上打开验证器 App（如 Google Authenticator、Microsoft Authenticator、1Password）')}</li>
        <li>{t('扫描二维码，或手动输入下面的密钥')}</li>
        <li>{t('输入 App 显示的 6 位验证码完成绑定')}</li>
      </ol>

      <div className="flex flex-col items-center gap-3">
        {/* QR codes need dark modules on a light background to scan reliably, whatever the theme */}
        <div className="rounded-xl border bg-white p-3 text-black">
          {setup ? (
            <QRCodeSVG value={setup.otpauth_url} size={168} marginSize={0} fgColor="currentColor" bgColor="transparent" />
          ) : (
            <Skeleton className="size-[168px]" />
          )}
        </div>
        {setup ? (
          <button
            type="button"
            onClick={copySecret}
            title={t('复制密钥')}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-xs tracking-wide transition-colors"
          >
            {groupSecret(setup.secret)}
            <Copy className="size-3" />
          </button>
        ) : null}
      </div>

      <div className="space-y-2">
        <TotpCodeInput
          value={code}
          onChange={(v) => {
            setCode(v)
            setError('')
          }}
          onComplete={submit}
          disabled={!setup || submitting}
          invalid={Boolean(error)}
          autoFocus={false}
        />
        {error ? <p className="text-destructive text-center text-xs">{error}</p> : null}
      </div>

      <Button type="button" variant="brand" className="w-full" disabled={!setup || code.length !== 6 || submitting} onClick={() => submit()}>
        {submitting ? <Spinner /> : null}
        {t(submitText)}
      </Button>
    </div>
  )
}
