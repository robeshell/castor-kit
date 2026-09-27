/**
 * Components → Uploads: FileUpload, ImageUpload, AvatarUpload and FileIdUpload, all uploading to the real file center
 * (POST /api/admin/files). Layout and conventions follow the data table page.
 */
import AvatarPicker from '@/modules/component_center/pages/components/uploads_page/examples/AvatarPicker'
import avatarPickerSource from '@/modules/component_center/pages/components/uploads_page/examples/AvatarPicker.tsx?raw'
import FileIdFields from '@/modules/component_center/pages/components/uploads_page/examples/FileIdFields'
import fileIdFieldsSource from '@/modules/component_center/pages/components/uploads_page/examples/FileIdFields.tsx?raw'
import FileUploadBasic from '@/modules/component_center/pages/components/uploads_page/examples/FileUploadBasic'
import fileUploadBasicSource from '@/modules/component_center/pages/components/uploads_page/examples/FileUploadBasic.tsx?raw'
import ImageUploadGrid from '@/modules/component_center/pages/components/uploads_page/examples/ImageUploadGrid'
import imageUploadGridSource from '@/modules/component_center/pages/components/uploads_page/examples/ImageUploadGrid.tsx?raw'
import LimitsAndReadOnly from '@/modules/component_center/pages/components/uploads_page/examples/LimitsAndReadOnly'
import limitsAndReadOnlySource from '@/modules/component_center/pages/components/uploads_page/examples/LimitsAndReadOnly.tsx?raw'
import {
  AVATAR_UPLOAD_PROPS,
  FILE_ID_UPLOAD_PROPS,
  FILE_UPLOAD_PROPS,
  IMAGE_UPLOAD_PROPS,
  UPLOAD_FILE_ITEM_PROPS,
} from '@/modules/component_center/pages/components/uploads_page/props'
import Example from '@/modules/component_center/showcase/Example'
import PropsTable from '@/modules/component_center/showcase/PropsTable'
import ShowcasePage, { ShowcaseSection } from '@/modules/component_center/showcase/ShowcasePage'

const IMPORTS = `import FileUpload from '@/shared/components/upload/FileUpload'
import ImageUpload from '@/shared/components/upload/ImageUpload'
import AvatarUpload from '@/shared/components/upload/AvatarUpload'
import FileIdUpload from '@/shared/components/upload/FileIdUpload'
import type { UploadFileItem } from '@/shared/components/upload/useUploader'
import { fileUrl, uploadFile, type FileRecord } from '@/shared/api/files'
import { useUploadLimits } from '@/shared/hooks/useAppInfo'`

export default function UploadsPage() {
  return (
    <ShowcasePage
      title="上传"
      intro="文件选好就上传到文件中心，页面只保存结果。按要保存的值选组件：FileUpload / ImageUpload 管理一个文件列表，每项上传完成后带 url 和 response（文件中心记录，含 id）；FileIdUpload 的值就是文件中心 id，显示时用 fileUrl(id) 得到地址；AvatarUpload 的值是图片 URL。表单里用 FormFileUpload / FormImageUpload / FormAvatarUpload（见「表单」页）。从列表移除只是不再引用，不会删除文件中心里的文件。"
      imports={IMPORTS}
    >
      <ShowcaseSection title="示例">
        <Example title="附件上传" description="fileList 由页面管理，uploadApi 传 uploadFile；点击或拖入文件，每个文件显示进度，完成后拿到 id 和 url。" source={fileUploadBasicSource}>
          <FileUploadBasic />
        </Example>
        <Example title="图片上传" description="缩略图网格，上传中先显示本地预览；到达 limit 后隐藏添加按钮。只取上传成功的 url 保存。" source={imageUploadGridSource}>
          <ImageUploadGrid />
        </Example>
        <Example title="头像" description="值是图片 URL：上传后是 /api/admin/files/<id>，也可以手填 http(s):// 或 / 开头的地址，移除后是空字符串。" source={avatarPickerSource}>
          <AvatarPicker />
        </Example>
        <Example title="保存文件 id" description="单个时值是 id 或 null，multiple 时是 id 数组；只有 id 时（编辑表单）组件会查询文件名。类型和大小默认取服务器设置。" source={fileIdFieldsSource}>
          <FileIdFields />
        </Example>
        <Example title="限制与只读" description="limit、accept、maxSizeMB 在上传前拦下不符合的文件并提示；服务器还会再检查一次。disabled 只显示列表。" source={limitsAndReadOnlySource}>
          <LimitsAndReadOnly />
        </Example>
      </ShowcaseSection>
      <ShowcaseSection title="属性">
        <PropsTable title="FileUpload<R>" items={FILE_UPLOAD_PROPS} />
        <PropsTable title="ImageUpload<R>" items={IMAGE_UPLOAD_PROPS} />
        <PropsTable title="AvatarUpload" items={AVATAR_UPLOAD_PROPS} />
        <PropsTable title="FileIdUpload" items={FILE_ID_UPLOAD_PROPS} />
        <PropsTable title="UploadFileItem<R>" items={UPLOAD_FILE_ITEM_PROPS} />
      </ShowcaseSection>
    </ShowcasePage>
  )
}
