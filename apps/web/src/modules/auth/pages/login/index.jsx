import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { login, logout as cancelSignIn } from '@/modules/admin/api/auth'
import RecoveryCodes from '@/modules/admin/components/two-factor/RecoveryCodes'
import TotpEnrollment from '@/modules/admin/components/two-factor/TotpEnrollment'
import AuthShell, { AuthHeading } from '@/modules/auth/components/AuthShell'
import ForgotPasswordStep from '@/modules/auth/pages/login/ForgotPasswordStep'
import TwoFactorStep from '@/modules/auth/pages/login/TwoFactorStep'
import { useAppInfo } from '@/shared/hooks/useAppInfo'
import { useTranslation } from 'react-i18next'

/** Input with a leading icon */
function IconInput({ icon: Icon, invalid, className, ...props }) {
  return (
    <div className="relative">
      <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input aria-invalid={invalid} className={cn('h-10 pl-9', className)} {...props} />
    </div>
  )
}

/**
 * Sign-in, one card with steps:
 * password → (verify: 2FA code | setup: enroll first, then save recovery codes) → signed in; forgot: reset link by email.
 * The 2FA steps appear only when system settings turns two-step verification on (see the account security docs).
 */
export default function Login() {
  const { t } = useTranslation()
  const { user, login: setAuth, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  /** password | verify | setup | codes | forgot */
  const [step, setStep] = useState('password')
  /** Enrollment during sign-in: the user and recovery codes, shown before entering the app */
  const [enrolled, setEnrolled] = useState(null)
  const appInfo = useAppInfo()
  const demoAccount = appInfo?.demo_mode ? appInfo.demo_account : null
  const canResetPassword = Boolean(appInfo?.security?.password_reset_enabled)

  if (!loading && user) return <Navigate to="/" replace />

  const finish = async (userData) => {
    await setAuth(userData)
    toast.success('登录成功')
    navigate('/')
  }

  const signIn = async (name, secret) => {
    setSubmitting(true)
    try {
      const data = await login({ username: name, password: secret })
      if (data.mfa_required) {
        setStep(data.mfa_required)
        return
      }
      await finish(data.user)
    } catch (err) {
      toast.apiError(err, '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  /** Leave a 2FA step: drop the half-finished session and start over */
  const backToPassword = async () => {
    if (step === 'verify' || step === 'setup') await cancelSignIn().catch(() => {})
    setPassword('')
    setEnrolled(null)
    setStep('password')
  }

  const submit = (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!username.trim()) nextErrors.username = t('请输入用户名')
    if (!password) nextErrors.password = t('请输入密码')
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    signIn(username, password)
  }

  /** Public demo: fill in the demo account and sign in with one click */
  const demoSignIn = () => {
    setUsername(demoAccount.username)
    setPassword(demoAccount.password)
    setErrors({})
    signIn(demoAccount.username, demoAccount.password)
  }

  const passwordStep = (
    <>
      <h1 className="text-center text-[22px] font-semibold tracking-tight">{t('登录')}</h1>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="username" className="text-[13px]">
            {t('用户名')}
          </Label>
          <IconInput
            id="username"
            icon={User}
            autoComplete="username"
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="admin"
            invalid={Boolean(errors.username)}
          />
          {errors.username ? <p className="text-destructive text-xs">{errors.username}</p> : null}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-[13px]">
              {t('密码')}
            </Label>
            {canResetPassword ? (
              <button type="button" onClick={() => setStep('forgot')} className="text-primary text-xs hover:underline">
                {t('忘记密码？')}
              </button>
            ) : null}
          </div>
          <div className="relative">
            <IconInput
              id="password"
              icon={LockKeyhole}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('请输入密码')}
              invalid={Boolean(errors.password)}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? t('隐藏密码') : t('显示密码')}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password ? <p className="text-destructive text-xs">{errors.password}</p> : null}
        </div>

        <Button type="submit" variant="brand" disabled={submitting} className="group mt-2 h-10 w-full">
          {submitting ? <Spinner /> : null}
          {t('登录')}
          {!submitting ? <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
        </Button>
      </form>

      {demoAccount ? (
        <div className="mt-6 border-t pt-5">
          <div className="bg-brand-soft flex items-center gap-3 rounded-lg px-3.5 py-3">
            <Sparkles className="text-primary size-4 shrink-0" />
            <div className="min-w-0 flex-1 text-xs leading-relaxed">
              <div className="text-foreground font-medium">{t('演示账号')}</div>
              <div className="text-muted-foreground font-mono">
                {demoAccount.username} / {demoAccount.password}
              </div>
            </div>
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0" disabled={submitting} onClick={demoSignIn}>
              {t('一键登录')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 border-t pt-5 text-xs">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>{t('默认管理员账号 admin，密码以部署配置为准')}</span>
        </div>
      )}
    </>
  )

  return (
    <AuthShell>
      {step === 'verify' ? <TwoFactorStep onSuccess={finish} onBack={backToPassword} /> : null}
      {step === 'setup' ? (
        <div>
          <AuthHeading title={t('绑定两步验证')} description={t('你的账号要求开启两步验证，绑定后即可登录')} />
          <div className="mt-6">
            <TotpEnrollment
              submitText="完成绑定"
              onEnabled={(res) => {
                setEnrolled({ user: res.user, codes: res.recovery_codes })
                setStep('codes')
              }}
            />
          </div>
          <div className="mt-5 border-t pt-4 text-xs">
            <button type="button" onClick={backToPassword} className="text-muted-foreground hover:text-foreground">
              {t('返回登录')}
            </button>
          </div>
        </div>
      ) : null}
      {step === 'codes' && enrolled ? (
        <div>
          <AuthHeading title={t('保存恢复码')} description={t('两步验证已开启')} />
          <div className="mt-6">
            <RecoveryCodes codes={enrolled.codes} />
          </div>
          <Button type="button" variant="brand" className="mt-5 h-10 w-full" onClick={() => finish(enrolled.user)}>
            {t('我已保存，进入系统')}
            <ArrowRight />
          </Button>
        </div>
      ) : null}
      {step === 'forgot' ? <ForgotPasswordStep onBack={() => setStep('password')} /> : null}
      {step === 'password' ? passwordStep : null}
    </AuthShell>
  )
}
