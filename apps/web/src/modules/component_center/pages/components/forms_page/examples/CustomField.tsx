import { useForm, useWatch } from 'react-hook-form'
import { Form, FormControl } from '@/components/ui/form'
import { Slider } from '@/components/ui/slider'
import { FormCustom } from '@/shared/components/FormFields'
import SegmentedTabs, { type SegmentedTabItem } from '@/shared/components/SegmentedTabs'

type Cadence = 'daily' | 'weekly' | 'monthly'

interface FormValues {
  progress: number
  cadence: Cadence
}

const CADENCE_ITEMS: SegmentedTabItem<Cadence>[] = [
  { value: 'daily', label: '每天' },
  { value: 'weekly', label: '每周' },
  { value: 'monthly', label: '每月' },
]

export default function CustomField() {
  const form = useForm<FormValues>({ mode: 'onChange', defaultValues: { progress: 40, cadence: 'weekly' } })
  const values = useWatch({ control: form.control })

  return (
    <Form {...form}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="max-w-md space-y-5">
          {/* render gets the value typed from the field (number here); label, description, rules and the message work as in the other fields */}
          <FormCustom
            control={form.control}
            name="progress"
            label="完成度"
            description="按 5% 调整。"
            rules={{ validate: (progress) => progress > 0 || '完成度需大于 0' }}
            render={({ value, onChange }) => (
              <div className="flex items-center gap-3">
                {/* FormControl links the label and the error message to the control (id / aria-*) */}
                <FormControl>
                  <Slider value={[value]} onValueChange={(next) => onChange(next[0] ?? 0)} max={100} step={5} className="flex-1" />
                </FormControl>
                <span className="w-10 text-right text-sm tabular-nums">{value}%</span>
              </div>
            )}
          />
          <FormCustom
            control={form.control}
            name="cadence"
            label="汇报频率"
            render={({ value, onChange }) => <SegmentedTabs variant="pill" value={value} onChange={onChange} items={CADENCE_ITEMS} />}
          />
        </div>
        <pre className="bg-muted self-start overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(values, null, 2)}</pre>
      </div>
    </Form>
  )
}
