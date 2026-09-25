import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTx } from '@/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Row actions: common actions are laid out as text buttons, the rest go into a "…" menu.
 *   <RowActions actions={[
 *     { label: '编辑', onClick: () => edit(row), hidden: !canEdit },
 *     { label: '删除', danger: true, confirm: { title: '删除该用户？' }, onClick: () => remove(row) },
 *   ]} inline={2} />
 * Actions that need confirmation (confirm) should be laid out inline and wrapped in ConfirmAction; see the users page.
 */
export default function RowActions({ actions = [], inline = 2, children }) {
  const tx = useTx()
  const visible = actions.filter((a) => a && !a.hidden)
  const flat = visible.slice(0, inline)
  const more = visible.slice(inline)
  return (
    <div className="flex items-center justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
      {flat.map((a) =>
        a.render ? (
          <span key={a.label}>{a.render()}</span>
        ) : (
          <Button
            key={tx(a.label)}
            variant="ghost"
            size="sm"
            className={a.danger ? 'text-danger hover:text-danger h-7 px-2' : 'h-7 px-2'}
            disabled={a.disabled}
            onClick={a.onClick}
          >
            {tx(a.label)}
          </Button>
        ),
      )}
      {children}
      {more.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7" aria-label={tx('更多操作')}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-36">
            {more.map((a, i) => (
              <div key={a.label}>
                {a.danger && i > 0 ? <DropdownMenuSeparator /> : null}
                <DropdownMenuItem variant={a.danger ? 'destructive' : 'default'} disabled={a.disabled} onSelect={a.onClick}>
                  {a.icon ? <a.icon /> : null}
                  {tx(a.label)}
                </DropdownMenuItem>
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}
