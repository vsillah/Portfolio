import { fireEvent, render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import CompactPostPreview from './CompactPostPreview'

it('discloses complete copy without losing its ending and keeps the same accessible control', () => {
  const text = `${'A useful sentence.\n'.repeat(50)}Final call to action.`
  render(<CompactPostPreview text={text} />)
  const button = screen.getByRole('button', { name: 'Read complete post' })
  const copy = document.getElementById(button.getAttribute('aria-controls')!)!
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(copy.textContent).not.toContain('Final call to action.')
  fireEvent.click(button)
  expect(copy.textContent).toBe(text)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  fireEvent.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(copy.textContent).not.toContain('Final call to action.')
})

it('shows short copy without an unnecessary disclosure', () => {
  render(<CompactPostPreview text="A short complete post." />)
  expect(screen.getByText('A short complete post.')).toBeVisible()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
})
