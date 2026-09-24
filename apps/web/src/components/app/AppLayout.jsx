import { useState } from 'react'
import { useLocation, useOutlet } from 'react-router-dom'
import { motion } from 'motion/react'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { pageTransition } from '@/lib/motion'
import AppSidebar from '@/components/app/AppSidebar'
import CommandMenu from '@/components/app/CommandMenu'
import TopBar from '@/components/app/TopBar'

/** 应用外壳：侧边栏 + 顶栏 + 内容区（每次路由切换做一次轻量入场动画） */
export default function AppLayout() {
  const outlet = useOutlet()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <SidebarProvider className="h-svh">
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-hidden">
        <TopBar onOpenSearch={() => setSearchOpen(true)} />
        <div className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={pageTransition.initial}
            animate={pageTransition.animate}
            transition={pageTransition.transition}
            className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-7"
          >
            {outlet}
          </motion.div>
        </div>
      </SidebarInset>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </SidebarProvider>
  )
}
