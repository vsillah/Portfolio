'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { rehypeH2Index } from '@/lib/rehype-h2-index'
import MermaidDiagram from './MermaidDiagram'
import BackToTopLink from './BackToTopLink'

interface DocViewerProps {
  content: string
  /** When set, render a "Back to top" link at the end of each section (before each h2 except the first two). */
  topAnchorId?: string
}

export default function DocViewer({ content, topAnchorId }: DocViewerProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeH2Index]}
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
        h1: ({ children }) => (
          <h1 className="font-premium mb-4 mt-8 border-b border-radiant-gold/20 pb-2 text-3xl font-bold text-platinum-white first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children, node }) => {
          const h2Index = (node?.properties?.dataH2Index as number | undefined) ?? 0
          const id = (node?.properties?.id as string | undefined) ?? undefined
          const showBackToTop = topAnchorId && h2Index >= 2
          return (
            <div className="help-section">
              {showBackToTop && (
                <div className="mt-6 mb-2">
                  <BackToTopLink anchorId={topAnchorId!} />
                </div>
              )}
              <h2 id={id} className="font-premium mb-3 mt-8 text-xl font-bold text-platinum-white">
                {children}
              </h2>
            </div>
          )
        },
        h3: ({ children }) => (
          <h3 className="font-premium mb-2 mt-4 text-lg font-semibold text-platinum-white/90">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mb-3 text-platinum-white/70 leading-relaxed font-body">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="mb-4 ml-6 list-disc space-y-1 text-platinum-white/70 font-body">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="mb-4 ml-6 list-decimal space-y-1 text-platinum-white/70 font-body">
            {children}
          </ol>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-radiant-gold underline hover:text-gold-light transition-colors"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
          >
            {children}
          </a>
        ),
        table: ({ children }) => (
          <div className="my-6 overflow-x-auto rounded-xl border border-radiant-gold/10">
            <table className="w-full border-collapse text-sm text-platinum-white/80 font-body">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border border-radiant-gold/10 bg-silicon-slate/30 px-4 py-2 text-left font-heading font-semibold text-platinum-white text-[10px] uppercase tracking-widest">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-radiant-gold/10 px-4 py-2">{children}</td>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-radiant-gold/40 pl-4 italic text-platinum-white/60 font-body">
            {children}
          </blockquote>
        ),
        pre: ({ children }) => (
          <pre className="mb-4 overflow-x-auto rounded-xl bg-silicon-slate/30 border border-radiant-gold/10 p-4 text-sm text-platinum-white/80 font-body">
            {children}
          </pre>
        ),
        hr: () => <hr className="my-8 border-t border-radiant-gold/10" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
