import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { toast } from '@/lib/toast'
import ConditionBuilder, { type ConditionField, type ConditionTree } from '@/shared/components/ConditionBuilder'
import { FormCustom, FormInput } from '@/shared/components/FormFields'

type TicketField = 'title' | 'priority' | 'assignee' | 'created_on' | 'reopened'

const FIELDS: ConditionField<TicketField>[] = [
  { key: 'title', label: '标题', type: 'text' },
  {
    key: 'priority',
    label: '优先级',
    type: 'select',
    options: [
      { label: '低', value: 'low' },
      { label: '中', value: 'medium' },
      { label: '高', value: 'high' },
    ],
  },
  { key: 'assignee', label: '负责人', type: 'text' },
  { key: 'created_on', label: '创建日期', type: 'date' },
  { key: 'reopened', label: '被重新打开', type: 'boolean' },
]

interface SavedQuery {
  name: string
  conditions: ConditionTree<TicketField>
}

/** A saved query as the API would return it: the conditions come back exactly as they were saved */
const SAVED: SavedQuery = {
  name: 'Open escalations',
  conditions: {
    logic: 'AND',
    items: [
      { field: 'priority', operator: 'eq', value: 'high' },
      { field: 'created_on', operator: 'between', value: ['2026-09-01', '2026-09-30'] },
    ],
    groups: [
      {
        logic: 'OR',
        items: [
          { field: 'assignee', operator: 'empty', value: null },
          { field: 'reopened', operator: 'eq', value: true },
        ],
      },
    ],
  },
}

export default function SavedQueryForm() {
  const { t } = useTranslation()
  // The value is plain JSON, so a saved one goes straight into defaultValues and back out on submit
  const form = useForm<SavedQuery>({ defaultValues: SAVED })

  const save = (values: SavedQuery) => {
    // In a real page: await updateSavedQuery(id, values)
    toast.success('已保存')
    form.reset(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(save)} noValidate className="space-y-4">
        <FormInput control={form.control} name="name" label="查询名称" rules={{ required: '请输入查询名称' }} className="max-w-sm" />
        <FormCustom
          control={form.control}
          name="conditions"
          label="筛选条件"
          rules={{ validate: (value) => value.items.length + value.groups.length > 0 || '至少添加一个条件' }}
          render={({ value, onChange }) => <ConditionBuilder fields={FIELDS} value={value} onChange={onChange} />}
        />
        <div className="flex gap-2">
          <Button type="submit">{t('保存')}</Button>
          <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!form.formState.isDirty}>
            {t('还原')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
