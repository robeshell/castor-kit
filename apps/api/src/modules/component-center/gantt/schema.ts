/**
 * 甘特图页 schema 层（对齐 AuraStack backend/app/component_center/schema/gantt_page.py）
 */

import { pyInt, pyStr, pyTruthy } from '@/common/py'

export const TASK_TYPE_VALUES = new Set(['phase', 'task', 'milestone'])
export const PRIORITY_VALUES = new Set(['low', 'medium', 'high', 'critical'])
export const STATUS_VALUES = new Set(['not_started', 'in_progress', 'completed', 'delayed'])

/** `parse_int(value, default=0)` */
export function parseIntOr<T>(value: unknown, fallback: T): number | T {
  try {
    return pyInt(value)
  } catch {
    return fallback
  }
}

/** `str(v or '').strip()` */
export function strOrEmpty(value: unknown): string {
  return pyTruthy(value) ? pyStr(value).trim() : ''
}

/** `str(v or '').strip() or None` */
export function strOrNull(value: unknown): string | null {
  return strOrEmpty(value) || null
}

/** `str(v or '#4080FF').strip() or '#4080FF'` */
export function colorOrDefault(value: unknown): string {
  return (pyTruthy(value) ? pyStr(value) : '#4080FF').trim() || '#4080FF'
}

/** `str(v or fallback).strip()`，不在枚举内回落 fallback */
export function normalizeEnum(value: unknown, allowed: Set<string>, fallback: string): string {
  const s = (pyTruthy(value) ? pyStr(value) : fallback).trim()
  return allowed.has(s) ? s : fallback
}

/** `max(0, min(100, progress))` */
export function clampProgress(progress: number): number {
  return Math.max(0, Math.min(100, progress))
}

export function hasKey(data: Record<string, unknown>, key: string): boolean {
  return Object.hasOwn(data, key)
}

/** 只保留与当前行不同的字段（SQLAlchemy 只对变化的属性发 UPDATE） */
export function changedFields<R extends Record<string, unknown>, P extends Partial<R>>(row: R, patch: P): P {
  const out: Partial<R> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) (out as Record<string, unknown>)[k] = v
  }
  return out as P
}
