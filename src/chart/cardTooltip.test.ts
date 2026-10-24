import { describe, expect, it } from 'vitest'
import { formatCardHoverText, isDeceasedFlag } from './cardTooltip'

describe('formatCardHoverText', () => {
  it('returns null when empty', () => {
    expect(formatCardHoverText('', '')).toBeNull()
    expect(formatCardHoverText(null, null)).toBeNull()
  })

  it('shows aliases and biography', () => {
    expect(formatCardHoverText('Bobby', 'Loved music.')).toBe(
      'Also known as: Bobby\n\nLoved music.',
    )
    expect(formatCardHoverText(['Bobby', 'Rob'], null)).toBe(
      'Also known as: Bobby, Rob',
    )
  })
})

describe('isDeceasedFlag', () => {
  it('detects deceased from flag or death date', () => {
    expect(isDeceasedFlag({ deceased: true })).toBe(true)
    expect(isDeceasedFlag({ death: '1990-01-01' })).toBe(true)
    expect(isDeceasedFlag({ death_date: '1990-01-01' })).toBe(true)
    expect(isDeceasedFlag({ deceased: false, death: '' })).toBe(false)
  })
})
