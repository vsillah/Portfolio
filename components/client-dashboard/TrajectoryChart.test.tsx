import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TrajectoryPoint } from '@/lib/assessment-scoring'
import TrajectoryChart from './TrajectoryChart'

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {},
}))

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

const fetchMock = vi.fn<typeof fetch>()

describe('TrajectoryChart', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
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
    const referenceLines = screen.getAllByTestId('reference-line')
    const targetLine = referenceLines.find((line) => line.dataset.label === 'Target')
    const todayLine = referenceLines.find((line) => line.dataset.label === 'Today')

    expect(targetLine).toHaveAttribute('data-y', '90')
    expect(todayLine).toHaveAttribute('data-x', 'Jul 18')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('loads trajectory data from the token-scoped API when initial data is omitted', async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({ trajectory }),
    } as Response)

    render(<TrajectoryChart token="dashboard-token" />)

    expect(await screen.findByTestId('line-chart')).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledOnce()
    expect(fetch).toHaveBeenCalledWith('/api/client/dashboard/dashboard-token/trajectory')
  })

  it('falls back to the empty state when the trajectory request fails', async () => {
    let rejectRequest!: (error: Error) => void
    fetchMock.mockReturnValue(
      new Promise<Response>((_, reject) => {
        rejectRequest = reject
      })
    )

    render(<TrajectoryChart token="dashboard-token" />)

    await act(async () => {
      rejectRequest(new Error('network unavailable'))
    })

    expect(fetch).toHaveBeenCalledOnce()
    expect(screen.getByText('Complete tasks to see your progress trajectory.')).toBeInTheDocument()
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument()
  })
})
