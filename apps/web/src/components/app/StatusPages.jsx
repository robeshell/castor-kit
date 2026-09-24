import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, LayoutDashboard, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

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
  return (
    <Shell code={code} title={title} description={description}>
      <Button variant="outline" onClick={() => navigate(-1)}>
        <ArrowLeft />
        返回上一页
      </Button>
      <Button onClick={() => navigate('/')}>
        <LayoutDashboard />
        回到首页
      </Button>
    </Shell>
  )
}

export function NoPermissionPage() {
  return (
    <Shell
      icon={ShieldAlert}
      title="暂无可访问页面"
      description="当前账号没有分配可见菜单，请联系管理员分配权限。"
    />
  )
}

export function RouteNotConfigured({ path, component }) {
  return (
    <Shell
      icon={Compass}
      title="页面未配置"
      description={`菜单路径 ${path} 对应的组件 ${component || '(空)'} 未在前端注册。component 需与 apps/web/src/modules/<module>/pages/<page>/index.jsx 对齐，例如 admin/users。`}
    />
  )
}

export function PageLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-[360px] w-full rounded-xl" />
    </div>
  )
}
