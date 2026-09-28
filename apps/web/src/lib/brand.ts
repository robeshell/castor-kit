/**
 * The product name users see: browser tab titles, the sidebar wordmark, the sign-in footer and downloaded file names.
 * A project built on castor-kit changes it here (and the <title> in index.html); the backend's APP_NAME variable
 * covers what the server says (authenticator apps, mails, the AI assistant).
 */
export const APP_NAME: string = 'castor-kit'

/** The name as a file-name part: lowercase letters, digits and hyphens */
export const APP_SLUG = APP_NAME.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'app'
