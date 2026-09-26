import { useWatch } from 'react-hook-form'
import { FormAvatarUpload, FormGrid, FormInput } from '@/shared/components/FormFields'

// Mirrors the backend checks in apps/api/src/modules/admin/users/schema.ts (normalizeProfile); the avatar is uploaded
// to the file center, so it needs no format check here
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9][0-9 -]{4,19}$/

const optional = (re, message) => (value) => !value?.trim() || re.test(value.trim()) || message

/**
 * Nickname / email / phone / avatar fields, shared by the user dialog and the profile page.
 * `name` is the fallback letter source for the avatar.
 */
export default function ProfileFields({ control, name }) {
  const nickname = useWatch({ control, name: 'nickname' })
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
      <FormAvatarUpload control={control} name="avatar" label="头像" displayName={nickname || name} />
    </>
  )
}
