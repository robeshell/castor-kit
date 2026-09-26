import request from '@/shared/api/request'

/** System settings: { items: [{ key, group, type, value, has_value, default, min, max, options, source, env, unavailable_reason }], file_counts } */
export const getSettings = () => request.get('/admin/settings')
/** Save { key: value } pairs (only the changed ones; null resets a value / clears a secret) */
export const saveSettings = (values) => request.put('/admin/settings', { values })

// Test buttons: `values` are unsaved changes from the form, applied on top of the saved settings (nothing is written).
// They reach out to other servers, so they get a longer timeout than the default 10 s.
const TEST_TIMEOUT = 30000
export const testMailSettings = (values, to) => request.post('/admin/settings/test/mail', { values, to }, { timeout: TEST_TIMEOUT })
export const testStorageSettings = (values) => request.post('/admin/settings/test/storage', { values }, { timeout: TEST_TIMEOUT })
export const testAiSettings = (values) => request.post('/admin/settings/test/ai', { values }, { timeout: TEST_TIMEOUT })
