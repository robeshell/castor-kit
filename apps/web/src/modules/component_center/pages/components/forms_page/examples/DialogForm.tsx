import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Pencil, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/toast'
import { FormDialog } from '@/shared/components/FormDialog'
import { FormGrid, FormInput, FormSelect, FormTextarea, type SelectOption } from '@/shared/components/FormFields'
import StatusBadge from '@/shared/components/StatusBadge'

type ProjectStatus = 'active' | 'paused'

interface Project {
  id: number
  name: string
  code: string
  status: ProjectStatus
  summary: string
}

/** The editable fields */
type FormValues = Omit<Project, 'id'>

const STATUS_OPTIONS: SelectOption<ProjectStatus>[] = [
  { label: '进行中', value: 'active' },
  { label: '已暂停', value: 'paused' },
]

const emptyForm = (): FormValues => ({ name: '', code: '', status: 'active', summary: '' })

const PROJECTS: Project[] = [
  { id: 1, name: 'Website redesign', code: 'web-redesign', status: 'active', summary: 'New landing pages and a lighter checkout' },
  { id: 2, name: 'Billing service', code: 'billing', status: 'paused', summary: '' },
]

/** The error body the API rejects with when it names the field: `new ServiceError('编码已存在', 400, { field: 'code' })` */
interface FieldError {
  error: string
  field: string
}

function isFieldError(err: unknown): err is FieldError {
  return typeof err === 'object' && err !== null && 'error' in err && typeof err.error === 'string' && 'field' in err && typeof err.field === 'string'
}

/** Stands in for the create / update call in the page's api file; a taken code is rejected like the API would */
function saveProject(values: FormValues, others: Project[]): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const fieldError: FieldError = { error: '编码已存在', field: 'code' }
      if (others.some((p) => p.code === values.code)) reject(fieldError)
      else resolve()
    }, 600)
  })
}

export default function DialogForm() {
  const { t } = useTranslation()
  const [projects, setProjects] = useState(PROJECTS)
  const [editing, setEditing] = useState<Project | null>(null)
  const [open, setOpen] = useState(false)
  const form = useForm<FormValues>({ defaultValues: emptyForm() })

  // Reset the form every time the dialog opens, so it never shows the previous record
  const openCreate = () => {
    setEditing(null)
    form.reset(emptyForm())
    setOpen(true)
  }
  const openEdit = (project: Project) => {
    setEditing(project)
    form.reset({ name: project.name, code: project.code, status: project.status, summary: project.summary })
    setOpen(true)
  }

  // While the Promise is pending the buttons are disabled and the dialog can't be closed
  const submit = async (values: FormValues) => {
    try {
      await saveProject(values, projects.filter((p) => p.id !== editing?.id))
    } catch (err) {
      // A field error goes under its field; anything else is a toast. Rethrowing keeps the dialog open.
      if (isFieldError(err) && err.field === 'code') form.setError('code', { message: err.error }, { shouldFocus: true })
      else toast.apiError(err, '保存失败')
      throw err
    }
    if (editing) setProjects((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...values } : p)))
    else setProjects((prev) => [...prev, { id: Math.max(0, ...prev.map((p) => p.id)) + 1, ...values }])
    toast.success(editing ? '项目已更新' : '项目已创建')
    setOpen(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-[13px]">{t('试试用已有的编码 billing 保存')}</p>
        <Button size="sm" onClick={openCreate}>
          <Plus />
          {t('新建项目')}
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {projects.map((project) => (
          <li key={project.id} className="flex items-center gap-3 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium">{project.name}</span>
            <code className="text-muted-foreground hidden font-mono text-xs sm:inline">{project.code}</code>
            <StatusBadge tone={project.status === 'active' ? 'success' : 'neutral'} dot>
              {STATUS_OPTIONS.find((o) => o.value === project.status)?.label}
            </StatusBadge>
            <Button variant="ghost" size="icon-sm" aria-label={t('编辑 {{name}}', { name: project.name })} onClick={() => openEdit(project)}>
              <Pencil />
            </Button>
          </li>
        ))}
      </ul>
      {/* title / description / submitText are Chinese source text, translated by FormDialog */}
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title={editing ? '编辑项目' : '新建项目'}
        description="编码用于接口和文件路径，保存后仍可修改。"
        form={form}
        onSubmit={submit}
        submitText={editing ? '保存' : '创建'}
      >
        <FormGrid>
          <FormInput control={form.control} name="name" label="项目名称" rules={{ required: '请输入项目名称' }} />
          <FormInput
            control={form.control}
            name="code"
            label="项目编码"
            inputClassName="font-mono"
            rules={{ required: '请输入项目编码', pattern: { value: /^[a-z0-9-]+$/, message: '只能包含小写字母、数字和连字符' } }}
          />
        </FormGrid>
        <FormSelect control={form.control} name="status" label="状态" options={STATUS_OPTIONS} />
        <FormTextarea control={form.control} name="summary" label="简介" />
      </FormDialog>
    </div>
  )
}
