/**
 * Files module schema layer: upload validation rules
 */

import { basename } from 'node:path'

/** Detected file-type ext → accepted for these declared extensions (office formats are zip / cfb containers) */
const SIGNATURE_FAMILY: Record<string, string[]> = {
  jpg: ['jpg'],
  jpeg: ['jpg'],
  png: ['png'],
  gif: ['gif'],
  webp: ['webp'],
  pdf: ['pdf'],
  zip: ['zip'],
  docx: ['docx', 'zip'],
  xlsx: ['xlsx', 'zip'],
  pptx: ['pptx', 'zip'],
  doc: ['cfb'],
  xls: ['cfb'],
  ppt: ['cfb'],
}

/** Plain-text formats have no signature: accepted only when nothing binary is detected */
const TEXT_TYPES: Record<string, string> = { txt: 'text/plain', csv: 'text/csv', md: 'text/markdown', json: 'application/json' }

/** Fallback MIME types for extensions whose content is detected but where the declared type is nicer */
const MIME_BY_EXT: Record<string, string> = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
}

/** Images safe to show inline in the browser; everything else is served as a download */
export const INLINE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp'])

/** File category used by the list filter */
export const FILE_KINDS = ['image', 'document', 'other'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.')
  return dot > 0 ? filename.slice(dot + 1).toLowerCase() : ''
}

/** Display name: last path segment, no control characters, at most 255 characters (keeping the extension) */
export function sanitizeFilename(raw: string): string {
  const name = basename(raw.replace(/\\/g, '/')).replace(/[\x00-\x1f\x7f]/g, '').trim() || 'file'
  if (name.length <= 255) return name
  const ext = extensionOf(name)
  return ext && ext.length < 20 ? `${name.slice(0, 254 - ext.length)}.${ext}` : name.slice(0, 255)
}

/**
 * Check the declared extension against the detected signature. Returns the MIME type to store, or null when the
 * content doesn't match the extension.
 */
export function resolveMime(ext: string, detected: { ext: string; mime: string } | undefined): string | null {
  if (ext in TEXT_TYPES) return detected ? null : TEXT_TYPES[ext]!
  const family = SIGNATURE_FAMILY[ext]
  if (family) {
    if (!detected || !family.includes(detected.ext)) return null
    return MIME_BY_EXT[ext] ?? detected.mime
  }
  // Extensions added through UPLOAD_ALLOWED_TYPES: the signature must match when there is one
  if (!detected) return 'application/octet-stream'
  return detected.ext === ext ? detected.mime : null
}
