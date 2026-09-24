import { Button, Toast, Typography, Upload } from '@douyinfe/semi-ui'

const normalizeFile = (payload) => payload?.fileInstance || payload?.file || payload

const parseAcceptExtensions = (accept = '') =>
  String(accept)
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.startsWith('.'))

const isValidExtension = (name, extensions) => {
  if (!extensions.length) {
    return true
  }
  const lowerName = String(name || '').toLowerCase()
  return extensions.some((ext) => lowerName.endsWith(ext))
}

export default function FileUploadField({
  fileList = [],
  onFileListChange,
  uploadApi,
  action = '',
  limit = 20,
  accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.zip,.rar,.7z,.json,.ppt,.pptx',
  maxSizeMB = 20,
  promptText = '',
  triggerText = '上传文件',
}) {
  const acceptExtensions = parseAcceptExtensions(accept)

  const handleBeforeUpload = (payload) => {
    const file = normalizeFile(payload)
    if (!file) {
      Toast.warning('请先选择文件')
      return false
    }
    if (!isValidExtension(file.name, acceptExtensions)) {
      Toast.warning('文件类型不支持')
      return false
    }
    if ((file.size || 0) > maxSizeMB * 1024 * 1024) {
      Toast.warning(`文件不能超过 ${maxSizeMB}MB`)
      return false
    }
    return true
  }

  const handleCustomRequest = async ({ file, fileInstance, onError, onSuccess }) => {
    try {
      const uploadFile = fileInstance || file?.fileInstance || file
      const response = await uploadApi(uploadFile)
      const fileUrl = response?.url || ''
      if (!fileUrl) {
        throw new Error('上传成功但未返回文件地址')
      }
      Toast.success('文件上传成功')
      onSuccess?.(response)
    } catch (error) {
      const message = error?.error || error?.message || '上传失败'
      Toast.error(message)
      onError?.({ status: 400 }, new Error(message))
    }
  }

  const handleChange = ({ fileList: nextFileList }) => {
    onFileListChange?.((nextFileList || []).slice(0, limit))
  }

  const handleRemove = (_, nextFileList) => {
    onFileListChange?.(nextFileList || [])
  }

  return (
    <Upload
      action={action}
      customRequest={handleCustomRequest}
      beforeUpload={handleBeforeUpload}
      fileList={fileList}
      multiple
      limit={limit}
      listType="list"
      accept={accept}
      withCredentials
      afterUpload={({ response }) => ({ url: response?.url, status: 'success' })}
      onChange={handleChange}
      onRemove={handleRemove}
      prompt={promptText ? <Typography.Text type="tertiary">{promptText}</Typography.Text> : null}
      promptPosition="bottom"
    >
      <Button theme="light">{triggerText}</Button>
    </Upload>
  )
}
