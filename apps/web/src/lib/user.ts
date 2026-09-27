/** The user fields these helpers read (a user record, the signed-in user, or a partial of either) */
export interface UserLike {
  nickname?: string | null
  username?: string | null
  email?: string | null
  phone?: string | null
  avatar?: string | null
}

/** Profile form values */
export interface ProfileValues {
  nickname: string
  email: string
  phone: string
  avatar: string
}

/** Display name for a user: nickname first, then username */
export const userDisplayName = (user: UserLike | null | undefined): string => user?.nickname || user?.username || ''

/** Form values for the profile fields (nickname / email / phone / avatar) of a user record */
export const profileDefaults = (user: UserLike | null | undefined): ProfileValues => ({
  nickname: user?.nickname || '',
  email: user?.email || '',
  phone: user?.phone || '',
  avatar: user?.avatar || '',
})
