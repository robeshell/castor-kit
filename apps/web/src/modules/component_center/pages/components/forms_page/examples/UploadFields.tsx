import { useForm, useWatch } from 'react-hook-form'
import { Form } from '@/components/ui/form'
import { FormAvatarUpload, FormFileUpload, FormImageUpload } from '@/shared/components/FormFields'

interface FormValues {
  /** FormAvatarUpload: the image URL ('/api/admin/files/<id>' after an upload), '' when removed */
  avatar: string
  /** FormImageUpload: a file-center id, or null */
  cover_id: string | null
  /** FormFileUpload with multiple: an array of file-center ids */
  attachment_ids: string[]
}

export default function UploadFields() {
  const form = useForm<FormValues>({ defaultValues: { avatar: '', cover_id: null, attachment_ids: [] } })
  const values = useWatch({ control: form.control })

  // Files upload to the file center as soon as they are picked; the form only stores the ids (or the avatar URL)
  return (
    <Form {...form}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="space-y-4">
          {/* displayName feeds the fallback letter while there is no image */}
          <FormAvatarUpload control={form.control} name="avatar" label="头像" displayName="Mia Chen" maxSizeMB={2} />
          <FormImageUpload control={form.control} name="cover_id" label="封面" maxSizeMB={5} />
          <FormFileUpload
            control={form.control}
            name="attachment_ids"
            label="附件"
            description="PDF 或 Word，每个不超过 10 MB。"
            multiple
            accept=".pdf,.doc,.docx"
            maxSizeMB={10}
          />
        </div>
        <pre className="bg-muted self-start overflow-x-auto rounded-md p-3 font-mono text-xs">{JSON.stringify(values, null, 2)}</pre>
      </div>
    </Form>
  )
}
