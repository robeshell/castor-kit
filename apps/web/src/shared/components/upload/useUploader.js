import { useEffect, useRef } from 'react'
import { toast } from '@/lib/toast'
import i18n from '@/i18n'

const parseExtensions = (accept = '') =>
  String(accept)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.startsWith('.'))

let seq = 0
const nextUid = () => `up-${Date.now()}-${seq++}`

/**
 * Upload state machine: validate extension / size → call uploadApi(file, { onProgress }) → fill in url.
 * fileList entry shape: { uid, name, url, status: 'uploading' | 'success' | 'error', percent, response }
 * uploadApi resolves to an object with `url` (the file center's uploadFile does); onProgress(percent) is optional.
 */
export function useUploader({ fileList, onFileListChange, uploadApi, limit, accept, maxSizeMB, kind = '文件' }) {
  const listRef = useRef(fileList)
  useEffect(() => {
    listRef.current = fileList
  }, [fileList])
  const extensions = parseExtensions(accept)

  const update = (uid, patch) => {
    const next = listRef.current.map((f) => (f.uid === uid ? { ...f, ...patch } : f))
    listRef.current = next
    onFileListChange?.(next)
  }

  const addFiles = (files) => {
    const room = Math.max(0, limit - listRef.current.length)
    const picked = Array.from(files || []).slice(0, room)
    if (files && files.length > room) toast.warning(i18n.t('最多上传 {{limit}} 个{{kind}}', { limit, kind: i18n.t(kind) }))
    picked.forEach((file) => {
      const name = String(file.name || '').toLowerCase()
      if (extensions.length && !extensions.some((ext) => name.endsWith(ext))) {
        toast.warning(i18n.t('{{kind}}类型不支持', { kind: i18n.t(kind) }))
        return
      }
      if ((file.size || 0) > maxSizeMB * 1024 * 1024) {
        toast.warning(i18n.t('{{kind}}不能超过 {{size}}MB', { kind: i18n.t(kind), size: maxSizeMB }))
        return
      }
      const uid = nextUid()
      const preview = file.type?.startsWith('image/') ? URL.createObjectURL(file) : undefined
      const next = [...listRef.current, { uid, name: file.name, size: file.size, status: 'uploading', percent: 0, preview }]
      listRef.current = next
      onFileListChange?.(next)
      Promise.resolve(uploadApi?.(file, { onProgress: (percent) => update(uid, { percent }) }))
        .then((res) => {
          const url = res?.url || ''
          if (!url) throw new Error('上传成功但未返回文件地址')
          update(uid, { status: 'success', percent: 100, url, response: res })
          toast.success(i18n.t('{{kind}}上传成功', { kind: i18n.t(kind) }))
        })
        .catch((err) => {
          update(uid, { status: 'error' })
          toast.apiError(err, '上传失败')
        })
    })
  }

  const remove = (uid) => {
    const next = listRef.current.filter((f) => f.uid !== uid)
    listRef.current = next
    onFileListChange?.(next)
  }

  return { addFiles, remove }
}
