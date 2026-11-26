import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { commonsEconomyTransport } from './generated/commons-economy-envelope.generated'
import { commonsEconomyPhotoStory, type PhotoStory } from './photo-story'
import { envelopeFor, syntheticModel } from './synthetic-envelope.test-fixture'

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => <a href={href} {...props}>{children}</a>,
}))

const envelope = envelopeFor(syntheticModel())
vi.mock('./adapter', async original => {
  const actual = await original<typeof import('./adapter')>()
  return { ...actual, adaptEconomyEnvelope: (input: unknown) => actual.adaptEconomyEnvelope(input, { acceptedPayloadSha256: envelope.payloadSha256 }) }
})
const { default: CommonsEconomyMap } = await import('./CommonsEconomyMap')

/* The accepted frames, as converted by the coordinating lane. A changed or swapped file fails here before it reaches the page. */
const accepted: Record<string, string> = {
  'meal-1': '210c2e50795c3fd1569f3e19aa01101af4e9862bdb9e8acb27b0a4fe72cf1c84',
  'meal-2': '771771df433712db410ca2e4df637edbd51cb11b97cf1c5add565212954e4bad',
  'meal-3': '120a064cd54c3781dc0c92677d788ec10cd63be3654871497db7e6a7a04f2c7b',
  'meal-4': '7e12d9a905dde92649ccc74ff004e4ea2c1f3ff181717477097fdd760a4a51b4',
  'dollar-1': '3027f55944ff7d4e06b30d575bd5c2d86f5174f7a715fd0cb90e80d5536c8ff8',
  'dollar-2': '894d5c627341f7e7dea7e3adc5ca3e8ddfd47ea679fc2912e340f8cf6663d7d0',
  'dollar-3': 'b203562c3ba6a901758fd976a5cb5b50dd4197cbc8ade6344380a94c305ccbad',
  'dollar-4': '0a69e5303398d9e9c2b05d4bab13a7c4b1878390f55c16263cf16e11e713e853',
  'vote-1': 'b2c218c84bc10ce87bf0c6dab372c911851bea6772b4eb5b55526e2b938cbde9',
  'vote-2': '656a84e1d9c0c9c1de9266f890fcd4d18a6fbb28fc18aa112f356da51b1940d4',
  'vote-3': '53549e8ef60c70b9862d7b9276b105fe9777a0693c200383b0a0284ec950689b',
}

describe('Commons Economy Map photo story manifest', () => {
  const payload = JSON.parse(commonsEconomyTransport.envelope.payload) as { walkthroughs: { id: string; steps: { id: string }[] }[] }
  const stepIds = payload.walkthroughs.flatMap(walk => walk.steps.map(step => step.id))
  const dir = join(process.cwd(), 'public', 'insights', 'commons-economy-map')

  it('has exactly one frame for every transported walkthrough step, and none for anything else', () => {
    expect(stepIds.length).toBeGreaterThan(0)
    expect(Object.keys(commonsEconomyPhotoStory).sort()).toEqual([...stepIds].sort())
    expect(Object.keys(accepted).sort()).toEqual([...stepIds].sort())
  })

  it('points every frame at an accepted file that exists, unchanged', () => {
    for (const id of stepIds) {
      const photo = commonsEconomyPhotoStory[id]
      expect(photo.src).toBe(`/insights/commons-economy-map/${id}.webp`)
      const file = join(dir, `${id}.webp`)
      expect(existsSync(file)).toBe(true)
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(accepted[id])
    }
    expect(readdirSync(dir).filter(name => !name.startsWith('.')).sort()).toEqual(stepIds.map(id => `${id}.webp`).sort())
  })

  it('describes every frame as staged, with meaningful alt text and no claim of real participation or adopted governance', () => {
    for (const id of stepIds) {
      const { alt, caption, position } = commonsEconomyPhotoStory[id]
      expect(alt).toMatch(/^Illustrative /)
      expect(alt.length).toBeGreaterThan(80)
      expect(alt).toMatch(/No faces? (is|are) shown\.$/)
      expect(caption).toMatch(/A staged picture: /)
      expect(caption).toMatch(/\bno\b|\bnothing\b/i)
      for (const text of [alt, caption]) expect(text).not.toMatch(/\b(resident of|real resident|was approved|were approved|has been adopted|is adopted|voted to|passed)\b/i)
      expect(position).toMatch(/^\d{1,3}% \d{1,3}%$/)
    }
    /* The printed crop of meal-3 keeps the left band, where a partial jaw sits in the source frame, off the page. */
    expect(commonsEconomyPhotoStory['meal-3'].position).toBe('100% 50%')
  })
})

describe('Commons Economy Map photo story on the page', () => {
  const photos: PhotoStory = {
    'w-1': { src: '/synthetic/one.webp', alt: 'Illustrative synthetic frame one. No face is shown.', caption: 'Synthetic picture caption one. A staged picture: no real thing.', position: '40% 50%' },
    'w-2': { src: '/synthetic/two.webp', alt: 'Illustrative synthetic frame two. No face is shown.', caption: 'Synthetic picture caption two. A staged picture: no real thing.', position: '100% 50%' },
  }
  const open = async (given?: PhotoStory) => {
    render(given ? <CommonsEconomyMap envelope={envelope} photos={given} /> : <CommonsEconomyMap envelope={envelope} />)
    await screen.findByRole('heading', { level: 2, name: 'Synthetic local A' })
  }
  const region = () => screen.getByRole('region', { name: /Synthetic walk, step \d of 2/ })

  it('prints no picture, and no placeholder, for a step that has no frame', async () => {
    await open()
    expect(document.querySelectorAll('img')).toHaveLength(0)
    expect(screen.queryByRole('heading', { level: 2, name: 'In pictures' })).toBeNull()
    cleanup()
    await open({ 'w-2': photos['w-2'] })
    expect(within(region()).queryByRole('img')).toBeNull()
  })

  it('shows the current step’s frame in the console, outside the plate and outside the polite announcement, and changes it with the step', async () => {
    await open(photos)
    const panel = within(region()).getByRole('img')
    expect(panel).toHaveAttribute('alt', photos['w-1'].alt)
    expect(panel).toHaveAttribute('src', '/synthetic/one.webp')
    expect(panel.style.objectPosition).toBe('40% 50%')
    expect(panel.closest('[aria-live]')).toBeNull()
    expect(document.querySelector('[aria-labelledby="econ-map-caption"]')!.contains(panel)).toBe(false)
    expect(within(region()).getByRole('figure', { name: /Staged picture for step 1: Synthetic picture caption one/ })).toBeInTheDocument()
    fireEvent.keyDown(region(), { key: 'ArrowRight' })
    const next = within(region()).getByRole('img')
    expect(next).toHaveAttribute('alt', photos['w-2'].alt)
    expect(next.style.objectPosition).toBe('100% 50%')
    expect(within(region()).getAllByRole('img')).toHaveLength(1)
  })

  it('prints the selected path below the plate as a captioned strip that marks the current step', async () => {
    await open(photos)
    const heading = screen.getByRole('heading', { level: 2, name: 'In pictures' })
    const figure = document.querySelector('[aria-labelledby="econ-map-caption"]')!
    expect(Boolean(figure.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
    const strip = screen.getByRole('list', { name: 'Synthetic walk in 2 staged pictures' })
    const items = within(strip).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveAttribute('aria-current', 'step')
    expect(items[1]).not.toHaveAttribute('aria-current')
    expect(within(items[0]).getByRole('img')).toHaveAttribute('alt', photos['w-1'].alt)
    expect(within(items[0]).getByText('Step 1 · Synthetic step one')).toBeInTheDocument()
    expect(within(items[1]).getByText(photos['w-2'].caption)).toBeInTheDocument()
    expect(within(heading.closest('section')!).getByText(/Every picture is staged for this page/)).toBeInTheDocument()
    for (const img of document.querySelectorAll('img')) expect(img.getAttribute('alt')!.trim().length).toBeGreaterThan(20)
    fireEvent.keyDown(region(), { key: 'End' })
    expect(within(strip).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step')
    expect(within(strip).getAllByRole('listitem')[0]).not.toHaveAttribute('aria-current')
  })
})
