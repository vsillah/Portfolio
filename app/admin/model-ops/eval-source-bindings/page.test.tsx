import { render, screen, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import EvalSourceBindingsPage from './page'

vi.mock('@/components/ProtectedRoute', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/admin/Breadcrumbs', () => ({ default: () => <nav aria-label="Breadcrumb">Model Ops</nav> }))

describe('eval source binding review page', () => {
  it('shows four blocked families and reveals audit facts on request', () => {
    render(<EvalSourceBindingsPage />)
    expect(screen.getByRole('heading', { name: 'Hosted eval source bindings' })).toBeInTheDocument()
    expect(screen.getAllByText('Blocked')).toHaveLength(4)
    expect(screen.getByText(/Current model: 4 evaluations/)).toBeInTheDocument()
    expect(screen.getByText(/Seven-record mixed-model history/)).toBeInTheDocument()
    expect(screen.getByText(/Framework approval does not equal template approval/)).toBeInTheDocument()
    const disclosures = screen.getAllByText('Audit identity and evidence')
    expect(disclosures).toHaveLength(4)
    fireEvent.click(disclosures[1])
    expect(disclosures[1].closest('details')).toHaveAttribute('open')
    expect(screen.getByText('73f377361c97ffcf0acc8b228b22624005562248068bc7f40247023642c00e40')).toBeInTheDocument()
  })
})
