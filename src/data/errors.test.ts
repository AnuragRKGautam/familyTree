import { describe, expect, it } from 'vitest'
import { DataAccessError, toDataAccessError } from './errors'

describe('toDataAccessError', () => {
  it('preserves DataAccessError instances', () => {
    const original = new DataAccessError('denied', 'permission_denied')
    expect(toDataAccessError(original, 'fallback')).toBe(original)
  })

  it('maps unknown values to a fallback', () => {
    const err = toDataAccessError(null, 'fallback')
    expect(err).toBeInstanceOf(DataAccessError)
    expect(err.message).toBe('fallback')
  })
})
