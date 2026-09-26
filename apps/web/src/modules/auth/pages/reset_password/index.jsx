import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, KeyRound, TriangleAlert } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { errorMessage } from '@/lib/toast'
import { confirmPasswordReset } from '@/modules/admin/api/auth'
import AuthShell, { AuthHeading } from '@/modules/auth/components/AuthShell'
import { FormInput } from '@/shared/components/FormFields'
import { usePasswordPolicy } from '@/shared/hooks/usePasswordPolicy'

function BackToLogin({ label = '返回登录' }) {
  const { t } = useTranslation()
  return (
    <Button asChild variant="outline" className="mt-6 h-10 w-full">
      <Link to="/login" replace>
        <ArrowLeft />
        {t(label)}
      </Link>
    </Button>
  )
}

/** Public page opened from the reset mail: /reset-password?token=… */
export default function ResetPassword() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const { validate, hint } = usePasswordPolicy()
  const form = useForm({ defaultValues: { new_password: '', confirm_password: '' } })
  const submitting = form.formState.isSubmitting
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = form.handleSubmit(async (values) => {
    setError('')
    try {
      await confirmPasswordReset(token, values.new_password)
      setDone(true)
    } catch (err) {
      setError(errorMessage(err, '重置失败'))
    }
  })

  if (!token) {
    return (
      <AuthShell>
        <div className="bg-warning-soft text-warning mx-auto mb-4 flex size-11 items-center justify-center rounded-full">
          <TriangleAlert className="size-5" />
        </div>
        <AuthHeading title={t('链接不完整')} description={t('请从邮件里的链接打开此页面，或回到登录页重新申请找回密码。')} />
        <BackToLogin />
      </AuthShell>
    )
  }

  if (done) {
    return (
      <AuthShell>
        <div className="bg-success-soft text-success mx-auto mb-4 flex size-11 items-center justify-center rounded-full">
          <CircleCheck className="size-5" />
        </div>
        <AuthHeading title={t('密码已重置')} description={t('所有设备上的登录都已退出，请使用新密码登录。')} />
        <BackToLogin label="去登录" />
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <AuthHeading title={t('设置新密码')} description={t('链接 30 分钟内有效，只能使用一次')} />
      <Form {...form}>
        <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
          <FormInput
            control={form.control}
            name="new_password"
            type="password"
            autoComplete="new-password"
            label="新密码"
            placeholder={hint}
            inputClassName="h-10"
            rules={{ required: '请输入新密码', validate }}
          />
          <FormInput
            control={form.control}
            name="confirm_password"
            type="password"
            autoComplete="new-password"
            label="确认新密码"
            placeholder="再次输入新密码"
            inputClassName="h-10"
            rules={{
              required: '请再次输入新密码',
              validate: (v) => v === form.getValues('new_password') || '两次输入的新密码不一致',
            }}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <Button type="submit" variant="brand" className="h-10 w-full" disabled={submitting}>
            {submitting ? <Spinner /> : <KeyRound />}
            {t('重置密码')}
          </Button>
        </form>
      </Form>
      <div className="mt-5 border-t pt-4 text-xs">
        <Link to="/login" replace className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          {t('返回登录')}
        </Link>
      </div>
    </AuthShell>
  )
}
