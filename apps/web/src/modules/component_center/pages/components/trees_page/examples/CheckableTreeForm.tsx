import { useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { toast } from '@/lib/toast'
import CheckableTree from '@/shared/components/CheckableTree'
import { FormCustom, FormInput } from '@/shared/components/FormFields'
import type { TreeNode } from '@/shared/components/TreeView'

interface ScopeNode extends TreeNode {
  key: string
  label: string
}

// ASCII labels need no translation; with Chinese labels, translate them in renderText
const SCOPES: ScopeNode[] = [
  {
    key: 'read',
    label: 'read',
    children: [
      { key: 'read:users', label: 'read:users' },
      { key: 'read:orders', label: 'read:orders' },
    ],
  },
  {
    key: 'write',
    label: 'write',
    children: [
      { key: 'write:users', label: 'write:users' },
      { key: 'write:orders', label: 'write:orders' },
    ],
  },
]

interface FormValues {
  name: string
  scopes: string[]
}

export default function CheckableTreeForm() {
  const { t } = useTranslation()
  const form = useForm<FormValues>({ defaultValues: { name: 'ci-bot', scopes: ['read'] } })
  const values = useWatch({ control: form.control })

  const submit = (data: FormValues) => {
    toast.success(t('已保存「{{name}}」，共 {{count}} 个权限', { name: data.name, count: data.scopes.length }))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="max-w-sm space-y-4">
          <FormInput control={form.control} name="name" label="令牌名称" rules={{ required: '此项必填' }} />
          {/* The checked keys are the field value: CheckableTree is controlled by the form */}
          <FormCustom
            control={form.control}
            name="scopes"
            label="权限范围"
            // validate alone doesn't show the required mark: ask for it
            required
            rules={{ validate: (scopes) => scopes.length > 0 || '请至少勾选一项' }}
            render={({ value, onChange }) => <CheckableTree tree={SCOPES} value={value} onChange={onChange} className="rounded-lg border p-1.5" />}
          />
          <Button type="submit" size="sm">
            {t('保存')}
          </Button>
        </div>
        <pre className="bg-muted self-start overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(values, null, 2)}</pre>
      </form>
    </Form>
  )
}
