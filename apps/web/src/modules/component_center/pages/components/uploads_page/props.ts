import type { PropDoc } from '@/modules/component_center/showcase/PropsTable'

/** FileUpload (FileUploadProps in shared/components/upload/FileUpload.tsx) */
export const FILE_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'fileList', type: 'readonly UploadFileItem<R>[]', default: '[]', description: '文件列表（受控），见下方 UploadFileItem' },
  { name: 'onFileListChange', type: '(fileList: UploadFileItem<R>[]) => void', description: '添加、上传进度、完成、失败、移除时都会调用' },
  { name: 'uploadApi', type: '(file, { onProgress }) => R | Promise<R>', description: '上传一个文件，返回带 url 的对象；一般传 uploadFile' },
  { name: 'limit', type: 'number', default: '20', description: '最多几个文件；大于 1 时可以多选' },
  { name: 'accept', type: 'string', default: "'.pdf,.doc,.docx,…'", description: '允许的扩展名，逗号分隔' },
  { name: 'maxSizeMB', type: 'number', default: '20', description: '单个文件上限（MB）' },
  // i18n-ignore-next-line: the default value shown as code
  { name: 'triggerText', type: 'string', default: "'点击或拖拽文件到这里上传'", description: '拖放区文字（中文原文，组件内翻译）' },
  { name: 'promptText', type: 'string', default: "''", description: '拖放区下方的提示（中文原文，组件内翻译）' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只读：隐藏拖放区和移除按钮' },
]

/** ImageUpload (ImageUploadProps in shared/components/upload/ImageUpload.tsx) */
export const IMAGE_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'fileList', type: 'readonly UploadFileItem<R>[]', default: '[]', description: '图片列表（受控）' },
  { name: 'onFileListChange', type: '(fileList: UploadFileItem<R>[]) => void', description: '列表变化时调用' },
  { name: 'uploadApi', type: '(file, { onProgress }) => R | Promise<R>', description: '上传一个文件，返回带 url 的对象；一般传 uploadFile' },
  { name: 'limit', type: 'number', default: '9', description: '最多几张；到达上限后隐藏添加按钮' },
  { name: 'accept', type: 'string', default: "'.jpg,.jpeg,.png,.gif,.webp'", description: '允许的扩展名' },
  { name: 'maxSizeMB', type: 'number', default: '5', description: '单张上限（MB）' },
  { name: 'imageSize', type: 'number', default: '96', description: '缩略图边长（px）' },
  { name: 'promptText', type: 'string', default: "''", description: '缩略图下方的提示（中文原文，组件内翻译）' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只读：隐藏添加和移除按钮' },
]

/** AvatarUpload (AvatarUploadProps in shared/components/upload/AvatarUpload.tsx) */
export const AVATAR_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | null', description: '头像 URL；空字符串或 null 表示没有头像' },
  { name: 'onChange', type: '(url: string) => void', description: '上传后传入 /api/admin/files/<id>，手填地址时传入该地址，移除时传入空字符串' },
  { name: 'name', type: 'string | null', description: '显示名称，没有头像时取首字母' },
  { name: 'maxSizeMB', type: 'number', default: 'limits.maxSizeMB ?? 5', description: '图片大小上限（MB），默认取服务器上限' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只显示头像，不显示按钮' },
]

/** FileIdUpload (FileIdUploadProps in shared/components/upload/FileIdUpload.tsx) */
export const FILE_ID_UPLOAD_PROPS: readonly PropDoc[] = [
  { name: 'value', type: 'string | string[] | null', description: '文件中心 id；multiple 时是 id 数组' },
  { name: 'onChange', type: '(value: string | string[] | null) => void', description: '单个时传入 id 或 null，multiple 时传入 id 数组' },
  { name: 'variant', type: "'file' | 'image'", default: "'file'", description: '附件列表或图片缩略图' },
  { name: 'multiple', type: 'boolean', default: 'false', description: '多个文件（最多 20 个）；否则只能有一个' },
  { name: 'accept', type: 'string', default: 'limits.accept', description: '允许的扩展名，默认取服务器允许的类型（图片时只取图片类型）' },
  { name: 'maxSizeMB', type: 'number', default: 'limits.maxSizeMB', description: '单个文件上限（MB），默认取服务器上限' },
  { name: 'disabled', type: 'boolean', default: 'false', description: '只读' },
]

/** One fileList entry (UploadFileItem<R> in shared/components/upload/useUploader.ts) */
export const UPLOAD_FILE_ITEM_PROPS: readonly PropDoc[] = [
  { name: 'uid', type: 'string', description: '列表内的唯一标识' },
  { name: 'name', type: 'string', description: '文件名' },
  { name: 'size', type: 'number', description: '字节数' },
  { name: 'status', type: "'uploading' | 'success' | 'error'", description: '上传状态' },
  { name: 'percent', type: 'number', description: '上传中的进度（0–100）' },
  { name: 'url', type: 'string', description: '上传完成后查看文件的地址' },
  { name: 'response', type: 'R', description: 'uploadApi 返回的对象；uploadFile 返回 FileRecord，id 就是文件中心 id' },
  { name: 'preview', type: 'string', description: '本地图片的临时预览地址，上传完成前显示' },
]
