import { useState, type ComponentProps, type Ref } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTx } from '@/i18n'

/** Passed on to the text input, so the field works inside FormControl (label, description, error, focus on error) */
type InputProps = Pick<ComponentProps<'input'>, 'id' | 'onBlur' | 'aria-describedby' | 'aria-invalid' | 'aria-label' | 'aria-labelledby'> & {
  ref?: Ref<HTMLInputElement>
}

export interface TagInputProps extends InputProps {
  value?: readonly string[]
  onChange?: (value: string[]) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

/** Tag input: Enter / comma adds, Backspace removes the last one; value is an array of strings */
export default function TagInput({ value = [], onChange, placeholder = '输入后回车添加', disabled, className, onBlur, ...inputProps }: TagInputProps) {
  const tx = useTx()
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
        'border-input focus-within:border-ring focus-within:outline-1 focus-within:outline-ring flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-2 py-1 text-sm shadow-xs transition-[color,box-shadow]',
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
              aria-label={tx('移除 {{name}}', { name: tag })}
              onClick={() => onChange?.(value.filter((t) => t !== tag))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      ))}
      <input
        // Standalone (no id for a <label>, no aria-*), the placeholder names it: it's cleared once tags are added
        aria-label={inputProps.id || inputProps['aria-labelledby'] ? undefined : tx(placeholder)}
        {...inputProps}
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
        onBlur={(e) => {
          add()
          onBlur?.(e)
        }}
        placeholder={value.length ? '' : tx(placeholder)}
        className="placeholder:text-muted-foreground min-w-24 flex-1 bg-transparent py-0.5 focus-visible:outline-none"
      />
    </div>
  )
}
