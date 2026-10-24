import { describe, expect, it } from 'vitest'
import { formatKinshipLabel, relationSentence } from './findRelation'

describe('formatKinshipLabel', () => {
  it('capitalizes kinship words', () => {
    expect(formatKinshipLabel('great-grandfather')).toBe('Great-Grandfather')
    expect(formatKinshipLabel('2nd cousin')).toBe('2nd Cousin')
  })
})

describe('relationSentence', () => {
  it('describes kinship', () => {
    expect(relationSentence('Ram', 'Sita', 'Spouse')).toBe('Sita is the spouse of Ram.')
  })

  it('handles unrelated', () => {
    expect(relationSentence('Ram', 'Ash', null)).toContain('does not appear related')
  })
})
