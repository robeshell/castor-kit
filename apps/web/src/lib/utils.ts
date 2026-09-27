import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge classNames: conditional joining + dedupe of conflicting Tailwind classes (shadcn convention) */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
