import { useState } from 'react'
import { useWatch } from 'react-hook-form'
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** 步骤指示器：已完成（勾）/ 当前（描边）/ 未开始（灰），连接线按进度填充 */
function StepIndicator({ steps, current }) {
  return (
    <ol className="flex items-start">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={s.title} className={cn('flex min-w-0 items-start', i < steps.length - 1 && 'flex-1')}>
            <div className="flex min-w-0 items-start gap-2.5">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums transition-colors duration-200',
                  done && 'bg-primary text-primary-foreground',
                  active && 'bg-brand-soft text-primary ring-primary ring-1',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}
              >
                {done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 pt-0.5">
                <div className={cn('truncate text-[13px] leading-5 font-medium', !done && !active && 'text-muted-foreground')}>{s.title}</div>
                <div className="text-muted-foreground hidden truncate text-xs sm:block">{s.description}</div>
              </div>
            </div>
            {i < steps.length - 1 ? (
              <div className="bg-border relative mx-3 mt-3 h-px min-w-4 flex-1 overflow-hidden">
                <motion.div
                  className="bg-primary absolute inset-y-0 left-0"
                  initial={false}
                  animate={{ width: done ? '100%' : '0%' }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                />
              </div>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * 分步表单弹窗（react-hook-form）。所有步骤常驻挂载、仅隐藏非当前步，保证跨步取值与整表校验；
 * 「下一步」只校验当前步的 fields；最后一步才真正提交。onSubmit 抛错时弹窗保持打开。
 */
export default function StepFormDialog({
  open,
  onOpenChange,
  title,
  description,
  form,
  steps,
  step,
  onStepChange,
  onSubmit,
  submitText = '提交',
  renderStep,
}) {
  const [submitting, setSubmitting] = useState(false)
  const values = useWatch({ control: form.control })
  const last = steps.length - 1

  const next = async () => {
    const fields = steps[step]?.fields || []
    const ok = fields.length ? await form.trigger(fields) : true
    if (ok) onStepChange(Math.min(step + 1, last))
  }

  const submit = form.handleSubmit(
    async (vals) => {
      try {
        setSubmitting(true)
        await onSubmit?.(vals)
      } catch {
        /* 错误提示由调用方负责，弹窗保持打开 */
      } finally {
        setSubmitting(false)
      }
    },
    (errors) => {
      // 整表校验失败：跳回第一个有错误字段的步骤
      const index = steps.findIndex((s) => (s.fields || []).some((f) => errors[f]))
      if (index >= 0 && index !== step) onStepChange(index)
    },
  )

  // 非最后一步时，输入框内回车 = 下一步（多输入框表单没有隐式提交）
  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing || step >= last) return
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault()
      next()
    }
  }

  const handleFormSubmit = (e) => {
    e.preventDefault()
    if (step < last) next()
    else submit(e)
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !submitting && onOpenChange?.(nextOpen)}>
      <DialogContent className="gap-0 p-0 sm:max-w-[600px]">
        <Form {...form}>
          <form noValidate onSubmit={handleFormSubmit} onKeyDown={handleKeyDown} className="flex max-h-[85vh] flex-col">
            <DialogHeader className="px-6 pt-6 pb-4">
              <DialogTitle>{title}</DialogTitle>
              {description ? <DialogDescription>{description}</DialogDescription> : null}
            </DialogHeader>
            <div className="border-y px-6 py-4">
              <StepIndicator steps={steps} current={step} />
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-6 py-5">
                {steps.map((s, i) => (
                  <div
                    key={s.title}
                    className={cn(i === step ? 'animate-in fade-in-0 slide-in-from-right-2 duration-200' : 'hidden')}
                    aria-hidden={i !== step}
                  >
                    {renderStep(i, values)}
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="flex-row items-center border-t px-6 py-4 sm:justify-between">
              <span className="text-muted-foreground mr-auto text-xs tabular-nums">
                第 {step + 1} 步，共 {steps.length} 步
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                  取消
                </Button>
                {step > 0 ? (
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => onStepChange(step - 1)}>
                    上一步
                  </Button>
                ) : null}
                {step < last ? (
                  <Button key="next" type="button" onClick={next}>
                    下一步
                  </Button>
                ) : (
                  <Button key="submit" type="submit" disabled={submitting}>
                    {submitting ? <Spinner /> : null}
                    {submitText}
                  </Button>
                )}
              </div>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
