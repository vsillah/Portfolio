import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TRAJECTORY_TARGET_SCORE, type TrajectoryPoint } from '@/lib/assessment-scoring'
import TrajectoryChart from './TrajectoryChart'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => (
    <div data-testid="line-chart">{children}</div>
  ),
  ReferenceLine: ({
    x,
    y,
    label,
  }: {
    x?: string
    y?: number
    label?: { value?: string }
  }) => (
    <div
      data-testid="reference-line"
      data-x={x}
      data-y={y}
      data-label={label?.value}
    />
  ),
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}))

const trajectory: TrajectoryPoint[] = [
  {
    date: '2026-07-01T00:00:00.000Z',
    overallScore: 57,
    isProjected: false,
  },
  {
    date: '2026-07-18T00:00:00.000Z',
    overallScore: 57,
    isProjected: false,
    isCurrent: true,
    label: 'Current status check',
  },
  {
    date: '2026-08-01T00:00:00.000Z',
    overallScore: 66,
    isProjected: true,
    label: 'Projected completion',
  },
]

describe('TrajectoryChart', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state without fetching when initial data is empty', () => {
    render(<TrajectoryChart token="dashboard-token" initialData={[]} />)

    expect(screen.getByText('Complete tasks to see your progress trajectory.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('renders the shared target and UTC-formatted Today marker', () => {
    render(<TrajectoryChart token="dashboard-token" initialData={trajectory} />)

    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getByTestId('reference-line')).toHaveAttribute(
      'data-y',
      String(TRAJECTORY_TARGET_SCORE)
    )
    expect(screen.getByTestId('reference-line')).toHaveAttribute('data-label', 'Target')
    expect(screen.getAllByTestId('reference-line')[1]).toHaveAttribute('data-x', 'Jul 18')
    expect(screen.getAllByTestId('reference-line')[1]).toHaveAttribute('data-label', 'Today')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads trajectory data from the token-scoped API when initial data is omitted', async () => {
    vi.mocked(fetch).mockResolvedValue({
      json: async () => ({ trajectory }),
    } as Response)

    render(<TrajectoryChart token="dashboard-token" />)

    expect(await screen.findByTestId('line-chart')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/api/client/dashboard/dashboard-token/trajectory')
  })

  it('falls back to the empty state when the trajectory request fails', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network unavailable'))

    render(<TrajectoryChart token="dashboard-token" />)

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(screen.getByText('Complete tasks to see your progress trajectory.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })
})
