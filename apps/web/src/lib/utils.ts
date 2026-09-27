import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge classNames: conditional joining + dedupe of conflicting Tailwind classes (shadcn convention) */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
