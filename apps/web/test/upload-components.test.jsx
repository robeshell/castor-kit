import { describe, expect, it, vi, beforeEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import AvatarUpload from '@/shared/components/upload/AvatarUpload'
import FileIdUpload from '@/shared/components/upload/FileIdUpload'
import FileUpload from '@/shared/components/upload/FileUpload'

vi.mock('@/shared/api/files', () => ({
  fileUrl: (id) => `/api/admin/files/${id}`,
  uploadFile: vi.fn(),
  getFileInfo: vi.fn(),
}))
const api = await import('@/shared/api/files')

const pdf = (name = 'a.pdf') => new File(['%PDF-1.4'], name, { type: 'application/pdf' })

beforeEach(() => {
  vi.mocked(api.uploadFile).mockReset()
  vi.mocked(api.getFileInfo).mockReset()
})

function Harness({ uploadApi }) {
  const [list, setList] = useState([])
  return <FileUpload fileList={list} onFileListChange={setList} uploadApi={uploadApi} accept=".pdf" />
}

describe('FileUpload', () => {
  it('拖拽文件上传：显示进度，完成后变为可点击的链接', async () => {
    let finish
    const uploadApi = vi.fn((file, { onProgress }) => {
      onProgress(40)
      return new Promise((resolve) => {
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

describe('FileIdUpload', () => {
  it('已有 id 通过 info 接口显示文件名；上传后以新 id 回调；移除后回调 null', async () => {
    vi.mocked(api.getFileInfo).mockResolvedValue({ id: 'old', original_name: '合同.pdf', size: 2048 })
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'new', url: '/api/admin/files/new' })
    const onChange = vi.fn()
    const { rerender } = render(<FileIdUpload value="old" onChange={onChange} />)
    expect(await screen.findByRole('link', { name: '合同.pdf' })).toHaveAttribute('href', '/api/admin/files/old')

    await userEvent.click(screen.getByRole('button', { name: '移除 合同.pdf' }))
    expect(onChange).toHaveBeenLastCalledWith(null)

    rerender(<FileIdUpload value={null} onChange={onChange} />)
    const input = document.querySelector('input[type="file"]')
    await userEvent.upload(input, pdf('new.pdf'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith('new'))
  })

  it('multiple：值为 id 数组', async () => {
    vi.mocked(api.getFileInfo).mockImplementation(async (id) => ({ id, original_name: `${id}.pdf` }))
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'c', url: '/api/admin/files/c' })
    const onChange = vi.fn()
    render(<FileIdUpload value={['a', 'b']} onChange={onChange} multiple />)
    await screen.findByRole('link', { name: 'b.pdf' })
    await userEvent.upload(document.querySelector('input[type="file"]'), pdf('c.pdf'))
    await waitFor(() => expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c']))
  })
})

describe('AvatarUpload', () => {
  it('上传图片后回调文件地址；非图片被拒绝；移除回调空字符串', async () => {
    vi.mocked(api.uploadFile).mockResolvedValue({ id: 'img', url: '/api/admin/files/img' })
    const onChange = vi.fn()
    const { rerender } = render(<AvatarUpload value="" onChange={onChange} name="alice" />)
    const input = document.querySelector('input[type="file"]')
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
