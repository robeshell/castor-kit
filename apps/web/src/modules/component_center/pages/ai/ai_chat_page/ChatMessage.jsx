import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Bot, Check, Copy, RotateCcw, Trash2, User } from 'lucide-react'
import { Message, MessageAction, MessageActions, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import { EASE_OUT } from '@/lib/motion'
import { toast } from '@/lib/toast'
import { cn } from '@/lib/utils'
import { textOf } from '@/modules/component_center/pages/ai/ai_chat_page/message-text'


/** Labels of Streamdown's own buttons (code block copy / download, tables, links) in the current language */
function useStreamdownTranslations() {
  const { t, i18n } = useTranslation()
  return useMemo(
    () => ({
      close: t('关闭'),
      copied: t('已复制'),
      copyCode: t('复制代码'),
      copyLink: t('复制链接'),
      copyTable: t('复制表格'),
      copyTableAsCsv: t('复制为 CSV'),
      copyTableAsMarkdown: t('复制为 Markdown'),
      copyTableAsTsv: t('复制为 TSV'),
      downloadFile: t('下载文件'),
      downloadImage: t('下载图片'),
      downloadTable: t('下载表格'),
      downloadTableAsCsv: t('下载为 CSV'),
      downloadTableAsMarkdown: t('下载为 Markdown'),
      exitFullscreen: t('退出全屏'),
      externalLinkWarning: t('即将打开外部链接，请确认链接可信'),
      imageNotAvailable: t('图片无法显示'),
      openExternalLink: t('打开外部链接'),
      openLink: t('打开链接'),
      viewFullscreen: t('全屏查看'),
    }),
    // i18n.language: recompute when the language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, i18n.language],
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
    <MessageAction tooltip={copied ? t('已复制') : t('复制')} size="icon-xs" onClick={copy} className="text-muted-foreground hover:text-foreground">
      {copied ? <Check className="text-success" /> : <Copy />}
    </MessageAction>
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

/** Context divider (inserted after the context is cleared) */
export function ContextDivider() {
  const { t } = useTranslation()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-muted-foreground flex items-center gap-3 py-1 text-xs">
      <span className="bg-border h-px flex-1" />
      {t('上下文已清除，之后的对话不再携带之前的消息')}
      <span className="bg-border h-px flex-1" />
    </motion.div>
  )
}

/** A failed reply: the error text from the stream, or the request's error */
export function ChatError({ text }) {
  return (
    <div className="flex gap-3">
      <Avatar role="assistant" />
      <div className="bg-danger-soft text-danger flex max-w-[92%] items-start gap-2 rounded-2xl rounded-tl-md px-4 py-3 text-sm sm:max-w-[85%]">
        <AlertCircle className="mt-0.5 size-4 shrink-0" />
        <span className="break-all">{text}</span>
      </div>
    </div>
  )
}

function Avatar({ role }) {
  const isUser = role === 'user'
  return (
    <div
      className={cn(
        'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-muted text-muted-foreground ring-border ring-1' : 'bg-brand-gradient-strong shadow-brand text-white',
      )}
    >
      {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
    </div>
  )
}

/**
 * One message. `streaming`: the reply is still arriving (text renders incrementally, no actions yet);
 * `stopped`: the user stopped it. `onRegenerate` / `onDelete` are omitted when the action isn't available.
 */
function ChatMessage({ message, streaming, stopped, onRegenerate, onDelete }) {
  const { t } = useTranslation()
  const translations = useStreamdownTranslations()
  const isUser = message.role === 'user'
  const text = textOf(message)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className={cn('flex gap-3', isUser && 'flex-row-reverse')}
    >
      <Avatar role={message.role} />
      <Message from={message.role} className={cn('min-w-0 gap-1', isUser ? 'max-w-[85%] items-end sm:max-w-[75%]' : 'max-w-[92%] flex-1 sm:max-w-[85%]')}>
        <span className="text-muted-foreground px-1 text-xs">{isUser ? t('我') : t('AI 助手')}</span>
        {isUser ? (
          <MessageContent className="leading-relaxed break-words whitespace-pre-wrap">
            {text}
          </MessageContent>
        ) : (
          <MessageContent className="bg-card w-full rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_0_0_1px_var(--border)]">
            {text ? (
              <MessageResponse isAnimating={streaming} caret={streaming ? 'block' : undefined} translations={translations}>
                {text}
              </MessageResponse>
            ) : streaming ? (
              <TypingDots />
            ) : null}
            {stopped ? <p className="text-muted-foreground text-xs">{t('已停止生成')}</p> : null}
          </MessageContent>
        )}

        {!streaming ? (
          <MessageActions
            className={cn(
              'gap-0.5 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100 md:opacity-0',
              isUser && 'flex-row-reverse',
            )}
          >
            {text ? <CopyAction text={text} /> : null}
            {onRegenerate ? (
              <MessageAction tooltip={t('重新生成')} size="icon-xs" onClick={onRegenerate} className="text-muted-foreground hover:text-foreground">
                <RotateCcw />
              </MessageAction>
            ) : null}
            {onDelete ? (
              <MessageAction tooltip={t('删除')} size="icon-xs" onClick={onDelete} className="text-muted-foreground hover:text-danger">
                <Trash2 />
              </MessageAction>
            ) : null}
          </MessageActions>
        ) : null}
      </Message>
    </motion.div>
  )
}

export default memo(ChatMessage)
