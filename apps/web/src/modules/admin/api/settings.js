import request from '@/shared/api/request'

/** System settings: { items: [{ key, type, value, default, min, max, unavailable_reason }] } */
export const getSettings = () => request.get('/admin/settings')
/** Save { key: value } pairs (only the changed ones are needed) */
export const saveSettings = (values) => request.put('/admin/settings', { values })
