import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { formatDateTime } from '@/lib/format'
import { toast } from '@/lib/toast'
import { profileDefaults, userDisplayName } from '@/lib/user'
import { changePassword } from '@/modules/admin/api/auth'
import { updateProfile } from '@/modules/admin/api/users'
import ProfileFields from '@/modules/admin/components/ProfileFields'
import { DescriptionList } from '@/shared/components/FormDialog'
import { FormInput } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import UserAvatar from '@/shared/components/UserAvatar'
import { useTranslation } from 'react-i18next'

export default function Profile() {
  const { t } = useTranslation()
  const { user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const form = useForm({ defaultValues: { old_password: '', new_password: '', confirm_password: '' } })
  const submitting = form.formState.isSubmitting
  const profileForm = useForm({ defaultValues: profileDefaults(user) })
  const savingProfile = profileForm.formState.isSubmitting

  // The user may arrive after the first render (AuthContext still loading)
  useEffect(() => {
    if (user && !profileForm.formState.isDirty) profileForm.reset(profileDefaults(user))
  }, [user, profileForm])

  const saveProfile = profileForm.handleSubmit(async (values) => {
    try {
      const res = await updateProfile(values)
      updateUser(res.user)
      profileForm.reset(profileDefaults(res.user))
      toast.success('资料已保存')
    } catch (err) {
      toast.apiError(err, '保存失败')
    }
  })

  const submit = form.handleSubmit(async (values) => {
    try {
      await changePassword({ old_password: values.old_password, new_password: values.new_password })
      toast.success('密码已修改，请重新登录')
      await logout()
      navigate('/login', { replace: true })
    } catch (err) {
      toast.apiError(err, '修改失败')
    }
  })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="个人设置" />

      <Panel className="mb-4">
        <div className="flex items-center gap-4">
          <UserAvatar
            src={user?.avatar}
            name={userDisplayName(user)}
            className="shadow-brand size-14 ring-0"
            fallbackClassName="bg-brand-gradient-strong text-xl font-semibold text-white"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex items-baseline gap-2">
              <span className="truncate text-lg font-semibold tracking-tight">{userDisplayName(user)}</span>
              {user?.nickname ? <span className="text-muted-foreground truncate text-[13px]">@{user.username}</span> : null}
            </div>
            <div className="flex flex-wrap gap-1">
              {(user?.roles || []).map((role) => (
                <StatusBadge key={role.id} tone={role.code === 'super_admin' ? 'brand' : 'neutral'}>
                  {role.name}
                </StatusBadge>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 border-t pt-4">
          <DescriptionList
            columns={2}
            items={[
              { label: '账号 ID', value: user?.id },
              { label: '权限点', value: t('{{count}} 项', { count: user?.menu_codes?.length ?? 0 }) },
              {
                label: '最后登录',
                value: user?.last_login_at ? (
                  <span className="tabular-nums">
                    {formatDateTime(user.last_login_at)}
                    {user.last_login_ip ? <span className="text-muted-foreground"> · {user.last_login_ip}</span> : null}
                  </span>
                ) : null,
              },
              { label: '创建时间', value: <span className="tabular-nums">{formatDateTime(user?.created_at)}</span> },
            ]}
          />
        </div>
      </Panel>

      <Panel title="基本资料" className="mb-4">
        <Form {...profileForm}>
          <form onSubmit={saveProfile} className="space-y-4">
            <ProfileFields control={profileForm.control} name={user?.username} />
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="outline" disabled={savingProfile || !profileForm.formState.isDirty}>
                {savingProfile ? <Spinner /> : <Save />}
                {t('保存资料')}
              </Button>
            </div>
          </form>
        </Form>
      </Panel>

      <Panel title="修改密码" description="修改成功后需要重新登录">
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            <FormInput
              control={form.control}
              name="old_password"
              type="password"
              autoComplete="current-password"
              label="当前密码"
              placeholder="请输入当前登录密码"
              rules={{ required: '请输入当前密码' }}
            />
            <FormInput
              control={form.control}
              name="new_password"
              type="password"
              autoComplete="new-password"
              label="新密码"
              placeholder="至少 6 位"
              rules={{ required: '请输入新密码', minLength: { value: 6, message: '新密码长度至少6位' } }}
            />
            <FormInput
              control={form.control}
              name="confirm_password"
              type="password"
              autoComplete="new-password"
              label="确认新密码"
              placeholder="再次输入新密码"
              rules={{
                required: '请再次输入新密码',
                validate: (v) => v === form.getValues('new_password') || '两次输入的新密码不一致',
              }}
            />
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="brand" disabled={submitting}>
                {submitting ? <Spinner /> : <KeyRound />}
                {t('修改密码')}
              </Button>
            </div>
          </form>
        </Form>
      </Panel>
    </div>
  )
}
