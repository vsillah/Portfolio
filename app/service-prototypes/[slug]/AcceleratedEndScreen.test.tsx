import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AcceleratedLearningPlan, lessons } from './AcceleratedLearningPlan'
import bindings from '@/lib/accelerated-end-screen-bindings.json'

const seconds = (clock: string) => clock.split(':').map(Number).reduce((total, part) => total * 60 + part, 0)

describe('Accelerated lesson endings', () => {
  it.each(bindings.lessons.map((item, index) => [item.lessonId, seconds(item.finalCaptionEnd), bindings.lessons[index + 1]?.lessonId ?? null] as const))('%s shows its bound ending and clears it on seek back', (id, duration, next) => {
    render(<AcceleratedLearningPlan />)
    if (id !== 'L01') fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${id}:.*ready`) }))
    const video = screen.getByLabelText(`${id} ${lessons.find((item) => item.id === id)?.title} guided video`)
    Object.defineProperty(video, 'duration', { configurable: true, value: duration })
    expect(video).toHaveAttribute('controls')
    fireEvent.ended(video)
    expect(screen.getByLabelText(`${id} lesson complete`)).toBeInTheDocument()
    expect(video.parentElement).toHaveAttribute('data-ended', 'true')
    if (next) {
      expect(screen.getByRole('img', { name: new RegExp(`^${next} .* lesson cover$`) })).toHaveAttribute('src', `/accelerated/posters/${next.toLowerCase()}-poster.webp`)
      expect(screen.getByRole('button', { name: new RegExp(`Continue to ${next}:`) })).toBeInTheDocument()
    } else {
      expect(screen.getByRole('link', { name: /Open the Decision File/ })).toHaveAttribute('href', '/accelerated/decision-file')
    }
    fireEvent.seeking(video)
    expect(screen.queryByLabelText(`${id} lesson complete`)).not.toBeInTheDocument()
    expect(video.parentElement).toHaveAttribute('data-ended', 'false')
  })
})
