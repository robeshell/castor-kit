import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** 合并 className：条件拼接 + Tailwind 冲突类去重（shadcn 约定） */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
