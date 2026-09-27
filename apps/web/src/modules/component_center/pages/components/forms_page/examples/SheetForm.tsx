import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { FormSheet } from '@/shared/components/FormDialog'
import {
  FormDate,
  FormGrid,
  FormInput,
  FormRadioGroup,
  FormSelect,
  FormSwitch,
  FormTags,
  FormTextarea,
  type SelectOption,
} from '@/shared/components/FormFields'

type Category = 'bug' | 'feature' | 'question'
type Severity = 1 | 2 | 3

interface FormValues {
  title: string
  category: Category
  severity: Severity
  due_date: string
  labels: string[]
  steps: string
  expected: string
  notify_watchers: boolean
}

const CATEGORY_OPTIONS: SelectOption<Category>[] = [
  { label: '缺陷', value: 'bug' },
  { label: '需求', value: 'feature' },
  { label: '咨询', value: 'question' },
]

const SEVERITY_OPTIONS: SelectOption<Severity>[] = [
  { label: '低', value: 1 },
  { label: '中', value: 2 },
  { label: '高', value: 3 },
]

const emptyForm = (): FormValues => ({
  title: '',
  category: 'bug',
  severity: 2,
  due_date: '',
  labels: [],
  steps: '',
  expected: '',
  notify_watchers: true,
})

export default function SheetForm() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ defaultValues: emptyForm() })

  const submit = async (values: FormValues) => {
    // A real page awaits its API call here (see the dialog example for errors)
    await new Promise((resolve) => setTimeout(resolve, 600))
    toast.success(t('已创建工单：{{title}}', { title: values.title }))
    setOpen(false)
  }

  return (
    <>
      <Button
        size="sm"
        onClick={() => {
          form.reset(emptyForm())
          setOpen(true)
        }}
      >
        <Plus />
        {t('新建工单')}
      </Button>
      {/* A sheet for long forms, or when the list behind should stay in view; width is capped at the viewport */}
      <FormSheet open={open} onOpenChange={setOpen} title="新建工单" description="填写复现步骤，方便尽快处理。" form={form} onSubmit={submit} submitText="创建" width={560}>
        <FormInput control={form.control} name="title" label="标题" rules={{ required: '请输入标题' }} />
        <FormGrid>
          <FormSelect control={form.control} name="category" label="类型" options={CATEGORY_OPTIONS} />
          <FormDate control={form.control} name="due_date" label="截止日期" />
        </FormGrid>
        <FormRadioGroup control={form.control} name="severity" label="严重程度" options={SEVERITY_OPTIONS} />
        <FormTags control={form.control} name="labels" label="标签" />
        <FormTextarea control={form.control} name="steps" label="复现步骤" rows={5} rules={{ required: '请填写复现步骤' }} />
        <FormTextarea control={form.control} name="expected" label="期望结果" />
        <FormSwitch control={form.control} name="notify_watchers" label="通知关注人" description="创建后给关注这个模块的人发通知。" />
      </FormSheet>
    </>
  )
}
