/** Display name for a user: nickname first, then username */
export const userDisplayName = (user) => user?.nickname || user?.username || ''

/** Form values for the profile fields (nickname / email / phone / avatar) of a user record */
export const profileDefaults = (user) => ({
  nickname: user?.nickname || '',
  email: user?.email || '',
  phone: user?.phone || '',
  avatar: user?.avatar || '',
})
