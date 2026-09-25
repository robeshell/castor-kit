import { useState } from 'react'
import { useWatch } from 'react-hook-form'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Spinner } from '@/components/ui/spinner'
import { useTx } from '@/i18n'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'

/** Step indicator: done (check) / current (outlined) / upcoming (muted); connectors fill with progress */
function StepIndicator({ steps, current }) {
  const tx = useTx()
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
                <div className={cn('truncate text-[13px] leading-5 font-medium', !done && !active && 'text-muted-foreground')}>{tx(s.title)}</div>
                <div className="text-muted-foreground hidden truncate text-xs sm:block">{tx(s.description)}</div>
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
 * Multi-step form dialog (react-hook-form). All steps stay mounted and only non-current steps are hidden,
 * so values carry across steps and the whole form validates together.
 * "Next" validates only the current step's fields; only the last step submits. The dialog stays open if onSubmit throws.
 * String title / description / submitText / step labels are translated here.
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
  const { t } = useTranslation()
  const tx = useTx()
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
        /* the caller shows the error; keep the dialog open */
      } finally {
        setSubmitting(false)
      }
    },
    (errors) => {
      // Whole-form validation failed: jump back to the first step with an invalid field
      const index = steps.findIndex((s) => (s.fields || []).some((f) => errors[f]))
      if (index >= 0 && index !== step) onStepChange(index)
    },
  )

  // Before the last step, Enter in an input means Next (multi-input forms have no implicit submit)
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
              <DialogTitle>{tx(title)}</DialogTitle>
              {description ? <DialogDescription>{tx(description)}</DialogDescription> : null}
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
                {t('第 {{current}} 步，共 {{total}} 步', { current: step + 1, total: steps.length })}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={submitting} onClick={() => onOpenChange?.(false)}>
                  {t('取消')}
                </Button>
                {step > 0 ? (
                  <Button type="button" variant="outline" disabled={submitting} onClick={() => onStepChange(step - 1)}>
                    {t('上一步')}
                  </Button>
                ) : null}
                {step < last ? (
                  <Button key="next" type="button" onClick={next}>
                    {t('下一步')}
                  </Button>
                ) : (
                  <Button key="submit" type="submit" disabled={submitting}>
                    {submitting ? <Spinner /> : null}
                    {tx(submitText)}
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
