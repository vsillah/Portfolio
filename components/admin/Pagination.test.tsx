import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import Pagination from './Pagination'

describe('Pagination', () => {
  it('keeps the range label together and provides compact mobile page state', () => {
    render(
      <Pagination
        page={2}
        totalPages={6}
        total={41}
        pageSize={8}
        onPageChange={vi.fn()}
      />,
    )

    const range = screen.getByText('9–16 of 41')
    expect(range).toHaveClass('whitespace-nowrap')
    expect(range).toHaveClass('shrink-0')
    expect(screen.getByText('2/6')).toHaveClass('sm:hidden')
  })
})
