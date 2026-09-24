import { useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** 标签输入：回车 / 逗号添加，退格删除最后一个；value 为字符串数组 */
export default function TagInput({ value = [], onChange, placeholder = '输入后回车添加', disabled, className }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const parts = draft
      .split(/[,，]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (parts.length) onChange?.(Array.from(new Set([...value, ...parts])))
    setDraft('')
  }
  return (
    <div
      className={cn(
        'border-input focus-within:border-ring focus-within:ring-ring/40 flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs transition-[color,box-shadow] focus-within:ring-[3px]',
        disabled && 'opacity-50',
        className,
      )}
    >
      {value.map((tag) => (
        <span key={tag} className="bg-secondary inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs">
          {tag}
          {!disabled ? (
            <button
              type="button"
              aria-label={`移除 ${tag}`}
              onClick={() => onChange?.(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      <input
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',' || e.key === '，') {
            e.preventDefault()
            add()
          } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange?.(value.slice(0, -1))
          }
        }}
        onBlur={add}
        placeholder={value.length ? '' : placeholder}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent py-0.5 outline-none"
      />
    </div>
  )
}
