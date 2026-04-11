import { describe, expect, it } from 'vitest'
import { shouldUseMatchEmailBranch, toEmailLikePattern } from './admin-meetings-query'

describe('admin-meetings-query', () => {
  it('uses match_email branch only for allowed parameter combination', () => {
    expect(
      shouldUseMatchEmailBranch({
        matchEmail: 'lead@example.com',
        contactIdParam: null,
        unlinkedOnly: false,
        attributedOnly: false,
        q: '',
      })
    ).toBe(true)

    expect(
      shouldUseMatchEmailBranch({
        matchEmail: '',
        contactIdParam: null,
        unlinkedOnly: false,
        attributedOnly: false,
        q: '',
      })
    ).toBe(false)

    expect(
      shouldUseMatchEmailBranch({
        matchEmail: 'lead@example.com',
        contactIdParam: '42',
        unlinkedOnly: false,
        attributedOnly: false,
        q: '',
      })
    ).toBe(false)

    expect(
      shouldUseMatchEmailBranch({
        matchEmail: 'lead@example.com',
        contactIdParam: null,
        unlinkedOnly: true,
        attributedOnly: false,
        q: '',
      })
    ).toBe(false)

    expect(
      shouldUseMatchEmailBranch({
        matchEmail: 'lead@example.com',
        contactIdParam: null,
        unlinkedOnly: false,
        attributedOnly: true,
        q: '',
      })
    ).toBe(false)

    expect(
      shouldUseMatchEmailBranch({
        matchEmail: 'lead@example.com',
        contactIdParam: null,
        unlinkedOnly: false,
        attributedOnly: false,
        q: 'search',
      })
    ).toBe(false)
  })

  it('escapes wildcard and slash characters in ilike pattern', () => {
    expect(toEmailLikePattern('foo%_bar\\baz@example.com')).toBe('%foo\\%\\_bar\\\\baz@example.com%')
  })
})
