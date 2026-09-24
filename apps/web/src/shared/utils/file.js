export const downloadBlobFile = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const escapeCsvValue = (value) => {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

export const downloadErrorRowsCsv = (errorRows, fileName = 'import_error_rows.csv') => {
  const rows = Array.isArray(errorRows) ? errorRows : []
  if (!rows.length) {
    return
  }

  const sourceHeaders = []
  rows.forEach((item) => {
    const row = item?.row || {}
    Object.keys(row).forEach((key) => {
      if (!sourceHeaders.includes(key)) {
        sourceHeaders.push(key)
      }
    })
  })

  const headers = ['行号', '失败原因', ...sourceHeaders]
  const lines = [headers.map(escapeCsvValue).join(',')]

  rows.forEach((item) => {
    const row = item?.row || {}
    const line = [
      item?.line ?? '',
      item?.reason ?? '',
      ...sourceHeaders.map((key) => row[key] ?? ''),
    ]
    lines.push(line.map(escapeCsvValue).join(','))
  })

  const csv = '\ufeff' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlobFile(blob, fileName)
}
