import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { Activity } from 'lucide-react'

import AdminMetricCard from './AdminMetricCard'

describe('AdminMetricCard', () => {
  afterEach(cleanup)

  it('renders actionable metrics as keyboard-focusable semantic links', () => {
    render(<AdminMetricCard label="Collectors" value="4/5" icon={Activity} href="#source-run-history" description="Open run history" />)
    const metric = screen.getByRole('link', { name: 'Collectors: 4/5. Open run history' })
    expect(metric).toHaveAttribute('href', '#source-run-history')
    metric.focus()
    expect(metric).toHaveFocus()
    expect(metric).toHaveClass('admin-console-interactive', 'focus-visible:ring-accent')
  })

  it('renders metrics without destinations as visibly non-interactive summaries', () => {
    render(<AdminMetricCard label="Reply Rate" value="42%" />)
    const metric = screen.getByLabelText('Reply Rate: 42%. Summary only')
    expect(metric).toHaveAttribute('data-interactive', 'false')
    expect(metric).toHaveTextContent('Summary only')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
