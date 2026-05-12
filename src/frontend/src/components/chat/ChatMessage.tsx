import { type FC } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'
import type { Message, Reference } from '@/types'

interface ChatMessageProps extends Message {
  isStreaming?: boolean
  expandedReferences?: boolean
  onToggleReferences?: () => void
}

const ChatMessage: FC<ChatMessageProps> = ({
  role,
  content,
  references,
  created_at,
  isStreaming,
  expandedReferences,
  onToggleReferences,
}) => {
  const formatTime = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const isUser = role === 'user'

  const markdownComponents = {
    h1: ({ children }: { children: React.ReactNode }) => (
      <h1 className={`text-2xl font-bold mb-3 ${isUser ? 'text-white' : 'text-gray-900'}`}>{children}</h1>
    ),
    h2: ({ children }: { children: React.ReactNode }) => (
      <h2 className={`text-xl font-semibold mt-5 mb-2.5 ${isUser ? 'text-white' : 'text-gray-800'}`}>{children}</h2>
    ),
    h3: ({ children }: { children: React.ReactNode }) => (
      <h3 className={`text-lg font-medium mt-4 mb-2 ${isUser ? 'text-white' : 'text-gray-800'}`}>{children}</h3>
    ),
    p: ({ children }: { children: React.ReactNode }) => (
      <p className={`mb-3 leading-relaxed ${isUser ? 'text-white' : 'text-gray-700'}`}>{children}</p>
    ),
    ul: ({ children }: { children: React.ReactNode }) => (
      <ul className={`list-disc pl-6 mb-3 ${isUser ? 'text-white' : 'text-gray-700'}`}>{children}</ul>
    ),
    ol: ({ children }: { children: React.ReactNode }) => (
      <ol className={`list-decimal pl-6 mb-3 ${isUser ? 'text-white' : 'text-gray-700'}`}>{children}</ol>
    ),
    li: ({ children }: { children: React.ReactNode }) => <li className="mb-1">{children}</li>,
    a: ({ href, children }: { href?: string; children: React.ReactNode }) => (
      <a
        href={href}
        className={`hover:underline ${isUser ? 'text-blue-200' : 'text-blue-600'}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: { children: React.ReactNode }) => (
      <blockquote
        className={`border-l-4 pl-4 my-4 italic ${
          isUser ? 'border-blue-300 text-blue-100' : 'border-gray-300 text-gray-600'
        }`}
      >
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }: { className?: string; children: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '')
      const isInline = !match
      return isInline ? (
        <code
          className={`px-1.5 py-0.5 rounded text-sm font-mono ${
            isUser ? 'bg-blue-500 text-blue-100' : 'bg-gray-100 text-pink-600'
          }`}
        >
          {children}
        </code>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    pre: ({ children }: { children: React.ReactNode }) => (
      <pre
        className={`mb-4 p-4 rounded-lg overflow-x-auto ${
          isUser ? 'bg-blue-500 border border-blue-400' : 'bg-gray-50 border border-gray-200'
        }`}
      >
        {children}
      </pre>
    ),
    table: ({ children }: { children: React.ReactNode }) => (
      <div className="overflow-x-auto mb-4">
        <table className={`min-w-full divide-y ${isUser ? 'divide-blue-400' : 'divide-gray-200'}`}>
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children: React.ReactNode }) => (
      <thead className={isUser ? 'bg-blue-500' : 'bg-gray-50'}>{children}</thead>
    ),
    th: ({ children }: { children: React.ReactNode }) => (
      <th
        className={`px-6 py-3 text-left text-xs font-medium uppercase tracking-wider ${
          isUser ? 'text-blue-100' : 'text-gray-500'
        }`}
      >
        {children}
      </th>
    ),
    tbody: ({ children }: { children: React.ReactNode }) => (
      <tbody className={`divide-y ${isUser ? 'divide-blue-400' : 'divide-gray-200'}`}>{children}</tbody>
    ),
    td: ({ children }: { children: React.ReactNode }) => (
      <td
        className={`px-6 py-4 whitespace-nowrap text-sm ${isUser ? 'text-white' : 'text-gray-700'}`}
      >
        {children}
      </td>
    ),
    hr: () => <hr className={`my-6 ${isUser ? 'border-blue-400' : 'border-gray-200'}`} />,
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? '' : ''}`}>
        <div
          className={`rounded-2xl px-5 py-4 text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-600 text-white'
              : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
          }`}
        >
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={markdownComponents}
            >
              {content}
            </ReactMarkdown>
          ) : null}
          {isStreaming && (
            <span
              className={`inline-block w-1.5 h-4 ml-1 animate-pulse ${
                isUser ? 'bg-blue-200' : 'bg-gray-400'
              }`}
            />
          )}
        </div>

        {!isUser && references && references.length > 0 && (
          <div className="mt-2">
            <button
              onClick={onToggleReferences}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span>{expandedReferences ? '▼' : '▶'}</span>
              引用来源 ({references.length})
            </button>

            {expandedReferences && (
              <div className="mt-2 space-y-2">
                {references.map((ref: Reference, i: number) => (
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
          {formatTime(created_at)}
        </p>
      </div>
    </div>
  )
}

export default ChatMessage
