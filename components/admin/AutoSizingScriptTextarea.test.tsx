import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AutoSizingScriptTextarea, { syncScriptEditorHeight } from './AutoSizingScriptTextarea'

function textareaWithHeight(scrollHeight: number) {
  const textarea = document.createElement('textarea')
  Object.defineProperty(textarea, 'scrollHeight', { configurable: true, value: scrollHeight })
  return textarea
}

describe('AutoSizingScriptTextarea', () => {
  afterEach(() => vi.restoreAllMocks())

  it.each([
    { label: 'short', contentHeight: 72, expectedHeight: '144px', expectedOverflow: 'hidden' },
    { label: 'medium', contentHeight: 238, expectedHeight: '238px', expectedOverflow: 'hidden' },
    { label: 'over-cap', contentHeight: 640, expectedHeight: '320px', expectedOverflow: 'auto' },
  ])('sizes $label content within the readable minimum and active cap', ({ contentHeight, expectedHeight, expectedOverflow }) => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ minHeight: '144px', maxHeight: '320px' } as CSSStyleDeclaration)
    const textarea = textareaWithHeight(contentHeight)

    syncScriptEditorHeight(textarea)

    expect(textarea.style.height).toBe(expectedHeight)
    expect(textarea.style.overflowY).toBe(expectedOverflow)
  })

  it('resizes controlled content while preserving its accessible label and disabled state', () => {
    let contentHeight = 80
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({ minHeight: '144px', maxHeight: '320px' } as CSSStyleDeclaration)
    vi.spyOn(HTMLTextAreaElement.prototype, 'scrollHeight', 'get').mockImplementation(() => contentHeight)
    const onChange = vi.fn()
    const view = render(<label>Script<AutoSizingScriptTextarea value="Short" onChange={onChange} disabled /></label>)
    const editor = screen.getByLabelText('Script')

    expect(editor).toBeDisabled()
    expect((editor as HTMLTextAreaElement).style.height).toBe('144px')
    expect((editor as HTMLTextAreaElement).style.overflowY).toBe('hidden')

    contentHeight = 640
    view.rerender(<label>Script<AutoSizingScriptTextarea value={'Long\n'.repeat(120)} onChange={onChange} disabled /></label>)
    expect((editor as HTMLTextAreaElement).style.height).toBe('320px')
    expect((editor as HTMLTextAreaElement).style.overflowY).toBe('auto')
  })
})
