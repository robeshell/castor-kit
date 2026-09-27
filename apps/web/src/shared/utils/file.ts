export const downloadBlobFile = (blob: Blob, fileName: string): void => {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) {
    return ''
  }
  const text = String(value)
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

/** One failed row of an import: its line number, why it failed and the source row as read */
export interface ImportErrorRow {
  line?: number | string | null
  reason?: string | null
  row?: Record<string, unknown> | null
}

export const downloadErrorRowsCsv = (rows: readonly ImportErrorRow[], fileName = 'import_error_rows.csv'): void => {
  if (!rows.length) {
    return
  }

  const sourceHeaders: string[] = []
  rows.forEach((item) => {
    const row = item.row || {}
    Object.keys(row).forEach((key) => {
      if (!sourceHeaders.includes(key)) {
        sourceHeaders.push(key)
      }
    })
  })

  // i18n-ignore-next-line: file headers stay Chinese so exported files re-import in any UI language
  const headers = ['行号', '失败原因', ...sourceHeaders]
  const lines = [headers.map(escapeCsvValue).join(',')]

  rows.forEach((item) => {
    const row = item.row || {}
    const line = [
      item.line ?? '',
      item.reason ?? '',
      ...sourceHeaders.map((key) => row[key] ?? ''),
    ]
    lines.push(line.map(escapeCsvValue).join(','))
  })

  const csv = '\ufeff' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  downloadBlobFile(blob, fileName)
}
