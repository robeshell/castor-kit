import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { BookMarked, ChevronDown, Download, Plus, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { toast } from '@/lib/toast'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
  createDictItem,
  createDictType,
  deleteDictItem,
  deleteDictType,
  downloadDictItemsTemplate,
  exportDictItems,
  getDictItems,
  getDictTypes,
  importDictItems,
  updateDictItem,
  updateDictType,
} from '@/modules/admin/api/dicts'
import ConfirmAction from '@/shared/components/ConfirmAction'
import DataTable from '@/shared/components/DataTable'
import ImportDialog from '@/shared/components/data-transfer/ImportDialog'
import EmptyState from '@/shared/components/EmptyState'
import { FilterBar, SearchInput } from '@/shared/components/Filters'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormCustom, FormGrid, FormInput, FormNumber, FormSwitch, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StatusBadge from '@/shared/components/StatusBadge'
import { useCrudList } from '@/shared/hooks/useCrudList'
import { downloadBlobFile } from '@/shared/utils/file'
import { useTranslation } from 'react-i18next'

const FILE_TYPE_OPTIONS = [
  { label: 'CSV (.csv)', value: 'csv' },
  { label: 'XLSX (.xlsx)', value: 'xlsx' },
]
const normalizeFileType = (raw) => (['csv', 'xlsx'].includes(raw) ? raw : 'xlsx')
const TYPE_DEFAULTS = { name: '', code: '', sort_order: 0, is_active: true, description: '' }
const ITEM_DEFAULTS = { label: '', value: '', color: '', sort_order: 0, is_default: false, is_active: true, description: '' }
const HEX_RE = /^#[0-9a-f]{6}$/i

function ActiveBadge({ value }) {
  return (
    <StatusBadge tone={value ? 'success' : 'neutral'} dot>
      {value ? '启用' : '停用'}
    </StatusBadge>
  )
}

/** Dict item color: color picker + text input + preview (replaces the old input[type=color] + Input + Tag) */
function ColorField({ value, onChange }) {
  const { t } = useTranslation()
  const color = (value || '').trim()
  const pickerRef = useRef(null)
  // Keep the picker uncontrolled (browsers warn on an empty value); sync a valid color into it as the initial value
  useEffect(() => {
    if (pickerRef.current && HEX_RE.test(color)) pickerRef.current.value = color.toLowerCase()
  }, [color])
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative size-9 shrink-0 cursor-pointer overflow-hidden rounded-md border">
        <span className={cn('absolute inset-1 rounded-[4px]', !color && 'bg-muted')} style={color ? { backgroundColor: color } : undefined} />
        <input
          type="color"
          aria-label={t('选择颜色')}
          ref={pickerRef}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>
      <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={t('例如：#16a34a')} className="h-9 w-44 font-mono" />
      {color ? (
        <span className="inline-flex h-6 items-center rounded-md px-2 font-mono text-xs text-white" style={{ backgroundColor: color }}>
          {color}
        </span>
      ) : (
        <StatusBadge tone="neutral">{t('无')}</StatusBadge>
      )}
    </div>
  )
}

export default function Dicts() {
  const { t } = useTranslation()
  const [selectedType, setSelectedType] = useState(null)
  const typeList = useCrudList(
    (params) =>
      getDictTypes(params)
        .then((res) => {
          const list = Array.isArray(res?.items) ? res.items : []
          setSelectedType((prev) => {
            if (!prev?.id) return list[0] || null
            return list.find((item) => item.id === prev.id) || list[0] || null
          })
          return res
        })
        .catch(() => {
          toast.error('加载字典类型失败')
          return { items: [], total: 0 }
        }),
    { defaultPerPage: 20 },
  )
  const { fetchData: fetchTypes } = typeList
  const [typeSearch, setTypeSearch] = useState('')

  const [itemData, setItemData] = useState([])
  const [itemLoading, setItemLoading] = useState(false)
  const [itemSearch, setItemSearch] = useState('')

  const [typeFormOpen, setTypeFormOpen] = useState(false)
  const [typeEditing, setTypeEditing] = useState(null)
  const [itemFormOpen, setItemFormOpen] = useState(false)
  const [itemEditing, setItemEditing] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const typeForm = useForm({ defaultValues: TYPE_DEFAULTS })
  const itemForm = useForm({ defaultValues: ITEM_DEFAULTS })
  const typeDescLength = (useWatch({ control: typeForm.control, name: 'description' }) || '').length
  const itemDescLength = (useWatch({ control: itemForm.control, name: 'description' }) || '').length

  const typeId = selectedType?.id ?? null

  // Switching dict type clears the item search and list (derive state during render instead of setState in an effect)
  const [itemsTypeId, setItemsTypeId] = useState(null)
  if (itemsTypeId !== typeId) {
    setItemsTypeId(typeId)
    setItemSearch('')
    setItemData([])
    setItemLoading(Boolean(typeId))
  }

  useEffect(() => {
    fetchTypes()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, [])

  useEffect(() => {
    if (!typeId) return undefined
    let alive = true
    getDictItems(typeId, { search: '' })
      .then((res) => alive && setItemData(Array.isArray(res.items) ? res.items : []))
      .catch(() => alive && toast.error('加载字典项失败'))
      .finally(() => alive && setItemLoading(false))
    return () => {
      alive = false
    }
  }, [typeId])

  const fetchItems = (dictTypeId = typeId, search = itemSearch) => {
    if (!dictTypeId) {
      setItemData([])
      return
    }
    setItemLoading(true)
    getDictItems(dictTypeId, { search })
      .then((res) => setItemData(Array.isArray(res.items) ? res.items : []))
      .catch(() => toast.error('加载字典项失败'))
      .finally(() => setItemLoading(false))
  }

  const handleTypeSearch = () => typeList.handleSearch({ search: typeSearch })
  const handleTypeReset = () => {
    setTypeSearch('')
    typeList.handleReset()
  }
  const handleItemSearch = () => fetchItems(typeId, itemSearch)
  const handleItemReset = () => {
    setItemSearch('')
    fetchItems(typeId, '')
  }

  const openCreateType = () => {
    setTypeEditing(null)
    typeForm.reset(TYPE_DEFAULTS)
    setTypeFormOpen(true)
  }
  const openEditType = (record) => {
    setTypeEditing(record)
    typeForm.reset({
      name: record.name ?? '',
      code: record.code ?? '',
      sort_order: record.sort_order ?? 0,
      is_active: Boolean(record.is_active),
      description: record.description ?? '',
    })
    setTypeFormOpen(true)
  }

  const openCreateItem = () => {
    if (!typeId) {
      toast.warning('请先选择一个字典类型')
      return
    }
    setItemEditing(null)
    itemForm.reset(ITEM_DEFAULTS)
    setItemFormOpen(true)
  }
  const openEditItem = (record) => {
    setItemEditing(record)
    itemForm.reset({
      label: record.label ?? '',
      value: record.value ?? '',
      color: record.color || '',
      sort_order: record.sort_order ?? 0,
      is_default: Boolean(record.is_default),
      is_active: Boolean(record.is_active),
      description: record.description ?? '',
    })
    setItemFormOpen(true)
  }

  const submitType = async (values) => {
    try {
      if (typeEditing) await updateDictType(typeEditing.id, values)
      else await createDictType(values)
      toast.success(typeEditing ? '字典类型更新成功' : '字典类型创建成功')
      setTypeFormOpen(false)
      fetchTypes()
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const removeType = async (record) => {
    try {
      await deleteDictType(record.id)
      toast.success('删除成功')
      if (typeId === record.id) setSelectedType(null)
      fetchTypes()
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const submitItem = async (values) => {
    const payload = { ...values, color: (values.color || '').trim() || null }
    try {
      if (itemEditing) await updateDictItem(itemEditing.id, payload)
      else await createDictItem(typeId, payload)
      toast.success(itemEditing ? '字典项更新成功' : '字典项创建成功')
      setItemFormOpen(false)
      fetchItems(typeId, itemSearch)
    } catch (err) {
      toast.apiError(err, '保存失败')
      throw err
    }
  }

  const removeItem = async (record) => {
    try {
      await deleteDictItem(record.id)
      toast.success('删除成功')
      fetchItems(typeId, itemSearch)
    } catch (err) {
      toast.apiError(err, '删除失败')
      throw err
    }
  }

  const handleExportItems = (fileType) => {
    if (!typeId) {
      toast.warning('请先选择字典类型')
      return
    }
    const type = normalizeFileType(fileType)
    exportDictItems(typeId, type)
      .then((blob) => {
        downloadBlobFile(blob, `dict_${selectedType.code}_items.${type}`)
        toast.success('导出成功')
      })
      .catch((err) => toast.apiError(err, '导出失败'))
  }

  const openImport = () => {
    if (!typeId) {
      toast.warning('请先选择字典类型')
      return
    }
    setImportOpen(true)
  }

  const typeColumns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 60, className: 'text-muted-foreground tabular-nums' },
    { key: 'name', title: '名称', dataIndex: 'name', width: 130, className: 'font-medium' },
    {
      key: 'code',
      title: '编码',
      dataIndex: 'code',
      render: (v) => (v ? <StatusBadge tone="neutral" className="font-mono">{v}</StatusBadge> : null),
    },
    { key: 'is_active', title: '状态', dataIndex: 'is_active', width: 80, render: (v) => <ActiveBadge value={v} /> },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 56, align: 'right', className: 'tabular-nums' },
    { key: 'item_count', title: '字典项数', dataIndex: 'item_count', width: 76, align: 'right', className: 'tabular-nums' },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 112,
      render: (_, record) => (
        // Stop propagation: action buttons (including clicks inside the confirm popover) must not select the row
        <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditType(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该字典类型？" description="删除前需要先清空字典项" confirmText="删除" onConfirm={() => removeType(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  const itemColumns = [
    { key: 'id', title: 'ID', dataIndex: 'id', width: 60, className: 'text-muted-foreground tabular-nums' },
    { key: 'label', title: '标签', dataIndex: 'label', width: 120, className: 'font-medium' },
    {
      key: 'value',
      title: '值',
      dataIndex: 'value',
      render: (v) => (v ? <StatusBadge tone="neutral" className="font-mono">{v}</StatusBadge> : null),
    },
    {
      key: 'color',
      title: '颜色',
      dataIndex: 'color',
      width: 110,
      render: (v) =>
        v ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="ring-border size-3 shrink-0 rounded-[3px] ring-1" style={{ backgroundColor: v }} />
            <span className="text-muted-foreground font-mono text-xs">{v}</span>
          </span>
        ) : null,
    },
    {
      key: 'is_default',
      title: '默认',
      dataIndex: 'is_default',
      width: 60,
      render: (v) => (v ? <StatusBadge tone="brand">{t('是')}</StatusBadge> : <StatusBadge tone="neutral">{t('否')}</StatusBadge>),
    },
    { key: 'is_active', title: '状态', dataIndex: 'is_active', width: 80, render: (v) => <ActiveBadge value={v} /> },
    { key: 'sort_order', title: '排序', dataIndex: 'sort_order', width: 56, align: 'right', className: 'tabular-nums' },
    {
      key: 'updated_at',
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 160,
      className: 'text-muted-foreground tabular-nums whitespace-nowrap',
      render: (v) => formatDateTime(v),
    },
    {
      key: 'actions',
      title: '',
      align: 'right',
      width: 112,
      render: (_, record) => (
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openEditItem(record)}>
            {t('编辑')}
          </Button>
          <ConfirmAction title="确认删除该字典项？" confirmText="删除" onConfirm={() => removeItem(record)}>
            <Button variant="ghost" size="sm" className="text-danger hover:text-danger h-7 px-2">
              {t('删除')}
            </Button>
          </ConfirmAction>
        </div>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="数据字典"
        actions={
          <Button size="sm" variant="brand" onClick={openCreateType}>
            <Plus />
            {t('新建字典类型')}
          </Button>
        }
      />

      {/* Both tables are wide: side by side only on ultra-wide screens, stacked otherwise so the action column stays visible */}
      <div className="grid gap-4 min-[1760px]:grid-cols-2">
        <Panel title="字典类型" padded={false} className="min-w-0">
          <div className="px-5">
            <FilterBar onSearch={handleTypeSearch} onReset={handleTypeReset} className="mb-3">
              <SearchInput value={typeSearch} onChange={setTypeSearch} onSubmit={handleTypeSearch} placeholder="搜索名称/编码" className="sm:w-52" />
            </FilterBar>
          </div>
          <DataTable
            bordered={false}
            className="border-t"
            columns={typeColumns}
            data={typeList.data}
            loading={typeList.loading}
            dense
            minWidth={760}
            onRowClick={(row) => setSelectedType(row)}
            rowClassName={(row) => (row.id === typeId ? 'bg-brand-soft hover:bg-brand-soft' : undefined)}
            pagination={{ page: typeList.page, perPage: typeList.perPage, total: typeList.total, onChange: typeList.handlePageChange }}
            emptyTitle="暂无字典类型"
            emptyDescription={typeList.filters.search ? '换个关键词试试' : '点击右上角「新建字典类型」开始'}
          />
        </Panel>

        <Panel
          title="字典项"
          description={selectedType ? t('当前类型：{{name}} ({{code}})', { name: selectedType.name, code: selectedType.code }) : '请先选择字典类型'}
          padded={false}
          className="min-w-0"
          actions={
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!selectedType}>
                    <Download />
                    {t('导出')}
                    <ChevronDown className="text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {FILE_TYPE_OPTIONS.map((o) => (
                    <DropdownMenuItem key={o.value} onSelect={() => handleExportItems(o.value)}>
                      {o.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={openImport} disabled={!selectedType}>
                <Upload />
                {t('导入')}
              </Button>
              <Button variant="outline" size="sm" onClick={openCreateItem} disabled={!selectedType}>
                <Plus />
                {t('新建')}
              </Button>
            </>
          }
        >
          {selectedType ? (
            <>
              <div className="px-5">
                <FilterBar onSearch={handleItemSearch} onReset={handleItemReset} className="mb-3">
                  <SearchInput value={itemSearch} onChange={setItemSearch} onSubmit={handleItemSearch} placeholder="搜索标签/值" className="sm:w-52" />
                </FilterBar>
              </div>
              <DataTable
                bordered={false}
                className="border-t"
                columns={itemColumns}
                data={itemData}
                loading={itemLoading}
                dense
                minWidth={760}
                emptyTitle="该字典类型暂无字典项"
                emptyDescription="点击右上角「新建」添加字典项，或批量导入"
              />
            </>
          ) : (
            <EmptyState icon={BookMarked} title="请先选择字典类型" description="在字典类型列表中点击一行，这里会显示它的字典项" className="border-t" />
          )}
        </Panel>
      </div>

      <FormDialog
        open={typeFormOpen}
        onOpenChange={setTypeFormOpen}
        title={typeEditing ? '编辑字典类型' : '新建字典类型'}
        description={typeEditing ? t('正在编辑 {{name}}', { name: typeEditing.name }) : '字典编码建议使用小写下划线，例如 order_status'}
        form={typeForm}
        onSubmit={submitType}
        size="sm"
      >
        <FormInput control={typeForm.control} name="name" label="字典名称" rules={{ required: '请输入字典名称' }} />
        <FormInput
          control={typeForm.control}
          name="code"
          label="字典编码"
          placeholder="例如：order_status"
          rules={{ required: '请输入字典编码' }}
          inputClassName="font-mono"
        />
        <FormGrid>
          <FormNumber control={typeForm.control} name="sort_order" label="排序" min={0} />
          <FormSwitch control={typeForm.control} name="is_active" label="启用" className="self-end" />
        </FormGrid>
        <FormTextarea control={typeForm.control} name="description" label="描述" rows={3} inputClassName="min-h-16" description={`${typeDescLength} / 300`} />
      </FormDialog>

      <FormDialog
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        title={itemEditing ? '编辑字典项' : '新建字典项'}
        description={selectedType ? t('所属类型：{{name}} ({{code}})', { name: selectedType.name, code: selectedType.code }) : undefined}
        form={itemForm}
        onSubmit={submitItem}
        size="sm"
      >
        <FormGrid>
          <FormInput control={itemForm.control} name="label" label="字典标签" rules={{ required: '请输入字典标签' }} />
          <FormInput control={itemForm.control} name="value" label="字典值" rules={{ required: '请输入字典值' }} inputClassName="font-mono" />
        </FormGrid>
        <FormCustom control={itemForm.control} name="color" label="标签颜色" render={({ value, onChange }) => <ColorField value={value} onChange={onChange} />} />
        <FormNumber control={itemForm.control} name="sort_order" label="排序" min={0} />
        <FormGrid>
          <FormSwitch control={itemForm.control} name="is_default" label="默认项" />
          <FormSwitch control={itemForm.control} name="is_active" label="启用" />
        </FormGrid>
        <FormTextarea control={itemForm.control} name="description" label="描述" rows={3} inputClassName="min-h-16" description={`${itemDescLength} / 300`} />
      </FormDialog>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="导入字典项"
        targetLabel={selectedType ? t('数据字典 / {{name}} ({{code}})', { name: selectedType.name, code: selectedType.code }) : undefined}
        templateFormatOptions={FILE_TYPE_OPTIONS}
        onDownloadTemplate={(fileType) => {
          if (!selectedType) {
            toast.warning('请先选择字典类型')
            return
          }
          const type = normalizeFileType(fileType)
          downloadDictItemsTemplate(selectedType.id, type)
            .then((blob) => {
              downloadBlobFile(blob, `dict_${selectedType.code}_import_template.${type}`)
              toast.success('模板下载成功')
            })
            .catch((err) => toast.apiError(err, '模板下载失败'))
        }}
        onImport={(file) => importDictItems(selectedType.id, file)}
        onImported={(res) => {
          toast.success(t('导入成功：新增 {{created}} 条，更新 {{updated}} 条', { created: res?.created || 0, updated: res?.updated || 0 }))
          fetchItems(selectedType.id, itemSearch)
        }}
        errorExportFileName={`dict_${selectedType?.code || 'items'}_import_error_rows.csv`}
      />
    </div>
  )
}
