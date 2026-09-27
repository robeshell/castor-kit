import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { FormInput, FormNumber, FormSelect, FormTextarea, type SelectOption } from '@/shared/components/FormFields'

type Priority = 'low' | 'medium' | 'high'

/** The form's values; each field component writes the type noted here */
interface FormValues {
  name: string
  code: string
  email: string
  /** FormNumber: a number, or null when the input is empty */
  budget: number | null
  /** FormSelect keeps the option's own type; clearable adds a "none" item that sets null */
  priority: Priority | null
  summary: string
}

// Option labels are Chinese source text, translated by the field
const PRIORITY_OPTIONS: SelectOption<Priority>[] = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
]

const DEFAULTS: FormValues = { name: '', code: '', email: '', budget: null, priority: null, summary: '' }

export default function BasicFields() {
  const { t } = useTranslation()
  const form = useForm<FormValues>({ defaultValues: DEFAULTS })
  const [submitted, setSubmitted] = useState<FormValues | null>(null)

  return (
    // Outside a FormDialog, wrap the fields in <Form {...form}> (the react-hook-form provider) and a <form>
    <Form {...form}>
      <form onSubmit={form.handleSubmit(setSubmitted)} noValidate className="max-w-xl space-y-4">
        {/* rules are react-hook-form's; their messages are Chinese source text, translated under the field */}
        <FormInput
          control={form.control}
          name="name"
          label="项目名称"
          placeholder="例如：官网改版"
          rules={{ required: '请输入项目名称', maxLength: { value: 40, message: '最多 40 个字符' } }}
        />
        <FormInput
          control={form.control}
          name="code"
          label="项目编码"
          placeholder="web-redesign"
          description="小写字母、数字和连字符，创建后不能修改。"
          inputClassName="font-mono"
          rules={{ required: '请输入项目编码', pattern: { value: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' } }}
        />
        <FormInput
          control={form.control}
          name="email"
          type="email"
          label="通知邮箱"
          autoComplete="email"
          rules={{ pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: '邮箱格式不正确' } }}
        />
        <FormNumber
          control={form.control}
          name="budget"
          label="预算"
          min={0}
          step={100}
          rules={{ required: '请输入预算', min: { value: 0, message: '预算不能为负数' } }}
        />
        <FormSelect control={form.control} name="priority" label="优先级" options={PRIORITY_OPTIONS} clearable />
        <FormTextarea control={form.control} name="summary" label="简介" rows={3} placeholder="项目的目标和范围" />
        <div className="flex gap-2">
          <Button type="submit">{t('提交')}</Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              form.reset(DEFAULTS)
              setSubmitted(null)
            }}
          >
            {t('重置')}
          </Button>
        </div>
        {submitted ? (
          <pre className="bg-muted overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(submitted, null, 2)}</pre>
        ) : null}
      </form>
    </Form>
  )
}
