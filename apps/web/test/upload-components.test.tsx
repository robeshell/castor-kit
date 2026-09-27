import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import AvatarUpload from '@/shared/components/upload/AvatarUpload'
import FileIdUpload from '@/shared/components/upload/FileIdUpload'
import FileUpload from '@/shared/components/upload/FileUpload'
import ImageUpload from '@/shared/components/upload/ImageUpload'
import i18n from '@/i18n'
import type { FileInfo } from '@/shared/api/files'
import type { UploadApi, UploadFileItem } from '@/shared/components/upload/useUploader'

vi.mock('@/shared/api/files', () => ({
  fileUrl: (id: string) => `/api/admin/files/${id}`,
  uploadFile: vi.fn(),
  getFileInfo: vi.fn(),
}))
const api = await import('@/shared/api/files')

const pdf = (name = 'a.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' })

/** A file-center record: the fields a test doesn't care about get placeholder values */
const fileInfo = (fields: Pick<FileInfo, 'id'> & Partial<FileInfo>): FileInfo => ({
  original_name: '',
  mime_type: 'application/pdf',
  size: 0,
  sha256: '',
  storage: 'local',
  uploader_id: null,
  uploader_name: null,
  ref_count: 0,
  url: `/api/admin/files/${fields.id}`,
  created_at: '2026-01-01T00:00:00Z',
  references: [],
  ...fields,
})

/** The upload component's hidden file input */
function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')
  if (!input) throw new Error('no file input rendered')
  return input
}

beforeEach(() => {
  vi.mocked(api.uploadFile).mockReset()
  vi.mocked(api.getFileInfo).mockReset()
})

function Harness({ uploadApi }: { uploadApi: UploadApi }) {
  const [list, setList] = useState<UploadFileItem[]>([])
  return <FileUpload fileList={list} onFileListChange={setList} uploadApi={uploadApi} accept=".pdf" />
}

describe('FileUpload', () => {
  it('拖拽文件上传：显示进度，完成后变为可点击的链接', async () => {
    let finish = () => {}
    const uploadApi = vi.fn<UploadApi>((_file, { onProgress }) => {
      onProgress(40)
      return new Promise<{ url: string; id: string }>((resolve) => {
        finish = () => resolve({ url: '/api/admin/files/x', id: 'x' })
      })
    })
    render(<Harness uploadApi={uploadApi} />)
    fireEvent.drop(screen.getByRole('button', { name: /拖拽/ }), { dataTransfer: { files: [pdf()] } })
    await waitFor(() => expect(screen.getByRole('progressbar', { name: '上传进度' })).toBeInTheDocument())
    expect(uploadApi).toHaveBeenCalledTimes(1)
    await act(async () => finish())
    await waitFor(() => expect(screen.getByRole('link', { name: 'a.pdf' })).toHaveAttribute('href', '/api/admin/files/x'))
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
})

describe('ImageUpload', () => {
  afterEach(async () => {
    await act(() => i18n.changeLanguage('zh-CN'))
  })

  it('promptText 与 FileUpload 一样按当前语言翻译', async () => {
    i18n.addResourceBundle('en-US', 'translation', { 图片提示文字: 'Image hint' }, true, true)
    await i18n.changeLanguage('en-US')
    render(<ImageUpload promptText="图片提示文字" />)
    expect(screen.getByText('Image hint')).toBeInTheDocument()
  })
})

describe('FileIdUpload', () => {
  it('已有 id 通过 info 接口显示文件名；上传后以新 id 回调；移除后回调 null', async () => {
    vi.mocked(api.getFileInfo).mockResolvedValue(fileInfo({ id: 'old', original_name: '合同.pdf', size: 2048 }))
    vi.mocked(api.uploadFile).mockResolvedValue(fileInfo({ id: 'new', url: '/api/admin/files/new' }))
    const onChange = vi.fn()
    const { rerender } = render(<FileIdUpload value="old" onChange={onChange} />)
    expect(await screen.findByRole('link', { name: '合同.pdf' })).toHaveAttribute('href', '/api/admin/files/old')

    await userEvent.click(screen.getByRole('button', { name: '移除 合同.pdf' }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    rerender(<FileIdUpload value={null} onChange={onChange} />)
    await userEvent.upload(fileInput(), pdf('new.pdf'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('new'))
  })

  it('multiple：值为 id 数组', async () => {
    vi.mocked(api.getFileInfo).mockImplementation(async (id) => fileInfo({ id, original_name: `${id}.pdf` }))
    vi.mocked(api.uploadFile).mockResolvedValue(fileInfo({ id: 'c', url: '/api/admin/files/c' }))
    const onChange = vi.fn()
    render(<FileIdUpload value={['a', 'b']} onChange={onChange} multiple />)
    await screen.findByRole('link', { name: 'b.pdf' })
    await userEvent.upload(fileInput(), pdf('c.pdf'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c']))
  })
})

describe('AvatarUpload', () => {
  it('上传图片后回调文件地址；非图片被拒绝；移除回调空字符串', async () => {
    vi.mocked(api.uploadFile).mockResolvedValue(fileInfo({ id: 'img', url: '/api/admin/files/img' }))
    const onChange = vi.fn()
    const { rerender } = render(<AvatarUpload value="" onChange={onChange} name="alice" />)
    const input = fileInput()
    await userEvent.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('/api/admin/files/img'))

    fireEvent.change(input, { target: { files: [pdf()] } })
    expect(api.uploadFile).toHaveBeenCalledTimes(1)

    rerender(<AvatarUpload value="/api/admin/files/img" onChange={onChange} name="alice" />)
    await userEvent.click(screen.getByRole('button', { name: '移除' }))
    expect(onChange).toHaveBeenLastCalledWith('')
  })
})

describe('AvatarUpload：填写图片地址', () => {
  it('格式不对时提示且不能使用；合法地址回车后回调', async () => {
    const onChange = vi.fn()
    render(<AvatarUpload value="" onChange={onChange} name="alice" />)
    await userEvent.click(screen.getByRole('button', { name: '填写图片地址' }))
    const input = screen.getByRole('textbox', { name: '图片地址' })
    await userEvent.type(input, 'ftp://x/y.png')
    expect(screen.getByText('头像地址需以 http(s):// 或 / 开头')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '使用' })).toBeDisabled()

    await userEvent.clear(input)
    await userEvent.type(input, 'https://example.com/me.png{Enter}')
    expect(onChange).toHaveBeenLastCalledWith('https://example.com/me.png')
    expect(screen.queryByRole('textbox', { name: '图片地址' })).not.toBeInTheDocument()
  })
})
