import { RotateCcw, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

const ALL = '__all__'

/**
 * 列表筛选栏：左侧放筛选控件，右侧查询 / 重置。
 *   <FilterBar onSearch={search} onReset={reset}>
 *     <SearchInput value={kw} onChange={setKw} onSubmit={search} placeholder="搜索用户名" />
 *     <FilterSelect value={status} onChange={setStatus} options={STATUS} placeholder="状态" />
 *   </FilterBar>
 */
export function FilterBar({ children, onSearch, onReset, extra, className }) {
  return (
    <div className={cn('mb-4 flex flex-wrap items-center gap-2', className)}>
      {children}
      {onSearch ? (
        <Button size="sm" onClick={onSearch} className="h-8">
          <Search />
          查询
        </Button>
      ) : null}
      {onReset ? (
        <Button size="sm" variant="ghost" onClick={onReset} className="text-muted-foreground h-8">
          <RotateCcw />
          重置
        </Button>
      ) : null}
      {extra ? <div className="ml-auto flex flex-wrap items-center gap-2">{extra}</div> : null}
    </div>
  )
}

/** 搜索框：回车触发 onSubmit；带清空按钮 */
export function SearchInput({ value, onChange, onSubmit, placeholder = '搜索', className }) {
  return (
    <div className={cn('relative w-full sm:w-60', className)}>
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
      <Input
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit?.()
        }}
        placeholder={placeholder}
        className="h-8 pr-7 pl-8 text-[13px]"
      />
      {value ? (
        <button
          type="button"
          aria-label="清空"
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
 * 下拉筛选：options = [{ label, value }]；value 为 '' / undefined 表示“全部”。
 * （Radix Select 不允许空字符串值，这里用内部哨兵值转换）
 */
export function FilterSelect({ value, onChange, options = [], placeholder = '全部', allLabel, className }) {
  const current = value === '' || value === undefined || value === null ? ALL : String(value)
  return (
    <Select value={current} onValueChange={(next) => onChange?.(next === ALL ? '' : next)}>
      <SelectTrigger size="sm" className={cn('h-8 w-36 text-[13px]', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel || `全部${placeholder === '全部' ? '' : placeholder}`}</SelectItem>
        {options.map((opt) => (
          <SelectItem key={String(opt.value)} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
