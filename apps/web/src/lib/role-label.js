import i18n from '@/i18n'

// Built-in roles are translated by code; custom roles are user data and shown as stored
const BUILT_IN = {
  super_admin: { name: '超级管理员', description: '拥有所有权限的超级管理员' },
}

export function roleName(role) {
  const builtIn = role && BUILT_IN[role.code]
  return builtIn ? i18n.t(builtIn.name) : role?.name || ''
}

export function roleDescription(role) {
  const builtIn = role && BUILT_IN[role.code]
  return builtIn ? i18n.t(builtIn.description) : role?.description || ''
}
