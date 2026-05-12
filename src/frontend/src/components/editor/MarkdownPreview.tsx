import { type FC } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import 'highlight.js/styles/github.css'
import 'katex/dist/katex.min.css'

interface MarkdownPreviewProps {
  content: string
}

const MarkdownPreview: FC<MarkdownPreviewProps> = ({ content }) => {
  return (
    <div className="h-full overflow-y-auto p-6 markdown-preview">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
        components={{
          h1: ({ children }) => <h1 className="text-3xl font-bold mb-4 text-gray-900">{children}</h1>,
          h2: ({ children }) => <h2 className="text-2xl font-semibold mt-6 mb-3 text-gray-800">{children}</h2>,
          h3: ({ children }) => <h3 className="text-xl font-medium mt-4 mb-2 text-gray-800">{children}</h3>,
          p: ({ children }) => <p className="mb-4 text-gray-700 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-6 mb-4 text-gray-700">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-6 mb-4 text-gray-700">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          a: ({ href, children }) => (
            <a href={href} className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 pl-4 my-4 text-gray-600 italic">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match
            return isInline ? (
              <code className="px-1.5 py-0.5 bg-gray-100 rounded text-sm text-pink-600 font-mono">
                {children}
              </code>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg overflow-x-auto">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="min-w-full divide-y divide-gray-200">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-50">{children}</thead>,
          th: ({ children }) => (
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {children}
            </th>
          ),
          tbody: ({ children }) => <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>,
          td: ({ children }) => (
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
              {children}
            </td>
          ),
          hr: () => <hr className="my-6 border-gray-200" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownPreview
