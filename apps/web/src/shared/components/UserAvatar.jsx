import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

/**
 * User avatar: the uploaded image when `src` is set and loads, otherwise the first letter of `name`.
 * Size comes from className (default size-8).
 */
export default function UserAvatar({ src, name, className, fallbackClassName }) {
  return (
    <Avatar className={cn('ring-border ring-1', className)}>
      {src ? <AvatarImage src={src} alt={name || ''} className="object-cover" /> : null}
      <AvatarFallback className={cn('text-foreground text-xs font-medium', fallbackClassName)}>
        {(name || '?').slice(0, 1).toUpperCase()}
      </AvatarFallback>
    </Avatar>
  )
}
