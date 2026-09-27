/** Types for i18n-scan.mjs, which the frontend tests import (the script stays plain JavaScript run by node). */

export const WEB_DIR: string
export const SRC_DIR: string
export const LANGS: string[]

export type ProblemKind = 'missing' | 'jsx-text' | 'template' | 'parse-error'

export interface Problem {
  /** Relative to apps/web */
  file: string
  line: number
  kind: ProblemKind
  text: string
}

export interface Conflict {
  lang: string
  key: string
  a: string
  fileA: string
  b: string
  fileB: string
}

/** Language → (Chinese key → translation) */
export type Catalogs = Record<string, Record<string, string>>

/** Merged catalogs plus conflicts where two files translate a key differently */
export function loadCatalogs(): { catalogs: Catalogs; conflicts: Conflict[] }

export function scanFile(path: string, catalogs: Catalogs): Problem[]

/** Scans `target` (relative to apps/web, default: src) */
export function scan(target?: string): { problems: Problem[]; conflicts: Conflict[] }
