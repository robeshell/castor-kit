import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from 'ai'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, Lightbulb, MessageSquarePlus, Sparkles, X } from 'lucide-react'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { useStreamdownTranslations } from '@/components/ai-elements/streamdown-translations'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { findActiveMenu, flattenMenus, STATIC_TITLES } from '@/components/app/menu-tree'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useAuth } from '@/context/AuthContext'
import i18n from '@/i18n'
import { EASE_OUT } from '@/lib/motion'
import { menuLabel } from '@/lib/menu-label'
import { cn } from '@/lib/utils'
import { getCsrfToken } from '@/shared/api/request'
import ToolPart from '@/components/app/assistant/ToolPart'

/** Messages kept in sessionStorage (older ones are dropped) */
const KEEP_MESSAGES = 40

// Chinese source text; translated with t() when rendered
const SUGGESTIONS = ['系统里一共有多少个用户？', '列出所有部门', '最近 10 条操作日志', '这个页面能做什么？']

const storageKey = (userId) => `castor-kit:assistant:${userId}`

function loadMessages(userId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(userId)) || '[]')
    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

function saveMessages(userId, messages) {
  try {
    if (messages.length === 0) sessionStorage.removeItem(storageKey(userId))
    else sessionStorage.setItem(storageKey(userId), JSON.stringify(messages.slice(-KEEP_MESSAGES)))
  } catch {
    // storage full or blocked: the conversation just isn't kept across reloads
  }
}

/** A non-2xx answer arrives as an Error whose message is the response body: show its `error` field when it is JSON */
function errorText(error) {
  const text = error?.message || ''
  try {
    const data = JSON.parse(text)
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* not JSON */
  }
  return text || i18n.t('网络错误，请重试')
}

/** The page being viewed (one widget per app) */
let pageContext = {}

/** useChat's own fetch: CSRF header (writes need it), UI language (errors are translated) and the page context */
const transport = new DefaultChatTransport({
  api: '/api/admin/assistant/chat',
  credentials: 'include',
  headers: () => ({ 'X-CSRF-Token': getCsrfToken(), 'Accept-Language': i18n.language }),
  body: () => ({ context: pageContext }),
})

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

function TypingDots() {
  const { t } = useTranslation()
  return (
    <span className="flex h-5 items-center gap-1" aria-label={t('AI 正在思考')}>
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

/** One message: the user's text, or the assistant's text and tool calls in the order they happened */
function AssistantMessage({ message, streaming, onRespond }) {
  const translations = useStreamdownTranslations()
  if (message.role === 'user') {
    const text = message.parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join('')
    return (
      <Message from="user" className="max-w-[85%]">
        <MessageContent className="text-[13px] leading-relaxed break-words whitespace-pre-wrap">{text}</MessageContent>
      </Message>
    )
  }
  const parts = message.parts.filter((p) => (p.type === 'text' && p.text) || p.type.startsWith('tool-'))
  const lastIndex = parts.length - 1
  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full gap-2 text-[13px] [overflow-wrap:anywhere]">
        {parts.map((part, i) =>
          part.type === 'text' ? (
            <MessageResponse
              key={i}
              isAnimating={streaming && i === lastIndex}
              caret={streaming && i === lastIndex ? 'block' : undefined}
              translations={translations}
            >
              {part.text}
            </MessageResponse>
          ) : (
            <ToolPart key={part.toolCallId ?? i} part={part} onRespond={onRespond} />
          ),
        )}
        {streaming && parts.length === 0 ? <TypingDots /> : null}
      </MessageContent>
    </Message>
  )
}

/**
 * Global AI assistant: a floating button (bottom right, ⌘/Ctrl + J) opening a non-modal panel, so the page stays
 * usable while chatting. It answers questions, looks data up and — after the user allows each call — changes it,
 * always as the signed-in user (see the API's assistant module). The page being viewed is sent along as context;
 * the conversation is kept for the browser tab (sessionStorage).
 */
export default function AssistantWidget() {
  const { t } = useTranslation()
  const { user, menus } = useAuth()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const userId = user?.id

  // The page being viewed, sent along with each message
  const flat = useMemo(() => flattenMenus(menus), [menus])
  const active = findActiveMenu(flat, location.pathname)
  const title = active ? menuLabel(active) : STATIC_TITLES[location.pathname] ? t(STATIC_TITLES[location.pathname]) : ''
  useEffect(() => {
    pageContext = { path: location.pathname, ...(title ? { title } : {}) }
  }, [location.pathname, title])

  const initial = useMemo(() => (userId ? loadMessages(userId) : []), [userId])
  const { messages, setMessages, sendMessage, addToolApprovalResponse, stop, status, error, clearError } = useChat({
    id: `assistant-${userId ?? 'anon'}`,
    messages: initial,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
  })

  const busy = status === 'submitted' || status === 'streaming'
  const last = messages.at(-1)
  // A write waiting for the user: the model can't continue until it is allowed or refused
  const awaitingApproval = last?.role === 'assistant' && last.parts.some((p) => p.state === 'approval-requested')

  useEffect(() => {
    if (userId && !busy) saveMessages(userId, messages)
  }, [userId, messages, busy])

  // ⌘/Ctrl + J toggles the panel
  useEffect(() => {
    const onKey = (event) => {
      if (event.key.toLowerCase() === 'j' && (event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Focus the input when the panel opens
  useEffect(() => {
    if (open) requestAnimationFrame(() => panelRef.current?.querySelector('textarea')?.focus())
  }, [open])

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => buttonRef.current?.focus())
  }

  const send = (text) => {
    const value = text.trim()
    if (!value || busy || awaitingApproval) return
    clearError()
    sendMessage({ text: value })
    setInput('')
  }

  const restart = () => {
    stop()
    clearError()
    setMessages([])
  }

  const respond = (id, approved) => addToolApprovalResponse({ id, approved })

  const empty = messages.length === 0
  const shortcut = isMac ? '⌘J' : 'Ctrl J'

  return (
    <>
      <AnimatePresence>
        {!open ? (
          <motion.button
            key="launcher"
            ref={buttonRef}
            type="button"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            onClick={() => setOpen(true)}
            aria-label={t('打开 AI 小助手')}
            title={`${t('AI 小助手')} (${shortcut})`}
            className="bg-brand-gradient-strong shadow-brand focus-visible:ring-ring/20 fixed right-5 bottom-5 z-40 flex size-12 items-center justify-center rounded-full text-white outline-none hover:brightness-110 focus-visible:ring-2"
          >
            <Sparkles className="size-5" />
          </motion.button>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.section
            key="panel"
            ref={panelRef}
            role="dialog"
            aria-modal="false"
            aria-label={t('AI 小助手')}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !event.defaultPrevented) close()
            }}
            className="bg-card fixed inset-x-2 top-16 bottom-2 z-40 flex origin-bottom-right flex-col overflow-hidden rounded-2xl border shadow-2xl sm:inset-x-auto sm:top-auto sm:right-5 sm:bottom-5 sm:h-[min(640px,calc(100svh-2.5rem))] sm:w-[420px]"
          >
            <header className="flex items-center gap-2 border-b px-4 py-2.5">
              <span className="bg-brand-gradient-strong flex size-7 items-center justify-center rounded-full text-white">
                <Sparkles className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{t('AI 小助手')}</h2>
                <p className="text-muted-foreground truncate text-[11px]">
                  {title ? t('当前页面：{{title}}', { title }) : t('以你的身份查询和操作')}
                </p>
              </div>
              <Kbd className="hidden sm:inline-flex">{shortcut}</Kbd>
              <Button variant="ghost" size="icon-sm" onClick={restart} disabled={empty} aria-label={t('新对话')} title={t('新对话')}>
                <MessageSquarePlus />
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={close} aria-label={t('关闭')} title={t('关闭')}>
                <X />
              </Button>
            </header>

            <Conversation className="min-h-0 flex-1">
              <ConversationContent className="gap-4 px-4 py-4">
                {empty ? (
                  <div className="flex flex-col gap-3 pt-2">
                    <p className="text-muted-foreground text-[13px] leading-relaxed">
                      {t('你好！我可以帮你查询数据、解答系统用法，也可以在你确认后帮你修改数据。我只能做你本人有权限做的事。')}
                    </p>
                    <Suggestions className="w-full flex-col items-stretch gap-2 whitespace-normal">
                      {SUGGESTIONS.map((hint) => (
                        <Suggestion
                          key={hint}
                          suggestion={t(hint)}
                          onClick={send}
                          className="h-auto justify-start gap-2 rounded-xl py-2 text-left text-[13px] font-normal whitespace-normal"
                        >
                          <Lightbulb className="text-primary size-3.5 shrink-0" />
                          {t(hint)}
                        </Suggestion>
                      ))}
                    </Suggestions>
                  </div>
                ) : null}
                {messages.map((m) => (
                  <AssistantMessage
                    key={m.id}
                    message={m}
                    streaming={busy && m.id === last?.id && m.role === 'assistant'}
                    onRespond={respond}
                  />
                ))}
                {status === 'submitted' && last?.role !== 'assistant' ? <TypingDots /> : null}
                {status === 'error' && error ? (
                  <div className="bg-danger-soft text-danger flex items-start gap-2 rounded-xl px-3 py-2 text-[13px]">
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span className="break-all">{errorText(error)}</span>
                  </div>
                ) : null}
              </ConversationContent>
              <ConversationScrollButton aria-label={t('回到底部')} className="bottom-3 shadow-md" />
            </Conversation>

            <div className="border-t p-3">
              <PromptInput onSubmit={({ text }) => send(text)}>
                <PromptInputBody>
                  <PromptInputTextarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={awaitingApproval ? t('请先允许或拒绝上面的操作') : t('问点什么，Enter 发送...')}
                    aria-label={t('输入消息')}
                    disabled={awaitingApproval}
                    className="min-h-10 text-[13px]"
                  />
                </PromptInputBody>
                <PromptInputFooter>
                  <PromptInputTools>
                    <span className="text-muted-foreground px-1 text-[11px]">{t('修改数据前会先请你确认')}</span>
                  </PromptInputTools>
                  <PromptInputSubmit
                    status={busy ? status : 'ready'}
                    onStop={stop}
                    disabled={!busy && (!input.trim() || awaitingApproval)}
                    aria-label={busy ? t('停止生成') : t('发送')}
                    title={busy ? t('停止生成') : t('发送')}
                    className={cn('size-8')}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          </motion.section>
        ) : null}
      </AnimatePresence>
    </>
  )
}
