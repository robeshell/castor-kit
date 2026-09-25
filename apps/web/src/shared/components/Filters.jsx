import { RotateCcw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

const ALL = '__all__'

/**
 * List filter bar: filter controls on the left, search / reset on the right.
 *   <FilterBar onSearch={search} onReset={reset}>
 *     <SearchInput value={kw} onChange={setKw} onSubmit={search} placeholder="搜索用户名" />
 *     <FilterSelect value={status} onChange={setStatus} options={STATUS} placeholder="状态" />
 *   </FilterBar>
 * String props (placeholder, option labels) are translated here, so pages can pass the Chinese source text.
 */
export function FilterBar({ children, onSearch, onReset, extra, className }) {
  const tx = useTx()
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
      {onSearch ? (
        <Button size="sm" onClick={onSearch} className="h-8">
          <Search />
          {tx('查询')}
        </Button>
      ) : null}
      {onReset ? (
        <Button size="sm" variant="ghost" onClick={onReset} className="text-muted-foreground h-8">
          <RotateCcw />
          {tx('重置')}
        </Button>
      ) : null}
      {extra ? <div className="ml-auto flex flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/** Search box: Enter triggers onSubmit; has a clear button */
export function SearchInput({ value, onChange, onSubmit, placeholder = '搜索', className }) {
  const tx = useTx()
  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.()
        }}
        placeholder={tx(placeholder)}
        className="h-8 pr-7 pl-8 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          aria-label={tx('清空')}
          onClick={() => onChange?.('')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
        >
          <X className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Select filter: options = [{ label, value }]; '' / undefined means "all".
 * (Radix Select rejects empty-string values, so an internal sentinel is used.)
 */
export function FilterSelect({ value, onChange, options = [], placeholder = '全部', allLabel, className }) {
  const tx = useTx()
  const current = value === '' || value === undefined || value === null ? ALL : String(value)
  const allText = allLabel ? tx(allLabel) : placeholder === '全部' ? tx('全部') : tx('全部{{name}}', { name: tx(placeholder) })
  return (
    <Select value={current} onValueChange={(next) => onChange?.(next === ALL ? '' : next)}>
      <SelectTrigger size="sm" className={cn('h-8 w-36 text-[13px]', className)}>
        <SelectValue placeholder={tx(placeholder)} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allText}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={String(opt.value)} value={String(opt.value)}>
            {tx(opt.label)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
