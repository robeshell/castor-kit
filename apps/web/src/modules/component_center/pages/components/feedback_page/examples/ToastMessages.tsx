import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { errorMessage, toast } from '@/lib/toast'

/** What request.ts rejects with when the API answers with an error: the response body */
interface ApiErrorBody {
  error: string
}

// Stand-in for a save call that takes a moment
const saveSettings = () => new Promise<{ saved: number }>((resolve) => setTimeout(() => resolve({ saved: 3 }), 1200))

export default function ToastMessages() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {/* A fixed Chinese string is translated by toast itself */}
        <Button variant="outline" size="sm" onClick={() => toast.success('已保存')}>
          success
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.error('保存失败')}>
          error
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.warning('库存不足，请调整数量')}>
          warning
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.info('新版本已发布，刷新后生效')}>
          info
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast('已复制到剪贴板')}>
          toast()
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Text with variables: build it with t() first; options such as description are not translated either */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.success(t('已导入 {{count}} 条', { count: 12 }), { description: t('重复的记录已跳过。') })}
        >
          {t('带变量和说明')}
        </Button>
        {/* apiError: the API's { error } message first (already in the user's language), else the fallback */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => toast.apiError({ error: '用户名已存在' } satisfies ApiErrorBody, '保存失败')}
        >
          apiError
        </Button>
        <Button variant="outline" size="sm" onClick={() => toast.apiError(null, '保存失败')}>
          {t('apiError（无消息）')}
        </Button>
        {/* toast.promise comes straight from sonner: its messages are not translated, so pass t() / errorMessage() */}
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            toast.promise(saveSettings(), {
              loading: t('正在保存…'),
              success: (res) => t('已保存 {{count}} 项设置', { count: res.saved }),
              error: (err: unknown) => errorMessage(err, '保存失败'),
            })
          }
        >
          promise
        </Button>
      </div>
    </div>
  )
}
