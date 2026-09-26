import { useState } from 'react'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/toast'
import { requestPasswordReset } from '@/modules/admin/api/auth'
import { AuthHeading } from '@/modules/auth/components/AuthShell'

/** Ask for a reset link by email; the answer is the same whether or not the email belongs to an account */
export default function ForgotPasswordStep({ onBack }) {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sentMessage, setSentMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    const value = email.trim()
    if (!/^[^\s@]+@[^\s@]+$/.test(value)) {
      setError(t('请输入正确的邮箱地址'))
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await requestPasswordReset(value)
      setSentMessage(res.message)
    } catch (err) {
      setError(errorMessage(err, '发送失败'))
    } finally {
      setSubmitting(false)
    }
  }

  const back = (
    <div className="mt-5 border-t pt-4 text-xs">
      <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="size-3.5" />
        {t('返回登录')}
      </button>
    </div>
  )

  if (sentMessage) {
    return (
      <div>
        <div className="bg-brand-soft text-primary mx-auto mb-4 flex size-11 items-center justify-center rounded-full">
          <MailCheck className="size-5" />
        </div>
        <AuthHeading title={t('请查收邮件')} description={sentMessage} />
        <p className="text-muted-foreground mt-4 text-center text-xs leading-relaxed">
          {t('链接 30 分钟内有效。没收到的话，检查一下垃圾邮件，或确认填写的是账号绑定的邮箱。')}
        </p>
        {back}
      </div>
    )
  }

  return (
    <div>
      <AuthHeading title={t('找回密码')} description={t('输入账号绑定的邮箱，我们会发送一个重置密码的链接')} />
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email" className="text-[13px]">
            {t('邮箱')}
          </Label>
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              id="reset-email"
              type="email"
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
              placeholder="name@example.com"
              aria-invalid={Boolean(error)}
              className="h-10 pl-9"
            />
          </div>
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
        </div>
        <Button type="submit" variant="brand" className="h-10 w-full" disabled={submitting}>
          {submitting ? <Spinner /> : null}
          {t('发送重置链接')}
        </Button>
      </form>
      {back}
    </div>
  )
}
