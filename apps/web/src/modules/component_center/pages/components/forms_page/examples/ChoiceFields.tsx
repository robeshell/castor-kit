import { useForm, useWatch } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { FormCheckboxGroup, FormRadioGroup, FormSwitch, type SelectOption } from '@/shared/components/FormFields'

type Visibility = 'private' | 'team' | 'public'
type Channel = 'email' | 'sms' | 'webhook' | 'in_app'

interface FormValues {
  /** FormSwitch: a boolean */
  enabled: boolean
  notify_owner: boolean
  /** FormRadioGroup keeps the option's type: a string union here */
  visibility: Visibility
  /** ...and a number here */
  retention_days: number
  /** FormCheckboxGroup: an array of the checked option values */
  channels: Channel[]
}

const VISIBILITY_OPTIONS: SelectOption<Visibility>[] = [
  { label: '仅自己', value: 'private' },
  { label: '团队', value: 'team' },
  { label: '公开', value: 'public' },
]

const RETENTION_OPTIONS: SelectOption<number>[] = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
]

const CHANNEL_OPTIONS: SelectOption<Channel>[] = [
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: 'Webhook', value: 'webhook' },
  // A disabled option stays visible but can't be checked
  { label: '站内信', value: 'in_app', disabled: true },
]

export default function ChoiceFields() {
  const form = useForm<FormValues>({
    // No submit button here, so validate on every change instead of on submit
    mode: 'onChange',
    defaultValues: { enabled: true, notify_owner: false, visibility: 'team', retention_days: 30, channels: ['email'] },
  })
  // Live values, to show the types each field writes
  const values = useWatch({ control: form.control })

  return (
    <Form {...form}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          {/* Switches default to the inline layout: label and description on the left, the switch on the right */}
          <FormSwitch control={form.control} name="enabled" label="启用" description="停用后不再接收新的事件。" />
          <FormSwitch control={form.control} name="notify_owner" label="通知负责人" layout="vertical" />
          <FormRadioGroup control={form.control} name="visibility" label="可见范围" options={VISIBILITY_OPTIONS} />
          <FormRadioGroup control={form.control} name="retention_days" label="保留时长" options={RETENTION_OPTIONS} direction="vertical" />
          <FormCheckboxGroup
            control={form.control}
            name="channels"
            label="通知渠道"
            options={CHANNEL_OPTIONS}
            columns={2}
            // validate gets the typed value (Channel[]); return true or the message
            rules={{ validate: (channels) => channels.length > 0 || '至少选择一个渠道' }}
          />
        </div>
        <pre className="bg-muted self-start overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(values, null, 2)}</pre>
      </div>
    </Form>
  )
}
