import { useCallback, useEffect, useRef, useState } from 'react'
import { useIsMobile } from '@/shared/hooks/useIsMobile'
import { getCsrfToken } from '@/shared/api/request'
import { Chat } from '@douyinfe/semi-ui'

const roleConfig = {
  user: {
    name: '我',
    avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
  },
  assistant: {
    name: 'AI 助手',
    avatar: 'https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/docs-icon.png',
  },
}

const HINTS = [
  '介绍一下 castor-kit 项目',
  '如何使用 Semi Design 组件库？',
  'Fastify 和 React 如何配合开发？',
  '用 TypeScript 写一个快速排序',
]

// 将 chats 转为 API 的 messages 格式
function toApiMessages(chats) {
  return chats
    .filter(m => m.role === 'user' || (m.role === 'assistant' && m.status === 'complete'))
    .map(m => ({ role: m.role, content: m.content || '' }))
}

async function callAiStream(apiMessages, aiMsgId, setChats, signal) {
  try {
    const res = await fetch('/api/admin/component-center/ai/chat/stream', {
      method: 'POST',
      // 原生 fetch 绕过 axios，需手动附加 CSRF 头（登录/getMe 响应已写入 token）
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrfToken() },
      credentials: 'include',
      body: JSON.stringify({ messages: apiMessages }),
      signal,
    })

    if (!res.ok) {
      const err = await res.text()
      setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'error', content: `请求失败：${err}` } : m))
      return
    }

    setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'incomplete' } : m))

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
          setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'complete' } : m))
          return
        }
        try {
          const chunk = JSON.parse(raw)
          if (chunk.error) {
            setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'error', content: chunk.error } : m))
            return
          }
          if (chunk.content) {
            setChats(p => p.map(m => m.id === aiMsgId ? { ...m, content: m.content + chunk.content } : m))
          }
        } catch { /* ignore */ }
      }
    }
    setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'complete' } : m))
  } catch (err) {
    if (err.name === 'AbortError') return
    setChats(p => p.map(m => m.id === aiMsgId ? { ...m, status: 'error', content: '网络错误，请重试' } : m))
  }
}

export default function AiChatPage() {
  const isMobile = useIsMobile()
  // 消息 ID 计数器：使用 per-instance ref，避免模块级共享可变状态在多实例/SSR 下相互影响
  const msgIdRef = useRef(100)
  const nextId = useCallback(() => ++msgIdRef.current, [])

  const initialChats = [
    {
      role: 'assistant',
      id: String(nextId()),
      content: '你好！我是 castor-kit AI 助手。\n\n请从下方选择提示词，或直接输入你的问题 ✨',
      status: 'complete',
      createAt: Date.now(),
    },
  ]

  const [chats, setChats] = useState(initialChats)
  // 用 ref 追踪最新 chats，避免 useCallback 闭包过期
  const chatsRef = useRef(initialChats)
  const abortRef = useRef(null)

  // 真正触发 AI 请求：调用时 chatsRef.current 已包含最新用户消息
  const triggerAI = useCallback(() => {
    const aiMsgId = String(nextId())
    const aiMsg = { role: 'assistant', id: aiMsgId, content: '', status: 'loading', createAt: Date.now() }

    // 用 ref 里最新 chats 构建 API messages（已含用户消息）
    const apiMessages = toApiMessages(chatsRef.current)

    const nextChats = [...chatsRef.current, aiMsg]
    chatsRef.current = nextChats
    setChats(nextChats)

    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    callAiStream(apiMessages, aiMsgId, setChats, ctrl.signal)
  }, [])

  // 组件卸载时中止进行中的 SSE 流，避免对已卸载组件 setState
  useEffect(() => {
    return () => abortRef.current?.abort()
  }, [])

  // onChatsChange：Chat 组件追加用户消息后会先调这个
  const handleChatsChange = useCallback((newChats) => {
    chatsRef.current = newChats
    setChats(newChats)
  }, [])

  // onMessageSend：用户手动输入发送，此时 chatsRef 已含用户消息
  const handleSend = useCallback(() => {
    triggerAI()
  }, [triggerAI])

  // onHintClick：点击提示词，Chat 也会先走 onChatsChange 追加用户消息
  const handleHintClick = useCallback(() => {
    triggerAI()
  }, [triggerAI])

  return (
    <div style={{ height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column' }}>
      <Chat
        chats={chats}
        onChatsChange={handleChatsChange}
        onMessageSend={handleSend}
        roleConfig={roleConfig}
        mode="bubble"
        align="leftRight"
        hints={HINTS}
        onHintClick={handleHintClick}
        placeholder="输入消息，Enter 发送..."
        showClearContext
        style={{ flex: 1, height: '100%' }}
      />
    </div>
  )
}
