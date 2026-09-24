import { useEffect, useRef, useState } from 'react'
import { Button, Modal, Progress, Select, Tag, Toast, Typography } from '@douyinfe/semi-ui'
import { downloadErrorRowsCsv } from '@/shared/utils/file'
import './import-export.css'

const DEFAULT_SUPPORTED_FORMATS = ['csv', 'xlsx']
const DEFAULT_TEMPLATE_FORMAT_OPTIONS = [
  { label: 'CSV (.csv)', value: 'csv' },
  { label: 'XLSX (.xlsx)', value: 'xlsx' },
]

export default function ImportCsvModal({
  visible,
  title,
  targetLabel,
  onCancel,
  onDownloadTemplate,
  onImport,
  onImported,
  errorExportFileName,
  supportedFormats = DEFAULT_SUPPORTED_FORMATS,
  templateFormatOptions = DEFAULT_TEMPLATE_FORMAT_OPTIONS,
  defaultTemplateFormat = 'xlsx',
}) {
  const [file, setFile] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [errorRows, setErrorRows] = useState([])
  const [templateFileType, setTemplateFileType] = useState(defaultTemplateFormat)
  const inputRef = useRef(null)
  const timerRef = useRef(null)

  const normalizedFormats = (Array.isArray(supportedFormats) ? supportedFormats : DEFAULT_SUPPORTED_FORMATS)
    .map((item) => String(item || '').toLowerCase().trim())
    .filter((item, index, arr) => item && arr.indexOf(item) === index)
  const effectiveFormats = normalizedFormats.length > 0 ? normalizedFormats : DEFAULT_SUPPORTED_FORMATS
  const acceptText = effectiveFormats.map((item) => `.${item}`).join(',')
  const formatHint = effectiveFormats.map((item) => item.toUpperCase()).join(' / ')

  useEffect(() => {
    if (!visible) {
      setFile(null)
      setDragging(false)
      setImporting(false)
      setProgress(0)
      setResult(null)
      setErrorRows([])
      const normalizedTemplateType = templateFormatOptions.find((item) => item.value === defaultTemplateFormat)?.value
        || templateFormatOptions[0]?.value
        || 'xlsx'
      setTemplateFileType(normalizedTemplateType)
    }
  }, [visible, defaultTemplateFormat, templateFormatOptions])

  useEffect(() => () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const startProgressSimulation = () => {
    stopTimer()
    setProgress(0)
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 92) {
          return prev
        }
        const step = Math.max(1, Math.round((92 - prev) * 0.2))
        return Math.min(92, prev + step)
      })
    }, 120)
  }

  const normalizeFile = (rawFile) => {
    if (!rawFile) {
      return null
    }
    const name = (rawFile.name || '').toLowerCase()
    const ext = name.includes('.') ? name.split('.').pop() : ''
    if (!effectiveFormats.includes(ext)) {
      Toast.error(`仅支持 ${formatHint} 文件`)
      return null
    }
    return rawFile
  }

  const selectFile = (rawFile) => {
    const csvFile = normalizeFile(rawFile)
    if (!csvFile) {
      return
    }
    setFile(csvFile)
    setResult(null)
    setProgress(0)
  }

  const handleChooseFile = (event) => {
    selectFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleConfirmImport = () => {
    if (!file) {
      Toast.warning('请先上传导入文件')
      return
    }
    if (typeof onImport !== 'function') {
      Toast.error('导入能力未配置')
      return
    }

    setImporting(true)
    setResult(null)
    setErrorRows([])
    startProgressSimulation()

    Promise.resolve(onImport(file))
      .then((res) => {
        stopTimer()
        setProgress(100)
        setResult(res || null)
        if (typeof onImported === 'function') {
          onImported(res || {})
        }
      })
      .catch((err) => {
        stopTimer()
        setProgress(0)
        setErrorRows(Array.isArray(err?.error_rows) ? err.error_rows : [])
        Toast.error(err?.error || '导入失败')
      })
      .finally(() => setImporting(false))
  }

  return (
    <Modal
      className="as-import-export-modal"
      title={title || '导入'}
      visible={visible}
      onOk={handleConfirmImport}
      okText="确认导入"
      cancelText="关闭"
      onCancel={() => {
        if (!importing) {
          onCancel?.()
        }
      }}
      okButtonProps={{ disabled: !file || importing, loading: importing }}
      cancelButtonProps={{ disabled: importing }}
      width="min(620px, calc(100vw - 24px))"
      maskClosable={!importing}
    >
      {targetLabel ? (
        <div style={{ marginBottom: 12 }}>
          <Typography.Text>当前对象：{targetLabel}</Typography.Text>
        </div>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <div className="as-ie-toolbar">
          <Select
            className="as-ie-select"
            value={templateFileType}
            optionList={templateFormatOptions}
            disabled={importing}
            onChange={(value) => setTemplateFileType(value)}
          />
          <Button
            onClick={() => onDownloadTemplate?.(templateFileType)}
            disabled={importing || typeof onDownloadTemplate !== 'function'}
          >
            下载导入模板
          </Button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={acceptText}
        style={{ display: 'none' }}
        onChange={handleChooseFile}
      />

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            inputRef.current?.click()
          }
        }}
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          selectFile(event.dataTransfer?.files?.[0])
        }}
        style={{
          border: `1px dashed ${dragging ? 'var(--semi-color-primary)' : 'var(--semi-color-border)'}`,
          background: dragging ? 'var(--semi-color-fill-0)' : 'transparent',
          borderRadius: 8,
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: 12,
          transition: 'all .15s ease',
        }}
      >
        <Typography.Text strong>{`拖拽 ${formatHint} 文件到此处上传`}</Typography.Text>
        <div style={{ marginTop: 8 }}>
          <Typography.Text type="tertiary">或点击这里选择文件</Typography.Text>
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        {file ? (
          <div className="as-ie-file-row">
            <Tag color="blue" className="as-ie-file-name">{file.name}</Tag>
            <Typography.Text type="tertiary">{(file.size / 1024).toFixed(1)} KB</Typography.Text>
            <Button size="small" onClick={() => inputRef.current?.click()} disabled={importing}>
              重新选择
            </Button>
            <Button
              size="small"
              type="tertiary"
              onClick={() => {
                if (importing) {
                  return
                }
                setFile(null)
                setResult(null)
                setErrorRows([])
                setProgress(0)
                stopTimer()
              }}
              disabled={importing}
            >
              清空
            </Button>
          </div>
        ) : (
          <Typography.Text type="tertiary">尚未选择文件</Typography.Text>
        )}
      </div>

      {(importing || progress > 0) && (
        <div style={{ marginBottom: 12 }}>
          <Progress percent={progress} showInfo strokeWidth={8} aria-label="导入进度" />
          <div style={{ marginTop: 6 }}>
            <Typography.Text type="tertiary">
              {importing ? '正在导入，请稍候...' : (progress >= 100 ? '导入完成' : '等待导入')}
            </Typography.Text>
          </div>
        </div>
      )}

      {result ? (
        <div
          style={{
            border: '1px solid var(--semi-color-success-light-default)',
            background: 'var(--semi-color-success-light-default)',
            borderRadius: 6,
            padding: '10px 12px',
          }}
        >
          <Typography.Text>
            导入结果：新增 {result.created || 0} 条，更新 {result.updated || 0} 条
          </Typography.Text>
        </div>
      ) : null}

      {!result && errorRows.length > 0 ? (
        <div
          style={{
            border: '1px solid var(--semi-color-danger-light-default)',
            background: 'var(--semi-color-danger-light-default)',
            borderRadius: 6,
            padding: '10px 12px',
          }}
        >
          <div style={{ marginBottom: 8 }}>
            <Typography.Text>导入失败：共 {errorRows.length} 行异常</Typography.Text>
          </div>
          <Button
            size="small"
            onClick={() => downloadErrorRowsCsv(errorRows, errorExportFileName || 'import_error_rows.csv')}
          >
            下载失败明细
          </Button>
        </div>
      ) : null}
    </Modal>
  )
}
