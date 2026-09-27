import { useForm } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { FormGrid, FormInput, FormSelect, FormTextarea, type SelectOption } from '@/shared/components/FormFields'

interface FormValues {
  company: string
  contact: string
  phone: string
  email: string
  street: string
  city: string
  postal_code: string
  country: string
  note: string
}

const COUNTRY_OPTIONS: SelectOption<string>[] = [
  { label: 'Germany', value: 'DE' },
  { label: 'Japan', value: 'JP' },
  { label: 'United States', value: 'US' },
]

export default function GridLayout() {
  const form = useForm<FormValues>({
    defaultValues: { company: '', contact: '', phone: '', email: '', street: '', city: '', postal_code: '', country: 'DE', note: '' },
  })

  return (
    <Form {...form}>
      <div className="space-y-6">
        {/* Two columns from the sm breakpoint up, one column on phones */}
        <FormGrid>
          <FormInput control={form.control} name="company" label="公司名称" rules={{ required: '请输入公司名称' }} />
          <FormInput control={form.control} name="contact" label="联系人" />
          <FormInput control={form.control} name="phone" label="电话" type="tel" />
          <FormInput control={form.control} name="email" label="邮箱" type="email" />
          {/* A field spans both columns with a col-span class */}
          <FormInput control={form.control} name="street" label="街道地址" className="sm:col-span-2" />
        </FormGrid>
        {/* Three columns for short fields that belong together */}
        <FormGrid columns={3}>
          <FormInput control={form.control} name="city" label="城市" />
          <FormInput control={form.control} name="postal_code" label="邮编" />
          <FormSelect control={form.control} name="country" label="国家" options={COUNTRY_OPTIONS} />
        </FormGrid>
        <FormGrid columns={1}>
          <FormTextarea control={form.control} name="note" label="备注" rows={2} />
        </FormGrid>
      </div>
    </Form>
  )
}
