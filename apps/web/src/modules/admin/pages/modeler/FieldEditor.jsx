import { ArrowDown, ArrowUp, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { emptyField, NO_REQUIRED_TYPES, TYPE_LABEL, TYPE_OPTIONS, UNIQUE_TYPES } from '@/modules/admin/pages/modeler/spec'

const NONE = '__none__'

/** Default value editor: fits the type (yes / no, one of the options, a date, or free text) */
function DefaultInput({ field, onChange }) {
  const { t } = useTranslation()
  const set = (value) => onChange(value === NONE ? '' : value)
  if (field.type === 'image' || field.type === 'file') return <span className="text-muted-foreground px-1 text-xs">—</span>
  if (field.type === 'bool' || field.type === 'enum') {
    const choices =
      field.type === 'bool'
        ? [
            { value: 'true', label: t('是') },
            { value: 'false', label: t('否') },
          ]
        : field.options.filter((o) => o.value.trim()).map((o) => ({ value: o.value, label: o.label || o.value }))
    return (
      <Select value={field.default === '' ? NONE : String(field.default)} onValueChange={set}>
        <SelectTrigger size="sm" className="h-8 w-full text-[13px]" aria-label={t('默认值')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{t('无')}</SelectItem>
          {choices.map((c) => (
            <SelectItem key={c.value} value={c.value}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }
  return (
    <Input
      className="h-8 text-[13px]"
      type={field.type === 'date' ? 'date' : 'text'}
      inputMode={field.type === 'int' || field.type === 'float' ? 'decimal' : undefined}
      placeholder={field.type === 'datetime' ? '2026-01-01 08:00' : t('无')}
      value={field.default}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('默认值')}
    />
  )
}

/** Choices of an enum field: value (stored, English) + name (shown) */
function OptionsEditor({ field, onChange }) {
  const { t } = useTranslation()
  const update = (index, patch) => onChange(field.options.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  return (
    <div className="space-y-1.5">
      {field.options.map((option, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <Input
            className="h-8 w-40 font-mono text-[13px]"
            placeholder={t('值，如 in_use')}
            value={option.value}
            onChange={(e) => update(index, { value: e.target.value })}
            aria-label={t('选项值')}
          />
          <Input
            className="h-8 w-40 text-[13px]"
            placeholder={t('名称，如 使用中')}
            value={option.label}
            onChange={(e) => update(index, { label: e.target.value })}
            aria-label={t('选项名称')}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t('删除选项')}
            onClick={() => onChange(field.options.filter((_, i) => i !== index))}
          >
            <X />
          </Button>
        </div>
      ))}
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => onChange([...field.options, { value: '', label: '' }])}>
        <Plus />
        {t('添加选项')}
      </Button>
    </div>
  )
}

/**
 * The field list: name, label, type, required, unique, default per row; enum fields get their options below the
 * row, dict fields a dictionary choice. Rows can be moved and removed.
 */
export default function FieldEditor({ fields, dicts, onChange }) {
  const { t } = useTranslation()
  const update = (index, patch) => onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  const move = (index, delta) => {
    const next = [...fields]
    const [row] = next.splice(index, 1)
    next.splice(index + delta, 0, row)
    onChange(next)
  }
  const changeType = (index, type) => {
    const field = fields[index]
    update(index, {
      type,
      default: '',
      required: NO_REQUIRED_TYPES.has(type) ? false : field.required,
      unique: UNIQUE_TYPES.has(type) ? field.unique : false,
      options: type === 'enum' && field.options.length === 0 ? [{ value: '', label: '' }] : field.options,
    })
  }

  return (
    <div className="space-y-2">
      <div className="text-muted-foreground hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_128px_44px_44px_minmax(0,0.9fr)_88px] gap-2 px-1 text-xs lg:grid">
        <span>{t('字段名')}</span>
        <span>{t('标签')}</span>
        <span>{t('类型')}</span>
        <span className="text-center">{t('必填')}</span>
        <span className="text-center">{t('唯一')}</span>
        <span>{t('默认值')}</span>
        <span />
      </div>
      {fields.map((field, index) => (
        <div key={field.key} className="bg-muted/30 space-y-2 rounded-lg border p-2">
          <div className="grid grid-cols-2 items-center gap-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_128px_44px_44px_minmax(0,0.9fr)_88px]">
            <Input
              className="h-8 font-mono text-[13px]"
              placeholder="device_code"
              value={field.name}
              onChange={(e) => update(index, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              aria-label={t('字段名')}
            />
            <Input
              className="h-8 text-[13px]"
              placeholder={t('中文标签')}
              value={field.label}
              onChange={(e) => update(index, { label: e.target.value })}
              aria-label={t('标签')}
            />
            <Select value={field.type} onValueChange={(type) => changeType(index, type)}>
              <SelectTrigger size="sm" className="h-8 w-full text-[13px]" aria-label={t('类型')}>
                {/* The closed select shows just the type name; the list also has what each type is for */}
                <SelectValue>{t(TYPE_LABEL[field.type] ?? field.type)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <span>{t(type.label)}</span>
                    <span className="text-muted-foreground ml-1 text-xs">{t(type.hint)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <label className="flex items-center justify-center gap-1.5 text-xs lg:gap-0">
              <Checkbox
                checked={field.required}
                disabled={NO_REQUIRED_TYPES.has(field.type)}
                onCheckedChange={(v) => update(index, { required: Boolean(v) })}
                aria-label={t('必填')}
              />
              <span className="lg:sr-only">{t('必填')}</span>
            </label>
            <label className="flex items-center justify-center gap-1.5 text-xs lg:gap-0">
              <Checkbox
                checked={field.unique}
                disabled={!UNIQUE_TYPES.has(field.type)}
                onCheckedChange={(v) => update(index, { unique: Boolean(v) })}
                aria-label={t('唯一')}
              />
              <span className="lg:sr-only">{t('唯一')}</span>
            </label>
            <DefaultInput field={field} onChange={(value) => update(index, { default: value })} />
            <div className="flex justify-end gap-0.5">
              <Button type="button" variant="ghost" size="icon-sm" disabled={index === 0} aria-label={t('上移')} onClick={() => move(index, -1)}>
                <ArrowUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={index === fields.length - 1}
                aria-label={t('下移')}
                onClick={() => move(index, 1)}
              >
                <ArrowDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="hover:text-danger"
                disabled={fields.length === 1}
                aria-label={t('删除字段')}
                onClick={() => onChange(fields.filter((_, i) => i !== index))}
              >
                <Trash2 />
              </Button>
            </div>
          </div>
          {field.type === 'enum' ? (
            <div className="pl-1">
              <OptionsEditor field={field} onChange={(options) => update(index, { options })} />
            </div>
          ) : null}
          {field.type === 'dict' ? (
            <div className="flex items-center gap-2 pl-1">
              <span className="text-muted-foreground text-xs">{t('字典')}</span>
              <Select value={field.dict || NONE} onValueChange={(dict) => update(index, { dict: dict === NONE ? '' : dict })}>
                <SelectTrigger size="sm" className={cn('h-8 w-64 text-[13px]', !field.dict && 'text-muted-foreground')} aria-label={t('字典')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t('选择字典')}</SelectItem>
                  {dicts.map((d) => (
                    <SelectItem key={d.code} value={d.code}>
                      {d.name}
                      <span className="text-muted-foreground ml-1 font-mono text-xs">{d.code}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {dicts.length === 0 ? <span className="text-muted-foreground text-xs">{t('还没有数据字典，先到「数据字典」添加')}</span> : null}
            </div>
          ) : null}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...fields, emptyField()])} disabled={fields.length >= 50}>
        <Plus />
        {t('添加字段')}
      </Button>
    </div>
  )
}
