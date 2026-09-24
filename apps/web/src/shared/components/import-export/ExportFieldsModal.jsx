import { useEffect, useState } from 'react'
import { Button, Checkbox, Modal, Radio, Space, Toast, Typography } from '@douyinfe/semi-ui'
import './import-export.css'

const DEFAULT_FILE_TYPE_OPTIONS = [
  { label: 'CSV (.csv)', value: 'csv' },
  { label: 'XLSX (.xlsx)', value: 'xlsx' },
]

export default function ExportFieldsModal({
  visible,
  title,
  ruleHint,
  fieldOptions = [],
  defaultFields = [],
  fileTypeOptions = DEFAULT_FILE_TYPE_OPTIONS,
  defaultFileType = 'xlsx',
  onCancel,
  onConfirm,
}) {
  const [fields, setFields] = useState([])
  const [fileType, setFileType] = useState(defaultFileType)

  useEffect(() => {
    if (!visible) {
      return
    }
    const defaults = Array.isArray(defaultFields) && defaultFields.length > 0
      ? defaultFields
      : fieldOptions.map((item) => item.value)
    setFields(defaults)
    const normalized = fileTypeOptions.find((item) => item.value === defaultFileType)?.value
      || fileTypeOptions[0]?.value
      || 'xlsx'
    setFileType(normalized)
  }, [visible, defaultFields, fieldOptions, fileTypeOptions, defaultFileType])

  const toggleField = (value, checked) => {
    setFields((prev) => {
      if (checked) {
        return prev.includes(value) ? prev : [...prev, value]
      }
      return prev.filter((item) => item !== value)
    })
  }

  const handleFileTypeChange = (input) => {
    const next = input?.target?.value ?? input
    if (typeof next === 'string' && next) {
      setFileType(next)
    }
  }

  return (
    <Modal
      className="as-import-export-modal"
      title={title || '导出设置'}
      visible={visible}
      onCancel={onCancel}
      okText="确认导出"
      width="min(560px, calc(100vw - 24px))"
      onOk={() => {
        if (!fields.length) {
          Toast.warning('请至少勾选一个导出字段')
          return
        }
        onConfirm?.({ fields, fileType })
      }}
    >
      {ruleHint ? (
        <div style={{ marginBottom: 10 }}>
          <Typography.Text type="tertiary">{ruleHint}</Typography.Text>
        </div>
      ) : null}
      <div style={{ marginBottom: 10 }}>
        <Typography.Text style={{ display: 'block', marginBottom: 6 }}>文件格式</Typography.Text>
        <Radio.Group
          direction="vertical"
          value={fileType}
          onChange={handleFileTypeChange}
        >
          {fileTypeOptions.map((item) => (
            <Radio value={item.value} key={item.value}>{item.label}</Radio>
          ))}
        </Radio.Group>
      </div>
      <div style={{ marginBottom: 10 }}>
        <div className="as-ie-toolbar">
          <Button size="small" onClick={() => setFields(fieldOptions.map((item) => item.value))}>
            全选字段
          </Button>
          <Button size="small" onClick={() => setFields([])}>
            清空字段
          </Button>
        </div>
      </div>
      <div
        className="as-ie-fields"
        style={{
          border: '1px solid var(--semi-color-border)',
          borderRadius: 6,
          padding: '10px 12px',
          maxHeight: 260,
          overflow: 'auto',
        }}
      >
        <Space vertical align="start" spacing={6}>
          {fieldOptions.map((item) => (
            <Checkbox
              key={item.value}
              checked={fields.includes(item.value)}
              onChange={(event) => {
                const checked = typeof event === 'boolean' ? event : Boolean(event?.target?.checked)
                toggleField(item.value, checked)
              }}
            >
              {item.label}
            </Checkbox>
          ))}
        </Space>
      </div>
    </Modal>
  )
}
