import { motion } from 'motion/react'
import BrandMark from '@/components/app/BrandMark'
import LanguageSwitcher from '@/components/app/LanguageSwitcher'
import ThemeToggle from '@/components/app/ThemeToggle'
import { EASE_OUT } from '@/lib/motion'
import LoginBackdrop, { LoginCardBorder } from '@/modules/auth/pages/login/LoginBackdrop'

function Halo() {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-x-40 -top-40 -bottom-24 -z-10">
      <div className="absolute top-8 left-1/2 h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand-from)_18%,transparent),transparent)]" />
      <div className="absolute top-24 left-[62%] h-[260px] w-[340px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--brand-to)_16%,transparent),transparent)]" />
    </div>
  )
}

/** Page frame of the public pages (sign-in, password reset): animated backdrop, brand header, one glass card */
export default function AuthShell({ children }) {
  return (
    <div className="bg-sidebar relative flex h-svh flex-col overflow-y-auto">
      <LoginBackdrop />

      <header className="relative flex items-center justify-between px-5 py-4 sm:px-8">
        <BrandMark />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="relative isolate w-full max-w-[400px]"
        >
          <Halo />
          {/* Form card: the only visual focus of the page; frosted glass over the animated backdrop (login-backdrop.css) */}
          <div className="login-glass relative overflow-hidden rounded-2xl px-7 pt-9 pb-7 sm:px-9">
            <LoginCardBorder />
            {/* A gradient highlight along the top edge adds a touch of brand */}
            <div className="via-brand-via absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent to-transparent" />
            {children}
          </div>
        </motion.div>
      </main>

      <footer className="text-muted-foreground relative px-5 pb-6 text-center text-xs sm:px-8">© 2026 castor-kit</footer>
    </div>
  )
}

/** Card heading of a step: title plus an optional one-line explanation */
export function AuthHeading({ title, description }) {
  return (
    <div className="space-y-1.5 text-center">
      <h1 className="text-[22px] font-semibold tracking-tight">{title}</h1>
      {description ? <p className="text-muted-foreground text-[13px] leading-relaxed">{description}</p> : null}
    </div>
  )
}
