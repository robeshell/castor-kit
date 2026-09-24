import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { motion } from 'motion/react'
import { ArrowRight, Eye, EyeOff, LockKeyhole, ShieldCheck, User } from 'lucide-react'
import BrandMark from '@/components/app/BrandMark'
import ThemeToggle from '@/components/app/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/context/AuthContext'
import { toast } from '@/lib/toast'
import { EASE_OUT } from '@/lib/motion'
import { cn } from '@/lib/utils'
import { login } from '@/modules/admin/api/auth'

/** 背景：以表单卡片为中心的细网格 + 卡片身后的一圈 Ocean 光晕，只做烘托，不抢表单 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_42%_46%_at_50%_46%,black_20%,transparent_100%)] bg-[size:56px_56px]" />
    </div>
  )
}

function Halo() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-40 -top-40 -bottom-24 -z-10">
      <div className="absolute top-8 left-1/2 h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand-from)_18%,transparent),transparent)]" />
      <div className="absolute top-24 left-[62%] h-[260px] w-[340px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand-to)_16%,transparent),transparent)]" />
    </div>
  )
}

/** 带前置图标的输入框 */
function IconInput({ icon: Icon, invalid, className, ...props }) {
  return (
    <div className="relative">
      <Icon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input aria-invalid={invalid} className={cn('h-10 pl-9', className)} {...props} />
    </div>
  )
}

export default function Login() {
  const { user, login: setAuth, loading } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = {}
    if (!username.trim()) nextErrors.username = '请输入用户名'
    if (!password) nextErrors.password = '请输入密码'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSubmitting(true)
    try {
      const data = await login({ username, password })
      await setAuth(data.user)
      toast.success('登录成功')
      navigate('/')
    } catch (err) {
      toast.apiError(err, '登录失败')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-sidebar relative flex h-svh flex-col overflow-y-auto">
      <Backdrop />

      <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
        <BrandMark />
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="relative isolate w-full max-w-[400px]"
        >
          <Halo />
          {/* 表单卡片：页面唯一的视觉主体 */}
          <div className="bg-card relative overflow-hidden rounded-2xl px-7 pt-9 pb-7 shadow-[0_0_0_1px_var(--border),0_1px_2px_rgba(0,0,0,0.04),0_28px_56px_-24px_rgba(15,23,42,0.22)] sm:px-9 dark:shadow-[0_0_0_1px_var(--border),0_28px_56px_-24px_rgba(0,0,0,0.7)]">
            {/* 顶部一道渐变高光，给卡片一点品牌感 */}
            <div className="via-brand-via absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent" />

            <div className="flex flex-col items-center text-center">
              <div className="bg-brand-gradient-strong shadow-brand flex size-11 items-center justify-center rounded-xl text-lg font-semibold text-white">
                C
              </div>
              <h1 className="mt-5 text-[22px] font-semibold tracking-tight">登录 castor-kit</h1>
            </div>

            <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="username" className="text-[13px]">
                  用户名
                </Label>
                <IconInput
                  id="username"
                  icon={User}
                  autoComplete="username"
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  invalid={Boolean(errors.username)}
                />
                {errors.username ? <p className="text-destructive text-xs">{errors.username}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-[13px]">
                  密码
                </Label>
                <div className="relative">
                  <IconInput
                    id="password"
                    icon={LockKeyhole}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入密码"
                    invalid={Boolean(errors.password)}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                    className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password ? <p className="text-destructive text-xs">{errors.password}</p> : null}
              </div>

              <Button type="submit" variant="brand" disabled={submitting} className="group mt-2 h-10 w-full">
                {submitting ? <Spinner /> : null}
                登录
                {!submitting ? <ArrowRight className="transition-transform duration-200 group-hover:translate-x-0.5" /> : null}
              </Button>
            </form>

            <div className="text-muted-foreground mt-6 flex items-center justify-center gap-1.5 border-t pt-5 text-xs">
              <ShieldCheck className="size-3.5 shrink-0" />
              <span>默认管理员账号 admin，密码以部署配置为准</span>
            </div>
          </div>

        </motion.div>
      </main>

      <footer className="text-muted-foreground relative px-5 pb-6 text-center text-xs sm:px-8">© 2026 castor-kit</footer>
    </div>
  )
}
