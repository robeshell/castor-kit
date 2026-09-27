/**
 * Page patterns → Step form: the reference implementation of a create wizard as a full page, on the shared demo API
 * (/api/admin/component-center/demo-records, see modules/component-center/demo-record in apps/api).
 *
 * Use it when creating a record takes several groups of fields that read better one at a time (onboarding, an order
 * with planning data …), and the user should review everything before it is saved. For a short form use a
 * FormDialog; for a wizard inside a list page the same steps fit in a dialog.
 *
 * What to copy:
 *   - one useForm<FormValues> for the whole wizard; every step stays mounted (only the current one is shown), so
 *     values and rules carry across steps and the final submit validates the whole form
 *   - "Next" validates only the current step's fields (`form.trigger(step.fields)`); a failed submit jumps back to the
 *     first step with an error; Enter in an input means Next before the last step
 *   - cross-field rules in the form (end date not before start date, as the API checks), API errors via toast.apiError
 *   - a review step (DescriptionList, each group with a link back to its step), then createItem and a success state
 *     with links to the new record's detail page and to the standard list
 *   - the page is gated by cc_patterns_add (without it the form is not shown)
 */
import { useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { useForm, useWatch, type Control } from 'react-hook-form'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { formatNumber } from '@/lib/format'
import { fadeUp } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { createItem, type DemoRecord as Row } from '@/modules/component_center/api/demo_record'
import {
  CATEGORY_OPTIONS,
  categoryLabel,
  enabledOption,
  STATUS_OPTIONS,
  statusOption,
  type DemoCategory as Category,
  type DemoStatus as Status,
} from '@/modules/component_center/pages/patterns/demo-record-options'
import EmptyState from '@/shared/components/EmptyState'
import { DescriptionList, type DescriptionItem } from '@/shared/components/FormDialog'
import { FormDate, FormGrid, FormInput, FormNumber, FormSelect, FormSwitch, FormTags, FormTextarea } from '@/shared/components/FormFields'
import PageHeader from '@/shared/components/PageHeader'
import Panel from '@/shared/components/Panel'
import StepIndicator, { type StepIndicatorStep } from '@/modules/component_center/pages/patterns/step_form_page/StepIndicator'

/** Menu paths (apps/api/scripts/seed-rbac.ts) of the pages the success state links to */
const STANDARD_LIST_PATH = '/component-center/patterns/standard-list'
const DETAIL_PATH = '/component-center/patterns/detail'

/** What the wizard holds and submits (the create body) */
interface FormValues {
  name: string
  code: string
  category: Category | null
  status: Status | null
  owner: string
  is_active: boolean
  tags: string[]
  description: string
  start_date: string
  end_date: string
  amount: number | string | null
  quantity: number | null
  progress: number | null
  priority: number | null
}

const EMPTY_VALUES: FormValues = {
  name: '',
  code: '',
  category: null,
  status: 'todo',
  owner: '',
  is_active: true,
  tags: [],
  description: '',
  start_date: '',
  end_date: '',
  amount: null,
  quantity: null,
  progress: 0,
  priority: 0,
}

interface Step extends StepIndicatorStep {
  /** Fields "Next" validates on this step */
  fields: readonly (keyof FormValues)[]
}

const STEPS: readonly Step[] = [
  { title: '基础信息', description: '名称、分类与负责人', fields: ['name', 'code', 'category', 'status', 'owner', 'is_active', 'tags', 'description'] },
  { title: '计划', description: '日期、金额与进度', fields: ['start_date', 'end_date', 'amount', 'quantity', 'progress', 'priority'] },
  { title: '确认', description: '核对后提交', fields: [] },
]
const LAST = STEPS.length - 1

// ─── Review ─────────────────────────────────────────────────────────────────────

interface ReviewProps {
  control: Control<FormValues>
  /** Go back to a step to change its fields */
  onEdit: (step: number) => void
}

function Review({ control, onEdit }: ReviewProps) {
  const { t, i18n } = useTranslation()
  const values = useWatch({ control })
  const category = categoryLabel(values.category)
  const status = statusOption(values.status)?.label
  const amount =
    values.amount === null || values.amount === undefined || values.amount === ''
      ? null
      : new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 2 }).format(Number(values.amount))

  const section = (step: number, items: DescriptionItem[]) => (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[13px] font-medium">{t(STEPS[step]?.title ?? '')}</h4>
        <Button type="button" variant="ghost" size="sm" className="text-primary h-7 px-2" onClick={() => onEdit(step)}>
          {t('修改')}
        </Button>
      </div>
      <DescriptionList columns={2} items={items} />
    </section>
  )

  return (
    <div className="space-y-6">
      {section(0, [
        { label: '名称', value: values.name },
        { label: '编码', value: values.code },
        { label: '分类', value: category ? t(category) : null },
        { label: '状态', value: status ? t(status) : null },
        { label: '负责人', value: values.owner },
        { label: '是否启用', value: t(enabledOption(Boolean(values.is_active)).label) },
        { label: '标签', value: values.tags?.join('、'), full: true },
        { label: '描述', value: values.description ? <p className="whitespace-pre-wrap">{values.description}</p> : null, full: true },
      ])}
      <div className="border-t" />
      {section(1, [
        { label: '开始日期', value: values.start_date },
        { label: '结束日期', value: values.end_date },
        { label: '金额', value: amount },
        { label: '数量', value: formatNumber(values.quantity, '') },
        { label: '进度', value: `${values.progress ?? 0}%` },
        { label: '优先级', value: values.priority },
      ])}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function StepFormPage() {
  const { t } = useTranslation()
  const { hasPermission } = useAuth()
  const canAdd = hasPermission('cc_patterns_add')

  const [step, setStep] = useState(0)
  const [created, setCreated] = useState<Row | null>(null)
  const form = useForm<FormValues>({ defaultValues: EMPTY_VALUES, mode: 'onTouched' })
  const submitting = form.formState.isSubmitting

  const next = async () => {
    const fields = STEPS[step]?.fields ?? []
    if (await form.trigger(fields)) setStep(Math.min(step + 1, LAST))
  }

  const submit = form.handleSubmit(
    async (values) => {
      try {
        setCreated(await createItem(values))
        toast.success('创建成功')
      } catch (err) {
        // e.g. a duplicate code (400): the message comes from the API; the wizard stays on the review step
        toast.apiError(err, '创建失败')
      }
    },
    (errors) => {
      // Whole-form validation failed: go back to the first step with an invalid field
      const index = STEPS.findIndex((s) => s.fields.some((f) => errors[f]))
      if (index >= 0) setStep(index)
    },
  )

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (step < LAST) next()
    else submit(e)
  }

  // Before the last step, Enter in an input means Next (controls that use Enter themselves, like the tag input, prevent it)
  const handleKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing || step >= LAST) return
    if (e.target instanceof HTMLInputElement) {
      e.preventDefault()
      next()
    }
  }

  const restart = () => {
    form.reset(EMPTY_VALUES)
    setStep(0)
    setCreated(null)
  }

  return (
    <div>
      <PageHeader title="分步表单" description="每一步只校验本步字段，提交前汇总确认" />

      <div className="mx-auto max-w-3xl">
        {!canAdd ? (
          <Panel>
            <EmptyState icon={Lock} title="没有新增记录的权限" description="请联系管理员授予「新增记录」权限" />
          </Panel>
        ) : created ? (
          <motion.div {...fadeUp}>
            <Panel>
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="bg-success-soft text-success mb-4 flex size-12 items-center justify-center rounded-full">
                  <CircleCheck className="size-6" />
                </span>
                <h2 className="text-base font-semibold">{t('创建成功')}</h2>
                <p className="text-muted-foreground mt-1 text-[13px]">{t('「{{name}}」（{{code}}）已创建', { name: created.name, code: created.code })}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  <Button asChild size="sm">
                    <Link to={`${DETAIL_PATH}?id=${created.id}`}>{t('查看详情')}</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={STANDARD_LIST_PATH}>{t('返回标准列表')}</Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={restart}>
                    {t('继续创建')}
                  </Button>
                </div>
              </div>
            </Panel>
          </motion.div>
        ) : (
          <Panel padded={false}>
            <div className="border-b px-6 py-4">
              <StepIndicator steps={STEPS} current={step} />
            </div>
            <Form {...form}>
              <form noValidate onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
                <div className="px-6 py-6">
                  {/* Every step stays mounted (hidden when not current) so its values and rules stay registered */}
                  <div className={cn(step === 0 ? 'animate-in fade-in-0 slide-in-from-right-2 space-y-4 duration-200' : 'hidden')}>
                    <FormGrid>
                      <FormInput control={form.control} name="name" label="名称" rules={{ required: '请输入名称' }} />
                      <FormInput control={form.control} name="code" label="编码" placeholder="例如：REC-001" rules={{ required: '请输入编码' }} />
                      <FormSelect control={form.control} name="category" label="分类" options={CATEGORY_OPTIONS} clearable />
                      <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} rules={{ required: '请选择状态' }} />
                      <FormInput control={form.control} name="owner" label="负责人" />
                      <FormSwitch control={form.control} name="is_active" label="是否启用" className="self-end" />
                    </FormGrid>
                    <FormTags control={form.control} name="tags" label="标签" placeholder="输入后回车添加" />
                    <FormTextarea
                      control={form.control}
                      name="description"
                      label="描述"
                      rows={3}
                      rules={{ maxLength: { value: 500, message: '描述最多 500 字' } }}
                    />
                  </div>
                  <div className={cn(step === 1 ? 'animate-in fade-in-0 slide-in-from-right-2 duration-200' : 'hidden')}>
                    <FormGrid>
                      <FormDate control={form.control} name="start_date" label="开始日期" />
                      <FormDate
                        control={form.control}
                        name="end_date"
                        label="结束日期"
                        rules={{ validate: (end, values) => !end || !values.start_date || end >= values.start_date || '开始日期不能晚于结束日期' }}
                      />
                      <FormNumber
                        control={form.control}
                        name="amount"
                        label="金额"
                        min={0}
                        step={0.01}
                        rules={{ min: { value: 0, message: '金额不能小于 0' } }}
                      />
                      <FormNumber
                        control={form.control}
                        name="quantity"
                        label="数量"
                        min={0}
                        step={1}
                        rules={{ min: { value: 0, message: '数量不能小于 0' } }}
                      />
                      <FormNumber
                        control={form.control}
                        name="progress"
                        label="进度"
                        min={0}
                        max={100}
                        step={1}
                        rules={{ min: { value: 0, message: '进度范围 0–100' }, max: { value: 100, message: '进度范围 0–100' } }}
                      />
                      <FormNumber control={form.control} name="priority" label="优先级" step={1} />
                    </FormGrid>
                  </div>
                  <div className={cn(step === LAST ? 'animate-in fade-in-0 slide-in-from-right-2 duration-200' : 'hidden')}>
                    <Review control={form.control} onEdit={setStep} />
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t px-6 py-4">
                  <span className="text-muted-foreground mr-auto text-xs tabular-nums">
                    {t('第 {{current}} 步，共 {{total}} 步', { current: step + 1, total: STEPS.length })}
                  </span>
                  {step > 0 ? (
                    <Button type="button" variant="outline" size="sm" disabled={submitting} onClick={() => setStep(step - 1)}>
                      {t('上一步')}
                    </Button>
                  ) : null}
                  {step < LAST ? (
                    <Button key="next" type="button" size="sm" onClick={next}>
                      {t('下一步')}
                    </Button>
                  ) : (
                    <Button key="submit" type="submit" size="sm" variant="brand" disabled={submitting}>
                      {submitting ? <Spinner /> : null}
                      {t('提交')}
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </Panel>
        )}
      </div>
    </div>
  )
}
