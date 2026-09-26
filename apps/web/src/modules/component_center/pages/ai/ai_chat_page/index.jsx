import { useMemo, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { AnimatePresence, motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Eraser, Lightbulb } from 'lucide-react'
import { Conversation, ConversationContent, ConversationScrollButton } from '@/components/ai-elements/conversation'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { Button } from '@/components/ui/button'
import i18n from '@/i18n'
import { stagger } from '@/lib/motion'
import ChatMessage, { ChatError, ContextDivider } from '@/modules/component_center/pages/ai/ai_chat_page/ChatMessage'
import { HINTS } from '@/modules/component_center/pages/ai/ai_chat_page/demo-content'
import { textOf } from '@/modules/component_center/pages/ai/ai_chat_page/message-text'
import PageHeader from '@/shared/components/PageHeader'
import { getCsrfToken } from '@/shared/api/request'

const API = '/api/admin/component-center/ai/chat/stream'

// content is the Chinese source text; it is translated with t() when rendered
const WELCOME = { id: 'welcome', role: 'assistant', parts: [{ type: 'text', text: '你好！我是 castor-kit AI 助手。\n\n请从下方选择提示词，或直接输入你的问题。' }] }

/**
 * The chat request goes through useChat's own fetch: attach the CSRF header (writes need it) and the UI language
 * (errors inside the stream are translated by the API)
 */
const transport = new DefaultChatTransport({
  api: API,
  credentials: 'include',
  headers: () => ({ 'X-CSRF-Token': getCsrfToken(), 'Accept-Language': i18n.language }),
})

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

/**
 * AI chat (Vercel AI SDK useChat + AI Elements): the reply streams in from the API as a UI message stream.
 * "Clear context" moves the conversation so far above a divider; it stays visible but is no longer sent.
 */
export default function AiChatPage() {
  const { t } = useTranslation()
  const { messages, setMessages, sendMessage, regenerate, stop, status, error, clearError } = useChat({ transport })
  const [input, setInput] = useState('')
  /** Earlier conversations: [{ id, messages }] in order, each followed by a divider */
  const [archived, setArchived] = useState([])
  /** Ids of replies the user stopped */
  const [stopped, setStopped] = useState([])

  const busy = status === 'submitted' || status === 'streaming'
  const last = messages.at(-1)
  const welcome = useMemo(() => ({ ...WELCOME, parts: [{ type: 'text', text: t(WELCOME.parts[0].text) }] }), [t])

  const send = (text) => {
    const value = text.trim()
    if (!value || busy) return
    clearError()
    sendMessage({ text: value })
    setInput('')
  }

  const handleStop = () => {
    stop()
    if (last?.role === 'assistant') setStopped((ids) => [...ids, last.id])
  }

  const handleClearContext = () => {
    if (messages.length === 0) return
    setArchived((list) => [...list, { id: `archive-${list.length}`, messages }])
    setMessages([])
    clearError()
  }

  const removeMessage = (id) => {
    setMessages(messages.filter((m) => m.id !== id))
    setArchived((list) => list.map((a) => ({ ...a, messages: a.messages.filter((m) => m.id !== id) })))
  }

  // Regenerate: the last reply, once it finished
  const regenerateId = !busy && last?.role === 'assistant' && textOf(last) ? last.id : null
  const failed = status === 'error' && error
  // A reply that failed before any text arrived leaves an empty message: show only the error for it
  const visible = (list, current) =>
    list.filter((m) => m.role !== 'assistant' || textOf(m) || stopped.includes(m.id) || (current && busy && m.id === last?.id))

  const renderMessage = (m, { current }) => (
    <ChatMessage
      key={m.id}
      message={m}
      streaming={current && busy && m.id === last?.id && m.role === 'assistant'}
      stopped={stopped.includes(m.id)}
      onRegenerate={current && m.id === regenerateId ? () => regenerate({ messageId: m.id }) : undefined}
      onDelete={busy ? undefined : () => removeMessage(m.id)}
    />
  )

  const showHints = !busy && !messages.some((m) => m.role === 'user')

  return (
    <div className="flex h-[calc(100svh-104px)] flex-col md:h-[calc(100svh-112px)]">
      <PageHeader
        title="AI 对话"
        actions={
          <Button variant="outline" size="sm" onClick={handleClearContext} disabled={busy || messages.length === 0}>
            <Eraser />
            {t('清除上下文')}
          </Button>
        }
      />

      <section className="surface-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Conversation className="min-h-0">
          <ConversationContent className="mx-auto w-full max-w-3xl gap-6 px-3 py-6 sm:px-5">
            <ChatMessage message={welcome} />
            {archived.map((a) => (
              <div key={a.id} className="flex flex-col gap-6 opacity-70">
                {visible(a.messages, false).map((m) => renderMessage(m, { current: false }))}
                <ContextDivider />
              </div>
            ))}
            {visible(messages, true).map((m) => renderMessage(m, { current: true }))}
            {status === 'submitted' && last?.role === 'user' ? (
              <ChatMessage message={{ id: 'pending', role: 'assistant', parts: [] }} streaming />
            ) : null}
            {failed ? (
              <div className="flex flex-col gap-2">
                <ChatError text={errorText(error)} />
                <Button variant="outline" size="sm" className="ml-11 self-start" onClick={() => regenerate()}>
                  {t('重试')}
                </Button>
              </div>
            ) : null}

            <AnimatePresence>
              {showHints ? (
                <motion.div key="hints" variants={stagger.container} initial="hidden" animate="show" exit={{ opacity: 0, transition: { duration: 0.15 } }} className="pl-11">
                  <Suggestions className="w-full flex-wrap gap-2 whitespace-normal">
                    {HINTS.map((hint) => (
                      <motion.div key={hint} variants={stagger.item}>
                        <Suggestion suggestion={hint} onClick={send} className="h-auto gap-2 rounded-xl py-2 text-left text-[13px] font-normal whitespace-normal">
                          <Lightbulb className="text-primary size-3.5 shrink-0" />
                          {hint}
                        </Suggestion>
                      </motion.div>
                    ))}
                  </Suggestions>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </ConversationContent>
          <ConversationScrollButton aria-label={t('回到底部')} className="bottom-4 shadow-md" />
        </Conversation>

        <div className="border-t px-3 pt-3 pb-3 sm:px-5">
          <PromptInput onSubmit={({ text }) => send(text)} className="mx-auto max-w-3xl">
            <PromptInputBody>
              <PromptInputTextarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('输入消息，Enter 发送...')}
                aria-label={t('输入消息')}
                className="min-h-12"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <span className="text-muted-foreground px-1 text-[11px]">{t('Enter 发送 · Shift + Enter 换行')}</span>
              </PromptInputTools>
              <PromptInputSubmit
                status={busy ? status : 'ready'}
                onStop={handleStop}
                disabled={!busy && !input.trim()}
                aria-label={busy ? t('停止生成') : t('发送')}
                title={busy ? t('停止生成') : t('发送')}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </section>
    </div>
  )
}

