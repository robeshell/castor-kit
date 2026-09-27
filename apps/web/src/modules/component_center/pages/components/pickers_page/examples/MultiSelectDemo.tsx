import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MultiSelect, { type MultiSelectOption } from '@/shared/components/MultiSelect'

type Channel = 'email' | 'sms' | 'webhook' | 'in_app'

// Labels are Chinese source text, translated by MultiSelect (searching matches the label and the value)
const CHANNEL_OPTIONS: MultiSelectOption<Channel>[] = [
  { label: '邮件', value: 'email' },
  { label: '短信', value: 'sms' },
  { label: 'Webhook', value: 'webhook' },
  { label: '站内信', value: 'in_app' },
]

// Number values stay numbers: the value is a number[]
const MEMBER_OPTIONS: MultiSelectOption<number>[] = [
  { label: 'Mia Chen', value: 11 },
  { label: 'Leo Park', value: 12 },
  { label: 'Ava Rossi', value: 13 },
  { label: 'Noah Kim', value: 14 },
  { label: 'Zoe Martin', value: 15 },
]

export default function MultiSelectDemo() {
  const { t } = useTranslation()
  const [channels, setChannels] = useState<Channel[]>(['email'])
  const [members, setMembers] = useState<number[]>([11, 12, 13])

  return (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('通知渠道')}</p>
        <MultiSelect value={channels} onChange={setChannels} options={CHANNEL_OPTIONS} placeholder="选择渠道" />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(channels)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('成员')}</p>
        {/* maxShown: badges before the rest collapse into +N */}
        <MultiSelect value={members} onChange={setMembers} options={MEMBER_OPTIONS} placeholder="选择成员" maxShown={2} />
        <code className="text-muted-foreground block font-mono text-xs">{JSON.stringify(members)}</code>
      </div>
      <div className="space-y-1.5">
        <p className="text-[13px] font-medium">{t('禁用')}</p>
        <MultiSelect value={['sms']} options={CHANNEL_OPTIONS} disabled />
      </div>
    </div>
  )
}
