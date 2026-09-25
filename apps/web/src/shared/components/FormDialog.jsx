import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

const SIZES = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[720px]', xl: 'sm:max-w-[920px]' }

function useSubmit(form, onSubmit) {
  const [submitting, setSubmitting] = useState(false)
  const handle = form.handleSubmit(async (values) => {
    // 提交成功后调用方会关闭弹层：先让提交按钮失焦，避免 Radix 给仍持有焦点的内容加 aria-hidden 时告警
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    try {
      setSubmitting(true)
      await onSubmit?.(values)
    } catch (err) {
      // 调用方已 toast 并重新抛出，仅用于让弹层保持打开；这里吞掉以免产生 unhandled rejection。
      // 非接口错误（页面代码 bug）在开发环境仍打印出来，避免被静默吞掉
      if (import.meta.env.DEV && err instanceof Error && !err.isAxiosError) console.error(err)
    } finally {
      setSubmitting(false)
    }
  })
  return [submitting, handle]
}

/**
 * 表单弹窗（新建 / 编辑）。onSubmit(values) 返回 Promise；抛错时弹窗保持打开（调用方负责 toast）。
 *   <FormDialog open={open} onOpenChange={setOpen} title="新建用户" form={form} onSubmit={save}>
 *     <FormInput control={form.control} name="username" label="用户名" rules={{ required: '请输入用户名' }} />
 *   </FormDialog>
 */
export function FormDialog({ open, onOpenChange, title, description, form, onSubmit, submitText = '保存', size = 'md', children, footerExtra }) {
  const [submitting, handleSubmit] = useSubmit(form, onSubmit)
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange?.(next)}>
      <DialogContent className={cn('gap-0 p-0', SIZES[size] || SIZES.md)}>
        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="flex max-h-[85vh] flex-col">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-6 pb-2">{children}</div>
            </ScrollArea>
            <DialogFooter className="border-t px-6 py-4">
              {footerExtra ? <div className="mr-auto">{footerExtra}</div> : null}
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : null}
                {submitText}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** 表单侧边抽屉（字段多、需要保留列表上下文时用） */
export function FormSheet({ open, onOpenChange, title, description, form, onSubmit, submitText = '保存', width = 520, children }) {
  const [submitting, handleSubmit] = useSubmit(form, onSubmit)
  return (
    <Sheet open={open} onOpenChange={(next) => !submitting && onOpenChange?.(next)}>
      <SheetContent className="gap-0 p-0 sm:max-w-none" style={{ width: `min(${width}px, 100vw)` }}>
        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle>{title}</SheetTitle>
              {description ? <SheetDescription>{description}</SheetDescription> : null}
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-6 py-5">{children}</div>
            </ScrollArea>
            <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : null}
                {submitText}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

/** 只读详情抽屉 */
export function DetailSheet({ open, onOpenChange, title, description, width = 480, children, footer }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 sm:max-w-none" style={{ width: `min(${width}px, 100vw)` }}>
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-5">{children}</div>
        </ScrollArea>
        {footer ? <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  )
}

/** 详情键值列表 */
export function DescriptionList({ items = [], columns = 1, className }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 text-[13px]', columns === 2 && 'sm:grid-cols-2', className)}>
      {items
        .filter(Boolean)
        .map((item) => (
          <div key={item.label} className={cn('grid grid-cols-[96px_minmax(0,1fr)] gap-3', item.full && 'sm:col-span-2')}>
            <dt className="text-muted-foreground">{item.label}</dt>
            <dd className="min-w-0 break-words">{item.value === null || item.value === undefined || item.value === '' ? '-' : item.value}</dd>
          </div>
        ))}
    </dl>
  )
}
