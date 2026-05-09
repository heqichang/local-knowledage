import { useState, useEffect, useRef, type FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { conversationsApi } from '@/api'
import type { Message, Reference, StreamEvent } from '@/types'

interface ChatMessage extends Message {
  isStreaming?: boolean
}

const ChatPage = () => {
  const { conversationId } = useParams<{ conversationId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const streamRef = useRef<ReturnType<typeof conversationsApi.chat> | null>(null)

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([])
  const [currentReferences, setCurrentReferences] = useState<Reference[]>([])
  const [expandedReferences, setExpandedReferences] = useState<Set<number>>(new Set())

  const convId = conversationId ? parseInt(conversationId) : undefined

  const { data: convList } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => conversationsApi.list(),
  })

  const { data: messages } = useQuery({
    queryKey: ['messages', convId],
    queryFn: () => (convId ? conversationsApi.getMessages(convId) : null),
    enabled: !!convId,
  })

  useEffect(() => {
    if (messages?.items) {
      setLocalMessages(messages.items)
    }
  }, [messages?.items])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [localMessages])

  const toggleReference = (messageId: number) => {
    setExpandedReferences((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) {
        next.delete(messageId)
      } else {
        next.add(messageId)
      }
      return next
    })
  }

  const handleNewChat = () => {
    navigate('/')
    setLocalMessages([])
  }

  const handleDeleteChat = async (id: number) => {
    await conversationsApi.delete(id)
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    if (convId === id) {
      navigate('/')
      setLocalMessages([])
    }
  }

  const handleSelectChat = (id: number) => {
    navigate(`/chat/${id}`)
  }

  const ensureConversation = async () => {
    if (convId) return convId

    const conv = await conversationsApi.create()
    navigate(`/chat/${conv.id}`, { replace: true })
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    return conv.id
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const messageText = input.trim()
    setInput('')
    setIsLoading(true)
    setCurrentReferences([])

    try {
      const id = await ensureConversation()

      const userMessage: ChatMessage = {
        id: Date.now(),
        conversation_id: id,
        role: 'user',
        content: messageText,
        created_at: new Date().toISOString(),
      }

      const assistantMessage: ChatMessage = {
        id: Date.now() + 1,
        conversation_id: id,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
        isStreaming: true,
      }

      setLocalMessages((prev) => [...prev, userMessage, assistantMessage])

      const stream = conversationsApi.chat(id, { message: messageText })
      streamRef.current = stream

      let fullContent = ''

      for await (const event of stream as unknown as AsyncIterable<StreamEvent>) {
        if (event.type === 'references') {
          const refs = event.data as Reference[]
          setCurrentReferences(refs)
        } else if (event.type === 'content') {
          fullContent += event.data as string
          setLocalMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1 ? { ...m, content: fullContent } : m
            )
          )
        } else if (event.type === 'error') {
          const errorMsg = event.data as string
          setLocalMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, content: fullContent || `❌ ${errorMsg}`, isStreaming: false }
                : m
            )
          )
        } else if (event.type === 'done') {
          setLocalMessages((prev) =>
            prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, isStreaming: false, references: currentReferences }
                : m
            )
          )
          break
        }
      }

      queryClient.invalidateQueries({ queryKey: ['messages', id] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    } catch (error) {
      console.error('Chat error:', error)
      setLocalMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1
            ? { ...m, isStreaming: false, content: m.content || '发送失败，请重试' }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      streamRef.current = null
    }
  }

  const formatTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="flex h-full">
      <aside className="w-72 flex flex-col border-r border-gray-200 bg-white">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={handleNewChat}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + 新建对话
          </button>
        </div>

        <div className="flex-1 overflow-auto p-3 space-y-1">
          {convList?.items.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">暂无对话</p>
          ) : (
            convList?.items.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                  convId === conv.id
                    ? 'bg-blue-50'
                    : 'hover:bg-gray-100'
                }`}
              >
                <button
                  onClick={() => handleSelectChat(conv.id)}
                  className="flex-1 text-left"
                >
                  <p className={`text-sm truncate ${
                    convId === conv.id ? 'text-blue-700 font-medium' : 'text-gray-700'
                  }`}>
                    💬 {conv.title || '新对话'}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(conv.updated_at).toLocaleDateString('zh-CN')}
                  </p>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteChat(conv.id)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs p-1 transition-opacity"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col bg-gray-50">
        {!convId && localMessages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            <div className="text-center max-w-lg">
              <h1 className="text-3xl font-semibold text-gray-800 mb-2">本地知识库助手</h1>
              <p className="text-gray-500 mb-8">基于上传的文档，智能回答您的问题</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">📚 知识问答</p>
                  <p className="text-xs text-gray-500">基于文档内容回答问题，提供引用来源</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">🔍 混合检索</p>
                  <p className="text-xs text-gray-500">语义 + 全文检索，RRF 融合排序</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">🌊 流式响应</p>
                  <p className="text-xs text-gray-500">SSE 实时流式渲染，无需等待</p>
                </div>
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">🔒 本地部署</p>
                  <p className="text-xs text-gray-500">私有化部署，数据不离开本地</p>
                </div>
              </div>

              <p className="mt-8 text-sm text-gray-400">
                输入问题开始对话，或在左侧选择历史对话
              </p>
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-gray-200 bg-white px-6 py-3">
              <h2 className="text-sm font-medium text-gray-700">
                {convId
                  ? convList?.items.find((c) => c.id === convId)?.title || '对话'
                  : '新对话'}
              </h2>
            </header>

            <div className="flex-1 overflow-auto px-4 py-6">
              <div className="max-w-3xl mx-auto space-y-6">
                {localMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">🤖</span>
                      </div>
                    )}

                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'order-first' : ''}`}>
                      <div
                        className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                        }`}
                      >
                        {msg.content}
                        {msg.isStreaming && (
                          <span className="inline-block w-1.5 h-4 bg-gray-400 ml-1 animate-pulse" />
                        )}
                      </div>

                      {msg.role === 'assistant' && msg.references && msg.references.length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleReference(msg.id)}
                            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                          >
                            <span>{expandedReferences.has(msg.id) ? '▼' : '▶'}</span>
                            引用来源 ({msg.references.length})
                          </button>

                          {expandedReferences.has(msg.id) && (
                            <div className="mt-2 space-y-2">
                              {msg.references.map((ref, i) => (
                                <div
                                  key={i}
                                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
                                >
                                  <p className="text-xs font-medium text-yellow-800 mb-1">
                                    [{i + 1}] {ref.document_filename} · 片段 #{ref.chunk_index}
                                  </p>
                                  <p className="text-xs text-yellow-900 leading-relaxed">
                                    {ref.content}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <p className="mt-1 text-xs text-gray-400">
                        {formatTime(msg.created_at)}
                      </p>
                    </div>

                    {msg.role === 'user' && (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm">👤</span>
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            </div>
          </>
        )}

        <footer className="border-t border-gray-200 bg-white px-4 py-4">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isLoading ? '正在生成回答...' : '输入您的问题...'}
                disabled={isLoading}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? '发送中...' : '发送'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-400 text-center">
              回答基于本地知识库内容，请确保已上传相关文档
            </p>
          </form>
        </footer>
      </main>
    </div>
  )
}

export default ChatPage
