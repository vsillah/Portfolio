import { render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ChatInput } from './ChatInput'
import { ChatMessage } from './ChatMessage'

vi.mock('framer-motion', () => ({
  motion: {
    button: ({
      children,
      whileHover,
      whileTap,
      ...props
    }: {
      children?: ReactNode
      whileHover?: unknown
      whileTap?: unknown
    }) => <button {...props}>{children}</button>,
    div: ({
      animate,
      children,
      initial,
      transition,
      ...props
    }: {
      animate?: unknown
      children?: ReactNode
      initial?: unknown
      transition?: unknown
    }) => <div {...props}>{children}</div>,
  },
}))

vi.mock('react-markdown', () => ({
  default: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('remark-gfm', () => ({
  default: vi.fn(),
}))

describe('Chat light-mode surfaces', () => {
  it('uses light aligned fills for the input shell and disabled send button', () => {
    render(<ChatInput onSend={vi.fn()} />)

    const inputShell = screen.getByPlaceholderText('Type your message...').parentElement
    const sendButton = screen.getByRole('button')

    expect(inputShell).toHaveClass('bg-white/[0.72]')
    expect(inputShell).toHaveClass('dark:bg-silicon-slate/20')
    expect(sendButton).toHaveClass('bg-[#121E31]/[0.08]')
    expect(sendButton).toHaveClass('dark:bg-silicon-slate/30')
  })

  it('uses light aligned fills for assistant avatar and message bubble', () => {
    const { container } = render(<ChatMessage role="assistant" content="Hello" />)

    const avatar = container.querySelector('.bg-white\\/\\[0\\.78\\]')
    const messageBubble = container.querySelector('.bg-white\\/\\[0\\.72\\]')

    expect(avatar).toBeInTheDocument()
    expect(avatar).toHaveClass('dark:bg-silicon-slate/50')
    expect(messageBubble).toBeInTheDocument()
    expect(messageBubble).toHaveClass('dark:bg-silicon-slate/30')
  })
})
