import i18n from '@/i18n'

// Built-in roles are translated by code; custom roles are user data and shown as stored
const BUILT_IN: Partial<Record<string, { name: string; description: string }>> = {
  super_admin: { name: '超级管理员', description: '拥有所有权限的超级管理员' },
}

/** The role fields the labels are read from */
export interface RoleLike {
  code?: string | null
  name?: string | null
  description?: string | null
}

export function roleName(role: RoleLike | null | undefined): string {
  const builtIn = role && BUILT_IN[role.code ?? '']
  return builtIn ? i18n.t(builtIn.name) : role?.name || ''
}

export function roleDescription(role: RoleLike | null | undefined): string {
  const builtIn = role && BUILT_IN[role.code ?? '']
  return builtIn ? i18n.t(builtIn.description) : role?.description || ''
}
