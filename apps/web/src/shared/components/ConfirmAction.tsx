import { useTx } from '@/i18n'
import { useState, type MouseEvent, type ReactNode } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Spinner } from '@/components/ui/spinner'

/**
 * Confirmation for dangerous actions. onConfirm may return a Promise; meanwhile the button shows loading and the dialog stays open.
 *   <ConfirmAction title="删除该用户？" description="删除后不可恢复。" onConfirm={() => remove(id)}>
 *     <Button variant="ghost" size="sm">{t('删除')}</Button>
 *   </ConfirmAction>
 */
export interface ConfirmActionProps {
  /** Chinese source text (translated here) or a node */
  title?: ReactNode
  description?: ReactNode
  confirmText?: ReactNode
  cancelText?: ReactNode
  /** Red confirm button (default true) */
  destructive?: boolean
  /** May return a Promise: the dialog stays open while it runs and when it rejects */
  onConfirm?: () => void | Promise<unknown>
  /** The trigger (a single element, e.g. a Button) */
  children?: ReactNode
  /** Render only the trigger, without the confirmation */
  disabled?: boolean
}

export default function ConfirmAction({
  title = '确认执行该操作？',
  description,
  confirmText = '确认',
  cancelText = '取消',
  destructive = true,
  onConfirm,
  children,
  disabled,
}: ConfirmActionProps) {
  const tx = useTx()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    try {
      setLoading(true)
      await onConfirm?.()
      setOpen(false)
    } catch {
      /* Errors are handled by the caller; the dialog stays open */
    } finally {
      setLoading(false)
    }
  }

  if (disabled) return children
  return (
    <AlertDialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent className="sm:max-w-[420px]">
        <AlertDialogHeader>
          <AlertDialogTitle>{tx(title)}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{tx(description)}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{tx(cancelText)}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} variant={destructive ? 'destructive' : 'default'}>
            {loading ? <Spinner /> : null}
            {tx(confirmText)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
