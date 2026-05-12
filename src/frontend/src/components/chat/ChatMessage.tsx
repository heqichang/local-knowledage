import { useState, type FC } from 'react'
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

interface CodeBlockProps {
  children: React.ReactNode
  className?: string
}

const CodeBlock: FC<CodeBlockProps> = ({ children, className }) => {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className || '')
  const language = match ? match[1] : 'code'
  
  const handleCopy = () => {
    let textToCopy = ''
    if (children && typeof children === 'object' && 'props' in (children as object)) {
      const props = (children as { props?: { children?: string } }).props
      if (props?.children) {
        textToCopy = props.children
      }
    }
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy).catch((err) => {
        console.error('Failed to copy:', err)
      })
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  return (
    <div className="mb-4 rounded-lg overflow-hidden bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 border-b border-gray-200">
        <span className="text-xs text-gray-500 font-mono">{language}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto">
        {children}
      </pre>
    </div>
  )
}

const ChatMessage: FC<ChatMessageProps> = ({
  role,
  content,
  references,
  isStreaming,
  expandedReferences,
  onToggleReferences,
}) => {
  const isUser = role === 'user'

  const assistantMarkdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="text-2xl font-bold mb-4 mt-6 text-gray-900">{children}</h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="text-xl font-semibold mt-5 mb-2.5 text-gray-800">{children}</h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="text-lg font-medium mt-4 mb-2 text-gray-800">{children}</h3>
    ),
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="mb-4 leading-relaxed text-gray-700">{children}</p>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-6 mb-4 text-gray-700">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-6 mb-4 text-gray-700">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => <li className="mb-1">{children}</li>,
    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
      <a
        href={href}
        className="text-blue-600 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    blockquote: ({ children }: { children?: React.ReactNode }) => (
      <blockquote className="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic">
        {children}
      </blockquote>
    ),
    code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
      const match = /language-(\w+)/.exec(className || '')
      const isInline = !match
      return isInline ? (
        <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono text-pink-600">
          {children}
        </code>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      )
    },
    pre: ({ children, className }: { children?: React.ReactNode; className?: string }) => (
      <CodeBlock className={className}>{children}</CodeBlock>
    ),
    table: ({ children }: { children?: React.ReactNode }) => (
      <div className="overflow-x-auto mb-4">
        <table className="min-w-full divide-y divide-gray-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }: { children?: React.ReactNode }) => <thead className="bg-gray-50">{children}</thead>,
    th: ({ children }: { children?: React.ReactNode }) => (
      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
        {children}
      </th>
    ),
    tbody: ({ children }: { children?: React.ReactNode }) => (
      <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>
    ),
    td: ({ children }: { children?: React.ReactNode }) => (
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
        {children}
      </td>
    ),
    hr: () => <hr className="my-6 border-gray-200" />,
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <div className="rounded-2xl px-5 py-4 text-sm leading-relaxed bg-blue-600 text-white whitespace-pre-wrap">
            {content}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start">
      <div className="w-full">
        <div className="text-sm leading-relaxed text-gray-800">
          {content ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
              components={assistantMarkdownComponents}
            >
              {content}
            </ReactMarkdown>
          ) : null}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 ml-1 bg-gray-400 animate-pulse" />
          )}
        </div>

        {references && references.length > 0 && (
          <div className="mt-4">
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
      </div>
    </div>
  )
}

export default ChatMessage
