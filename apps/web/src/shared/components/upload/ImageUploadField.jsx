import { Image, Toast, Typography, Upload } from '@douyinfe/semi-ui'
import { IconPlus } from '@douyinfe/semi-icons'

const IMAGE_TRIGGER_STYLE = {
  width: 120,
  height: 120,
  border: '1px dashed var(--semi-color-border)',
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--semi-color-text-2)',
  background: 'var(--semi-color-fill-0)',
}

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

export default function ImageUploadField({
  fileList = [],
  onFileListChange,
  uploadApi,
  action = '',
  limit = 9,
  accept = '.jpg,.jpeg,.png,.gif,.webp',
  maxSizeMB = 5,
  promptText = '',
  imageSize = 120,
}) {
  const acceptExtensions = parseAcceptExtensions(accept)

  const handleBeforeUpload = (payload) => {
    const file = normalizeFile(payload)
    if (!file) {
      Toast.warning('请先选择图片文件')
      return false
    }
    if (!isValidExtension(file.name, acceptExtensions)) {
      Toast.warning('文件类型不支持，仅允许图片格式')
      return false
    }
    if ((file.size || 0) > maxSizeMB * 1024 * 1024) {
      Toast.warning(`图片不能超过 ${maxSizeMB}MB`)
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
      Toast.success('图片上传成功')
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
      listType="picture"
      picWidth={imageSize}
      picHeight={imageSize}
      accept={accept}
      withCredentials
      showPicInfo
      afterUpload={({ response }) => ({ url: response?.url, status: 'success', preview: true })}
      renderThumbnail={(file) => (
        <Image
          src={file?.url || file?.response?.url}
          width={imageSize}
          height={imageSize}
          preview
          style={{ borderRadius: 8, objectFit: 'cover' }}
        />
      )}
      onChange={handleChange}
      onRemove={handleRemove}
      prompt={promptText ? <Typography.Text type="tertiary">{promptText}</Typography.Text> : null}
      promptPosition="right"
      hotSpotLocation="end"
    >
      <div style={IMAGE_TRIGGER_STYLE}>
        <IconPlus size="large" />
      </div>
    </Upload>
  )
}
