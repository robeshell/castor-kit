import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import { cn } from '@/lib/utils'

const SIZES = { sm: 'sm:max-w-[420px]', md: 'sm:max-w-[560px]', lg: 'sm:max-w-[720px]', xl: 'sm:max-w-[920px]' }

function useSubmit(form, onSubmit) {
  const [submitting, setSubmitting] = useState(false)
  const handle = form.handleSubmit(async (values) => {
    // The caller closes the dialog on success: blur the submit button first so Radix does not warn
    // about applying aria-hidden to content that still holds focus
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    try {
      setSubmitting(true)
      await onSubmit?.(values)
    } catch (err) {
      // The caller already showed a toast and rethrew only to keep the dialog open; swallow it here to
      // avoid an unhandled rejection. Non-API errors (page bugs) are still logged in development.
      if (import.meta.env.DEV && err instanceof Error && !err.isAxiosError) console.error(err)
    } finally {
      setSubmitting(false)
    }
  })
  return [submitting, handle]
}

/**
 * Form dialog (create / edit). onSubmit(values) returns a Promise; if it throws the dialog stays open
 * (the caller shows the toast). title / description / submitText are translated here.
 *   <FormDialog open={open} onOpenChange={setOpen} title="新建用户" form={form} onSubmit={save}>
 *     <FormInput control={form.control} name="username" label="用户名" rules={{ required: '请输入用户名' }} />
 *   </FormDialog>
 */
export function FormDialog({ open, onOpenChange, title, description, form, onSubmit, submitText = '保存', size = 'md', children, footerExtra }) {
  const tx = useTx()
  const [submitting, handleSubmit] = useSubmit(form, onSubmit)
  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange?.(next)}>
      <DialogContent className={cn('gap-0 p-0', SIZES[size] || SIZES.md)}>
        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="flex max-h-[85vh] flex-col">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>{tx(title)}</DialogTitle>
              {description ? <DialogDescription>{tx(description)}</DialogDescription> : null}
            </DialogHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-6 pb-2">{children}</div>
            </ScrollArea>
            <DialogFooter className="border-t px-6 py-4">
              {footerExtra ? <div className="mr-auto">{footerExtra}</div> : null}
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                {tx('取消')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : null}
                {tx(submitText)}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** Form side sheet (for long forms, or when the list should stay visible) */
export function FormSheet({ open, onOpenChange, title, description, form, onSubmit, submitText = '保存', width = 520, children }) {
  const tx = useTx()
  const [submitting, handleSubmit] = useSubmit(form, onSubmit)
  return (
    <Sheet open={open} onOpenChange={(next) => !submitting && onOpenChange?.(next)}>
      <SheetContent className="gap-0 p-0 sm:max-w-none" style={{ width: `min(${width}px, 100vw)` }}>
        <Form {...form}>
          <form onSubmit={handleSubmit} noValidate className="flex h-full flex-col">
            <SheetHeader className="border-b px-6 py-4">
              <SheetTitle>{tx(title)}</SheetTitle>
              {description ? <SheetDescription>{tx(description)}</SheetDescription> : null}
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-6 py-5">{children}</div>
            </ScrollArea>
            <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
              <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                {tx('取消')}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Spinner /> : null}
                {tx(submitText)}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

/** Read-only detail sheet */
export function DetailSheet({ open, onOpenChange, title, description, width = 480, children, footer }) {
  const tx = useTx()
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 p-0 sm:max-w-none" style={{ width: `min(${width}px, 100vw)` }}>
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{tx(title)}</SheetTitle>
          {description ? <SheetDescription>{tx(description)}</SheetDescription> : null}
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div className="px-6 py-5">{children}</div>
        </ScrollArea>
        {footer ? <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">{footer}</SheetFooter> : null}
      </SheetContent>
    </Sheet>
  )
}

/** Key-value list for detail views */
export function DescriptionList({ items = [], columns = 1, className }) {
  const tx = useTx()
  return (
    <dl className={cn('grid gap-x-6 gap-y-3 text-[13px]', columns === 2 && 'sm:grid-cols-2', className)}>
      {items
        .filter(Boolean)
        .map((item) => (
          <div key={item.label} className={cn('grid grid-cols-[96px_minmax(0,1fr)] gap-3', item.full && 'sm:col-span-2')}>
            <dt className="text-muted-foreground">{tx(item.label)}</dt>
            <dd className="min-w-0 break-words">{item.value === null || item.value === undefined || item.value === '' ? '-' : item.value}</dd>
          </div>
        ))}
    </dl>
  )
}
