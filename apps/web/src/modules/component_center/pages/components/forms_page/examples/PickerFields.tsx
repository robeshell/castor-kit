import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import type { MultiSelectOption } from '@/shared/components/MultiSelect'
import type { TreeSelectNode } from '@/shared/components/TreeSelect'
import { FormDate, FormDateTime, FormGrid, FormMultiSelect, FormTags, FormTreeSelect } from '@/shared/components/FormFields'

interface FormValues {
  /** FormDate: 'YYYY-MM-DD', '' when empty */
  start_date: string
  end_date: string
  /** FormDateTime: ISO 8601 with the browser's offset (the API stores UTC), '' when empty */
  publish_at: string
  /** FormTreeSelect: the picked node id, null when cleared */
  dept_id: number | null
  /** FormMultiSelect: the picked option values, types kept */
  reviewer_ids: number[]
  /** FormTags: an array of strings */
  tags: string[]
}

// Mock data; a real page loads these (departments as a tree, users as options)
const DEPARTMENTS: TreeSelectNode<number>[] = [
  {
    id: 1,
    name: 'Headquarters',
    code: 'HQ',
    children: [
      { id: 2, name: 'Engineering', code: 'ENG', children: [{ id: 4, name: 'Platform', code: 'ENG-PLT' }] },
      { id: 3, name: 'Marketing', code: 'MKT' },
    ],
  },
]

const REVIEWERS: MultiSelectOption<number>[] = [
  { label: 'Mia Chen', value: 11 },
  { label: 'Leo Park', value: 12 },
  { label: 'Ava Rossi', value: 13 },
  { label: 'Noah Kim', value: 14 },
]

const DEFAULTS: FormValues = { start_date: '', end_date: '', publish_at: '', dept_id: null, reviewer_ids: [], tags: [] }

export default function PickerFields() {
  const { t } = useTranslation()
  const form = useForm<FormValues>({ defaultValues: DEFAULTS })
  const [submitted, setSubmitted] = useState<FormValues | null>(null)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(setSubmitted)} noValidate className="space-y-4">
        <FormGrid>
          <FormDate control={form.control} name="start_date" label="开始日期" rules={{ required: '请选择开始日期' }} />
          {/* A date range is two FormDate fields; validate gets all values as its second argument */}
          <FormDate
            control={form.control}
            name="end_date"
            label="结束日期"
            rules={{
              validate: (end, values) => !end || !values.start_date || end >= values.start_date || '结束日期不能早于开始日期',
            }}
          />
          <FormDateTime control={form.control} name="publish_at" label="发布时间" />
          <FormTreeSelect control={form.control} name="dept_id" label="所属部门" tree={DEPARTMENTS} rules={{ required: '请选择部门' }} />
          <FormMultiSelect control={form.control} name="reviewer_ids" label="评审人" options={REVIEWERS} placeholder="选择评审人" />
          <FormTags control={form.control} name="tags" label="标签" />
        </FormGrid>
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
