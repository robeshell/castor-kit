import { useEffect, useState } from 'react'
import request from '@/shared/api/request'

/**
 * Items of data dictionaries (System → Configuration → Data dictionary), keyed by dictionary code:
 *   const dicts = useDictOptions(['device_category'])
 *   <FormSelect options={dicts.device_category ?? []} … />
 * Each item is { label, value, color, is_default }; only active items, in dictionary order. Any signed-in user can read them.
 */
/** One active item of a data dictionary */
export interface DictOption {
  label: string
  value: string
  color: string | null
  is_default: boolean
}

/** Dictionary code → its items */
export type DictOptions = Partial<Record<string, DictOption[]>>

export function useDictOptions(codes: readonly string[]): DictOptions {
  const key = codes.join(',')
  const [options, setOptions] = useState<DictOptions>({})

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    request
      .get<unknown, DictOptions | null>('/admin/dicts/options', { params: { codes: key } })
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
export function dictLabel<V>(dicts: DictOptions, code: string, value: V): V | string {
  if (value === null || value === undefined || value === '') return value
  return dicts[code]?.find((item) => String(item.value) === String(value))?.label ?? value
}
