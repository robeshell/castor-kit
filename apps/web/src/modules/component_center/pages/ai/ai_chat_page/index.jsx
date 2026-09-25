import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Eraser, Lightbulb, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import i18n from '@/i18n'
import { stagger } from '@/lib/motion'
import { cn } from '@/lib/utils'
import ChatMessage, { ContextDivider } from '@/modules/component_center/pages/ai/ai_chat_page/ChatMessage'
import { HINTS } from '@/modules/component_center/pages/ai/ai_chat_page/demo-content'
import PageHeader from '@/shared/components/PageHeader'
import { getCsrfToken } from '@/shared/api/request'

// content is the Chinese source text; it is translated with t() when rendered
const WELCOME = {
  role: 'assistant',
  id: 'welcome',
  content: '你好！我是 castor-kit AI 助手。\n\n请从下方选择提示词，或直接输入你的问题。',
  status: 'complete',
}

const isGenerating = (m) => m.role === 'assistant' && (m.status === 'loading' || m.status === 'incomplete')

// Convert chats to the API messages format (only messages after the latest "clear context")
function toApiMessages(chats) {
  let start = 0
  chats.forEach((m, i) => {
    if (m.role === 'divider') start = i + 1
  })
  return chats
    .slice(start)
    .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.status === 'complete' && m.content))
    .map((m) => ({ role: m.role, content: m.content || '' }))
}

// Non-2xx: the backend returns {error}; use its message, otherwise show the raw text
function readError(text) {
  try {
    const data = JSON.parse(text)
    if (data && typeof data.error === 'string') return data.error
  } catch {
    /* not JSON */
  }
  return text
}

async function callAiStream(apiMessages, aiMsgId, setChats, signal) {
  const patch = (fn) => setChats((p) => p.map((m) => (m.id === aiMsgId ? fn(m) : m)))
  try {
    const res = await fetch('/api/admin/component-center/ai/chat/stream', {
      method: 'POST',
      // Native fetch bypasses axios, so attach the CSRF header manually (the login / getMe response stored the token)
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      credentials: 'include',
      body: JSON.stringify({ messages: apiMessages }),
      signal,
    })

    if (!res.ok) {
      const err = await res.text()
      patch((m) => ({ ...m, status: 'error', content: i18n.t('请求失败：{{message}}', { message: readError(err) }) }))
      return
    }

    patch((m) => ({ ...m, status: 'incomplete' }))

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const raw = line.slice(5).trim()
        if (raw === '[DONE]') {
          patch((m) => ({ ...m, status: 'complete' }))
          return
        }
        try {
          const chunk = JSON.parse(raw)
          if (chunk.error) {
            patch((m) => ({ ...m, status: 'error', content: chunk.error }))
            return
          }
          if (chunk.content) {
            patch((m) => ({ ...m, content: m.content + chunk.content }))
          }
        } catch {
          /* ignore */
        }
      }
    }
    patch((m) => ({ ...m, status: 'complete' }))
  } catch (err) {
    if (err.name === 'AbortError') return
    patch((m) => ({ ...m, status: 'error', content: i18n.t('网络错误，请重试') }))
  }
}

function Composer({ busy, onSend, onStop }) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const ref = useRef(null)

  // Auto-grow the textarea with its content (up to about 8 lines, then scroll)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const submit = () => {
    const text = value.trim()
    if (!text || busy) return
    onSend(text)
    setValue('')
  }

  return (
    <div className="border-t px-3 pt-3 pb-3 sm:px-5">
      <div
        className={cn(
          'bg-background mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border px-3 py-2 transition-[border-color,box-shadow] duration-150',
          'focus-within:border-ring focus-within:ring-ring/30 focus-within:ring-[3px]',
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter inserts a newline; never send while an IME is composing
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={t('输入消息，Enter 发送...')}
          aria-label={t('输入消息')}
          className="placeholder:text-muted-foreground max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-1.5 text-sm leading-relaxed outline-none"
        />
        <AnimatePresence mode="wait" initial={false}>
          {busy ? (
            <motion.div key="stop" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Button type="button" variant="outline" size="icon-sm" className="rounded-full" aria-label={t('停止生成')} title={t('停止生成')} onClick={onStop}>
                <Square className="fill-current size-3" />
              </Button>
            </motion.div>
          ) : (
            <motion.div key="send" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} transition={{ duration: 0.15 }}>
              <Button type="button" variant="brand" size="icon-sm" className="rounded-full" aria-label={t('发送')} title={t('发送')} disabled={!value.trim()} onClick={submit}>
                <ArrowUp />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="text-muted-foreground mx-auto mt-1.5 max-w-3xl text-center text-[11px]">
        {t('Enter 发送 · Shift + Enter 换行')}
      </p>
    </div>
  )
}

export default function AiChatPage() {
  const { t } = useTranslation()
  const [chats, setChats] = useState([WELCOME])
  // Snapshot of the latest chats (used by event handlers to build requests without stale closures)
  const chatsRef = useRef(chats)
  const abortRef = useRef(null)
  const idRef = useRef(100)
  const scrollRef = useRef(null)
  const contentRef = useRef(null)
  const stickRef = useRef(true)
  const [atBottom, setAtBottom] = useState(true)

  useEffect(() => {
    chatsRef.current = chats
  }, [chats])

  // Abort any in-flight SSE stream on unmount to avoid setState on an unmounted component
  useEffect(() => () => abortRef.current?.abort(), [])

  const commit = useCallback((next) => {
    chatsRef.current = next
    setChats(next)
  }, [])

  // Append an AI message to base and start the streaming request
  const triggerAI = useCallback(
    (base) => {
      const aiMsgId = String(++idRef.current)
      const apiMessages = toApiMessages(base)
      commit([...base, { role: 'assistant', id: aiMsgId, content: '', status: 'loading' }])

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      stickRef.current = true
      callAiStream(apiMessages, aiMsgId, setChats, ctrl.signal)
    },
    [commit],
  )

  const handleSend = useCallback(
    (text) => {
      const userMsg = { role: 'user', id: String(++idRef.current), content: text, status: 'complete' }
      triggerAI([...chatsRef.current, userMsg])
    },
    [triggerAI],
  )

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setChats((p) => p.map((m) => (isGenerating(m) ? { ...m, status: 'complete', stopped: true } : m)))
  }, [])

  // Regenerate: drop this AI reply and request again from the messages before it
  const handleRegenerate = useCallback(
    (id) => {
      const list = chatsRef.current
      const idx = list.findIndex((m) => m.id === id)
      if (idx < 0) return
      triggerAI(list.slice(0, idx))
    },
    [triggerAI],
  )

  const handleDelete = useCallback((id) => {
    setChats((p) => p.filter((m) => m.id !== id))
  }, [])

  const handleClearContext = () => {
    const list = chatsRef.current
    if (!list.length || list[list.length - 1].role === 'divider') return
    stickRef.current = true
    commit([...list, { role: 'divider', id: String(++idRef.current) }])
  }

  const busy = chats.some(isGenerating)
  // The welcome message follows the current language
  const welcome = useMemo(() => ({ ...WELCOME, content: t(WELCOME.content) }), [t])

  // Can regenerate: the last message is an AI reply (complete or failed) with a user message before it
  const last = chats[chats.length - 1]
  const regenerateId =
    !busy && last?.role === 'assistant' && last.id !== WELCOME.id && (last.status === 'complete' || last.status === 'error') ? last.id : null

  // No user message in the current context yet -> show prompt suggestions
  const lastDivider = chats.map((m) => m.role).lastIndexOf('divider')
  const showHints = !busy && !chats.slice(lastDivider + 1).some((m) => m.role === 'user')

  // Stick to bottom: while the user stays near the bottom, scroll down whenever content grows (new messages / streamed text)
  useEffect(() => {
    const el = scrollRef.current
    const content = contentRef.current
    if (!el || !content) return undefined
    const observer = new ResizeObserver(() => {
      if (stickRef.current) el.scrollTop = el.scrollHeight
    })
    observer.observe(content)
    return () => observer.disconnect()
  }, [])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    stickRef.current = near
    if (near !== atBottom) setAtBottom(near)
  }

  const scrollToBottom = () => {
    const el = scrollRef.current
    if (!el) return
    stickRef.current = true
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  return (
    <div className="flex h-[calc(100svh-104px)] flex-col md:h-[calc(100svh-112px)]">
      <PageHeader
        title="AI 对话"
        actions={
          <Button variant="outline" size="sm" onClick={handleClearContext} disabled={busy || last?.role === 'divider'}>
            <Eraser />
            {t('清除上下文')}
          </Button>
        }
      />

      <section className="surface-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto">
          <div ref={contentRef} className="mx-auto flex max-w-3xl flex-col gap-6 px-3 py-6 sm:px-5">
            {chats.map((m) =>
              m.role === 'divider' ? (
                <ContextDivider key={m.id} />
              ) : (
                <ChatMessage
                  key={m.id}
                  message={m.id === WELCOME.id ? welcome : m}
                  busy={busy}
                  canRegenerate={m.id === regenerateId}
                  onRegenerate={handleRegenerate}
                  onDelete={handleDelete}
                />
              ),
            )}

            <AnimatePresence>
              {showHints ? (
                <motion.div
                  key="hints"
                  variants={stagger.container}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  className="grid gap-2 pl-11 sm:grid-cols-2"
                >
                  {HINTS.map((hint) => (
                    <motion.button
                      key={hint}
                      type="button"
                      variants={stagger.item}
                      onClick={() => handleSend(hint)}
                      className="bg-card hover:bg-muted/60 hover:border-primary/30 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] transition-colors duration-150"
                    >
                      <Lightbulb className="text-primary size-3.5 shrink-0" />
                      <span className="min-w-0 truncate">{hint}</span>
                    </motion.button>
                  ))}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {!atBottom ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute inset-x-0 bottom-[108px] flex justify-center"
            >
              <Button variant="outline" size="icon-sm" className="pointer-events-auto rounded-full shadow-md" aria-label={t('回到底部')} onClick={scrollToBottom}>
                <ArrowDown />
              </Button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <Composer busy={busy} onSend={handleSend} onStop={handleStop} />
      </section>
    </div>
  )
}
