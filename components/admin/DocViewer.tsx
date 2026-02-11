'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MermaidDiagram from './MermaidDiagram'

interface DocViewerProps {
  content: string
}

export default function DocViewer({ content }: DocViewerProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const code = String(children).replace(/\n$/, '')
          if (match?.[1] === 'mermaid') {
            return <MermaidDiagram code={code} />
          }
          return (
            <code
              className={className}
              {...props}
            >
              {children}
            </code>
          )
        },
        // Style headings for readability
        h1: ({ children }) => (
          <h1 className="mb-4 mt-8 border-b border-gray-800 pb-2 text-3xl font-bold text-white first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-3 mt-8 text-xl font-bold text-white">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-2 mt-4 text-lg font-semibold text-gray-200">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-gray-300 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-6 list-disc space-y-1 text-gray-300">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-6 list-decimal space-y-1 text-gray-300">
            {children}
          </ol>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-400 underline hover:text-blue-300"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto">
            <table className="w-full border-collapse border border-gray-700 text-sm text-gray-300">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-gray-700 bg-gray-800/80 px-4 py-2 text-left font-semibold text-white">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-700 px-4 py-2">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-600 pl-4 italic text-gray-400">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-lg bg-gray-900/80 p-4 text-sm text-gray-300">
            {children}
          </pre>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
