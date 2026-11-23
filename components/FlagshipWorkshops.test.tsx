import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import FlagshipWorkshops, { flagshipWorkshops } from './FlagshipWorkshops'

describe('FlagshipWorkshops', () => {
  it('shows the current Accelerated and Agentified workshop destinations', () => {
    render(<FlagshipWorkshops />)

    expect(screen.getByRole('heading', { name: 'Flagship workshops' })).toBeInTheDocument()

    for (const workshop of flagshipWorkshops) {
      const card = screen.getByRole('heading', { name: workshop.title }).closest('article')
      expect(card).not.toBeNull()
      const imageSrc = within(card!).getByRole('img', { name: workshop.imageAlt }).getAttribute('src') || ''
      expect(decodeURIComponent(imageSrc)).toContain(workshop.image)
      expect(within(card!).getByRole('link', { name: new RegExp(workshop.cta, 'i') })).toHaveAttribute('href', workshop.href)
    }
  })

  it('uses raster landing-page artwork rather than legacy concept SVGs', () => {
    for (const workshop of flagshipWorkshops) {
      expect(workshop.image.endsWith('.svg')).toBe(false)
    }
  })
})
