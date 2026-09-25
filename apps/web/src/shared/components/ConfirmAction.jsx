import { useState } from 'react'
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
 * 危险操作二次确认。onConfirm 可返回 Promise，期间按钮 loading、弹窗不关闭。
 *   <ConfirmAction title="删除该用户？" description="删除后不可恢复。" onConfirm={() => remove(id)}>
 *     <Button variant="ghost" size="sm">删除</Button>
 *   </ConfirmAction>
 */
export default function ConfirmAction({
  title = '确认执行该操作？',
  description,
  confirmText = '确认',
  cancelText = '取消',
  destructive = true,
  onConfirm,
  children,
  disabled,
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async (event) => {
    event.preventDefault()
    try {
      setLoading(true)
      await onConfirm?.()
      setOpen(false)
    } catch {
      /* 错误提示由调用方处理，弹窗保持打开 */
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
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} disabled={loading} variant={destructive ? 'destructive' : 'default'}>
            {loading ? <Spinner /> : null}
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
