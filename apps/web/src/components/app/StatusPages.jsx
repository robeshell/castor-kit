import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useTranslation } from 'react-i18next'

function Shell({ icon: Icon, code, title, description, children }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      {code ? (
        <div className="text-brand-gradient text-7xl font-semibold tracking-tighter tabular-nums">{code}</div>
      ) : (
        <div className="bg-muted text-muted-foreground mb-2 flex size-12 items-center justify-center rounded-xl">
          <Icon className="size-5" />
        </div>
      )}
      <h2 className="mt-3 text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">{description}</p>
      {children ? <div className="mt-6 flex gap-2">{children}</div> : null}
    </div>
  )
}

export function ErrorPage({ code, title, description }) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  return (
    <Shell code={code} title={title} description={description}>
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft />
        {t('返回上一页')}
      </Button>
      <Button onClick={() => navigate('/')}>
        <LayoutDashboard />
        {t('回到首页')}
      </Button>
    </Shell>
  )
}

export function NoPermissionPage() {
  const { t } = useTranslation()
  return (
    <Shell
      icon={ShieldAlert}
      title={t('暂无可访问页面')}
      description={t('当前账号没有分配可见菜单，请联系管理员分配权限。')}
    />
  )
}

export function RouteNotConfigured({ path, component }) {
  const { t } = useTranslation()
  return (
    <Shell
      icon={Compass}
      title={t('页面未配置')}
      description={t('菜单路径 {{path}} 对应的组件 {{component}} 未在前端注册。component 需与 apps/web/src/modules/<module>/pages/<page>/index.jsx 对齐，例如 admin/users。', { path, component: component || t('(空)') })}
    />
  )
}

/**
 * Placeholder while page code loads for the first time: shaped like a standard list page (title + right-side button, filter bar, table card),
 * matching DataTable's own row skeleton so nothing jumps when the page appears. Only likely seen on the first page opened after login;
 * after that, page switches keep the old page via AppLayout's Suspense + route transition until the new page code is ready.
 */
export function PageLoading() {
  const { t } = useTranslation()
  const widths = ['w-2/3', 'w-1/2', 'w-3/4', 'w-2/5', 'w-3/5']
  return (
    <div aria-busy="true" aria-label={t('加载中')}>
      <div className="mb-6 flex items-end justify-between gap-4">
        <Skeleton className="h-7 w-36" />
        <div className="hidden gap-2 sm:flex">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-9 w-full max-w-64" />
        <Skeleton className="h-9 w-16" />
      </div>
      <div className="surface-card overflow-hidden">
        <div className="bg-muted/40 h-10 border-b" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="grid h-12 grid-cols-4 items-center gap-6 border-b px-4 last:border-0">
            {Array.from({ length: 4 }).map((__, j) => (
              <Skeleton key={j} className={`h-3.5 ${widths[(i * 7 + j * 3) % widths.length]}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
