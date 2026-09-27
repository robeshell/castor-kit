/**
 * File center API for the Files page. The calls live in @/shared/api/files because the shared upload components use
 * them too; this module file keeps the admin page on the usual modules/<module>/api/<page>.ts path.
 */
export { deleteFile, fileUrl, getFileInfo, getFiles, uploadFile } from '@/shared/api/files'
export type { FileInfo, FileRecord, FileReference, UploadOptions } from '@/shared/api/files'
