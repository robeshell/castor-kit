import { Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import BrandMark from '@/components/app/BrandMark'

export function FullscreenLoader() {
  return (
    <div className="flex h-svh flex-col items-center justify-center gap-4">
      <BrandMark showText={false} className="animate-pulse" />
      <div className="bg-muted h-0.5 w-24 overflow-hidden rounded-full">
        <div className="bg-brand-gradient h-full w-1/3 animate-[loader_1.1s_ease-in-out_infinite] rounded-full" />
      </div>
      <style>{'@keyframes loader{0%{transform:translateX(-100%)}100%{transform:translateX(300%)}}'}</style>
    </div>
  )
}

export default function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullscreenLoader />
  if (!user) return <Navigate to="/login" replace />
  return children
}
