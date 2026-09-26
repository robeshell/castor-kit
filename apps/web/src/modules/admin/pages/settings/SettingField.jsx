import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormCustom, FormInput, FormMultiSelect, FormSelect, FormSwitch, FormTags } from '@/shared/components/FormFields'
import { fieldName, FIELD_META } from '@/modules/admin/pages/settings/form'

/**
 * One setting, rendered by its type. Values pinned by an environment variable are read-only and say which variable;
 * a switch whose prerequisites are missing can't be turned on (the reason replaces the description).
 */
export default function SettingField({ item, control, canEdit, switchOn, roleOptions = [] }) {
  const { t } = useTranslation()
  if (!item) return null
  const meta = FIELD_META[item.key] || { label: item.key }
  const name = fieldName(item.key)
  const locked = item.source === 'env'
  const disabled = !canEdit || locked
  const description = locked ? t('由环境变量 {{name}} 指定，不能在这里修改', { name: item.env }) : meta.description
  const common = { control, name, label: meta.label, description }

  if (item.type === 'boolean') {
    const blocked = Boolean(item.unavailable_reason) && !switchOn
    return (
      <FormSwitch
        {...common}
        description={blocked ? item.unavailable_reason : description}
        disabled={disabled || blocked}
      />
    )
  }

  if (item.type === 'enum') {
    const options = (item.options || []).map((value) => ({ value, label: meta.options?.[value] ?? value }))
    return <FormSelect {...common} options={options} disabled={disabled} />
  }

  if (item.type === 'integer') {
    const mb = meta.input === 'mb'
    const min = mb ? 0.01 : item.min
    const max = mb ? Math.round((item.max / 1024 / 1024) * 100) / 100 : item.max
    const validate = (v) => {
      const ok = typeof v === 'number' && v >= min && v <= max && (mb || Number.isInteger(v))
      return ok || t('请输入 {{min}} – {{max}} 之间的数', { min, max })
    }
    return (
      <FormCustom
        {...common}
        rules={{ validate }}
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Input
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              type="number"
              inputMode="decimal"
              step={mb ? 0.1 : 1}
              min={min}
              max={max}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value === '' ? null : Number(e.target.value))}
              disabled={disabled}
              className="h-9 w-40 tabular-nums"
            />
            {meta.unit ? <span className="text-muted-foreground text-xs">{t(meta.unit)}</span> : null}
          </div>
        )}
      />
    )
  }

  if (item.type === 'string_list') {
    return meta.input === 'roles' ? (
      <FormMultiSelect {...common} options={roleOptions} placeholder={meta.placeholder} disabled={disabled} />
    ) : (
      <FormTags {...common} placeholder={meta.placeholder} disabled={disabled} />
    )
  }

  if (item.type === 'secret') {
    return (
      <FormCustom
        {...common}
        render={({ value, onChange }) => {
          const clearing = value === null
          const placeholder = clearing ? t('保存后清除') : item.has_value ? t('已设置，留空则不修改') : t('未设置')
          return (
            <div className="flex items-center gap-2">
              <Input
                type="password"
                autoComplete="new-password"
                value={value ?? ''}
                placeholder={placeholder}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled || clearing}
                className="h-9"
              />
              {item.has_value && !disabled ? (
                <Button type="button" variant="outline" size="sm" className="h-9 shrink-0" onClick={() => onChange(clearing ? '' : null)}>
                  {clearing ? t('撤销') : t('清除')}
                </Button>
              ) : null}
            </div>
          )
        }}
      />
    )
  }

  return <FormInput {...common} placeholder={meta.placeholder} disabled={disabled} />
}
