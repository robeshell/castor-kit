import request from '@/shared/api/request'
import type { ApiBody, ApiItem, ApiResponse } from '@/shared/api/types'

/** One system setting with where its value comes from (secrets only report has_value) */
export type SettingItem = ApiItem<'/api/admin/settings'>
/** The settings page payload: `{ items, file_counts }` */
export type SettingsResponse = ApiResponse<'/api/admin/settings'>
/** Setting values keyed by setting key */
export type SettingValues = ApiBody<'/api/admin/settings', 'put'>['values']
/** Unsaved form values the test buttons apply on top of the saved settings */
type TestValues = ApiBody<'/api/admin/settings/test/ai', 'post'>['values']

/** System settings: { items: [{ key, group, type, value, has_value, default, min, max, options, source, env, unavailable_reason }], file_counts } */
export const getSettings = () => request.get<unknown, SettingsResponse>('/admin/settings')
/** Save { key: value } pairs (only the changed ones; null resets a value / clears a secret) */
export const saveSettings = (values: SettingValues) =>
  request.put<unknown, ApiResponse<'/api/admin/settings', 'put'>>('/admin/settings', { values })

// Test buttons: `values` are unsaved changes from the form, applied on top of the saved settings (nothing is written).
// They reach out to other servers, so they get a longer timeout than the default 10 s.
const TEST_TIMEOUT = 30000
export const testMailSettings = (values: TestValues, to: string) =>
  request.post<unknown, ApiResponse<'/api/admin/settings/test/mail', 'post'>>('/admin/settings/test/mail', { values, to }, { timeout: TEST_TIMEOUT })
export const testStorageSettings = (values: TestValues) =>
  request.post<unknown, ApiResponse<'/api/admin/settings/test/storage', 'post'>>('/admin/settings/test/storage', { values }, { timeout: TEST_TIMEOUT })
export const testAiSettings = (values: TestValues) =>
  request.post<unknown, ApiResponse<'/api/admin/settings/test/ai', 'post'>>('/admin/settings/test/ai', { values }, { timeout: TEST_TIMEOUT })
