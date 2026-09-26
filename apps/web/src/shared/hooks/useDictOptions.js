import { useEffect, useState } from 'react'
import request from '@/shared/api/request'

/**
 * Items of data dictionaries (System → Configuration → Data dictionary), keyed by dictionary code:
 *   const dicts = useDictOptions(['device_category'])
 *   <FormSelect options={dicts.device_category ?? []} … />
 * Each item is { label, value, color, is_default }; only active items, in dictionary order. Any signed-in user can read them.
 */
export function useDictOptions(codes) {
  const key = codes.join(',')
  const [options, setOptions] = useState({})

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    request
      .get('/admin/dicts/options', { params: { codes: key } })
      .then((res) => {
        if (alive) setOptions(res || {})
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [key])

  return options
}

/** Label of a dictionary value (the value itself when the dictionary doesn't have it) */
export function dictLabel(dicts, code, value) {
  if (value === null || value === undefined || value === '') return value
  return dicts[code]?.find((item) => String(item.value) === String(value))?.label ?? value
}
