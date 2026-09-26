import { useWatch } from 'react-hook-form'
import { FormGrid, FormInput } from '@/shared/components/FormFields'
import UserAvatar from '@/shared/components/UserAvatar'

// Mirrors the backend checks in apps/api/src/modules/admin/users/schema.ts (normalizeProfile)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9 -]{4,19}$/
const AVATAR_RE = /^(https?:\/\/|\/)\S+$/

const optional = (re, message) => (value) => !value?.trim() || re.test(value.trim()) || message

/** Default form values for the profile fields of a user record */
export const profileDefaults = (user) => ({
  nickname: user?.nickname || '',
  email: user?.email || '',
  phone: user?.phone || '',
  avatar: user?.avatar || '',
})

/**
 * Nickname / email / phone / avatar fields, shared by the user dialog and the profile page.
 * `name` is the fallback letter source for the avatar preview.
 */
export default function ProfileFields({ control, name }) {
  const [nickname, avatar] = useWatch({ control, name: ['nickname', 'avatar'] })
  const previewSrc = AVATAR_RE.test((avatar || '').trim()) ? avatar.trim() : undefined
  return (
    <>
      <FormGrid>
        <FormInput control={control} name="nickname" label="昵称" placeholder="显示名称，可留空" rules={{ maxLength: { value: 100, message: '昵称不能超过 100 个字符' } }} />
        <FormInput
          control={control}
          name="email"
          type="email"
          autoComplete="email"
          label="邮箱"
          placeholder="name@example.com"
          rules={{ maxLength: { value: 100, message: '邮箱不能超过 100 个字符' }, validate: optional(EMAIL_RE, '邮箱格式不正确') }}
        />
        <FormInput
          control={control}
          name="phone"
          type="tel"
          autoComplete="tel"
          label="手机"
          placeholder="例如 13800000000"
          rules={{ maxLength: { value: 20, message: '手机号不能超过 20 个字符' }, validate: optional(PHONE_RE, '手机号格式不正确') }}
        />
      </FormGrid>
      <div className="flex items-start gap-3">
        <UserAvatar src={previewSrc} name={nickname || name} className="mt-6 size-9" />
        <FormInput
          className="min-w-0 flex-1"
          control={control}
          name="avatar"
          label="头像地址"
          placeholder="https://… 或 /…"
          description="填写图片地址；上传功能随文件中心提供"
          rules={{ maxLength: { value: 500, message: '头像地址不能超过 500 个字符' }, validate: optional(AVATAR_RE, '头像地址需以 http(s):// 或 / 开头') }}
        />
      </div>
    </>
  )
}
