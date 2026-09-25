import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bot, Check, Copy, RotateCcw, Trash2, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import MarkdownView from '@/shared/components/markdown/MarkdownView'
import './chat.css'

/**
 * Smooth streaming text: network chunks arrive unevenly, so catch up to the target text frame by frame.
 * The more is left, the faster it catches up (about 10 frames); at least 1 character per frame, so text never pops in in lumps.
 */
function useSmoothText(text, animate) {
  const [shown, setShown] = useState(animate ? 0 : text.length)
  const target = text.length

  useEffect(() => {
    if (shown >= target) return undefined
    const frame = requestAnimationFrame(() => {
      setShown((s) => Math.min(target, s + Math.max(1, Math.ceil((target - s) / 10))))
    })
    return () => cancelAnimationFrame(frame)
  }, [shown, target])

  return { text: text.slice(0, Math.min(shown, target)), catchingUp: shown < target }
}

function ActionButton({ label, onClick, children, className }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={onClick}
          className={cn('text-muted-foreground hover:text-foreground', className)}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function CopyAction({ text }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timerRef = useRef(null)
  useEffect(() => () => clearTimeout(timerRef.current), [])
  const copy = () => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => setCopied(false), 1600)
      })
      .catch(() => toast.error('复制失败'))
  }
  return (
    <ActionButton label={copied ? t('已复制') : t('复制')} onClick={copy}>
      {copied ? <Check className="text-success" /> : <Copy />}
    </ActionButton>
  )
}

function TypingDots() {
  const { t } = useTranslation()
  return (
    <span className="flex h-6 items-center gap-1" aria-label={t('AI 正在思考')}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="bg-muted-foreground/60 size-1.5 rounded-full"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

function AssistantBody({ message }) {
  const { t } = useTranslation()
  // Only messages still generating on first render are smoothed; history is shown in full
  const [animate] = useState(message.status === 'loading' || message.status === 'incomplete')
  const { text, catchingUp } = useSmoothText(message.content || '', animate)
  const streaming = message.status === 'incomplete' || catchingUp

  if (!text && (message.status === 'loading' || message.status === 'incomplete')) return <TypingDots />
  return (
    <div className={cn('relative', streaming && 'chat-streaming')}>
      <MarkdownView>{text}</MarkdownView>
      {message.stopped ? <p className="text-muted-foreground mt-2 text-xs">{t('已停止生成')}</p> : null}
    </div>
  )
}

/** Context divider (inserted after the context is cleared) */
export function ContextDivider() {
  const { t } = useTranslation()
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="text-muted-foreground flex items-center gap-3 py-1 text-xs"
    >
      <span className="bg-border h-px flex-1" />
      {t('上下文已清除，之后的对话不再携带之前的消息')}
      <span className="bg-border h-px flex-1" />
    </motion.div>
  )
}

function ChatMessage({ message, busy, canRegenerate, onRegenerate, onDelete }) {
  const { t } = useTranslation()
  const isUser = message.role === 'user'
  const isError = message.status === 'error'
  const generating = message.status === 'loading' || message.status === 'incomplete'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className={cn('group flex gap-3', isUser && 'flex-row-reverse')}
    >
      <div
        className={cn(
          'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-muted text-muted-foreground ring-border ring-1' : 'bg-brand-gradient-strong shadow-brand text-white',
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className={cn('flex min-w-0 flex-col gap-1', isUser ? 'max-w-[85%] items-end sm:max-w-[75%]' : 'max-w-[92%] flex-1 sm:max-w-[85%]')}>
        <span className="text-muted-foreground px-1 text-xs">{isUser ? t('我') : t('AI 助手')}</span>
        {isUser ? (
          <div className="bg-muted rounded-2xl rounded-tr-md px-4 py-2.5 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {message.content}
          </div>
        ) : isError ? (
          <div className="bg-danger-soft text-danger flex items-start gap-2 rounded-2xl rounded-tl-md px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span className="break-all">{message.content}</span>
          </div>
        ) : (
          <div className="bg-card rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_0_0_1px_var(--border)]">
            <AssistantBody message={message} />
          </div>
        )}

        {!generating ? (
          <div
            className={cn(
              'flex items-center gap-0.5 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 md:opacity-0',
              isUser && 'flex-row-reverse',
            )}
          >
            {message.content && !isError ? <CopyAction text={message.content} /> : null}
            {canRegenerate ? (
              <ActionButton label={t('重新生成')} onClick={() => onRegenerate(message.id)}>
                <RotateCcw />
              </ActionButton>
            ) : null}
            {!busy ? (
              <ActionButton label={t('删除')} onClick={() => onDelete(message.id)} className="hover:text-danger">
                <Trash2 />
              </ActionButton>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.div>
  )
}

export default memo(ChatMessage)
