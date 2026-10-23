import { describe, expect, it } from 'vitest'
import { buildSpouseNamesByPersonId, formatPersonPickerLabel } from './personLabels'
import type { Partnership, Person } from '../types/domain'

function person(id: string, first: string, last: string): Person {
  return {
    id,
    first_name: first,
    last_name: last,
    gender: 'U',
    birth_date: null,
    death_date: null,
    biography: null,
    photo_path: null,
    created_at: '',
    updated_at: '',
  }
}

describe('personLabels', () => {
  it('maps spouses both ways', () => {
    const people = [person('a', 'Ram', 'Sharma'), person('b', 'Sita', 'Sharma')]
    const partnerships: Partnership[] = [
      { id: 'p1', person_a_id: 'a', person_b_id: 'b' },
    ]
    const map = buildSpouseNamesByPersonId(people, partnerships)
    expect(map.get('a')).toEqual(['Sita Sharma'])
    expect(map.get('b')).toEqual(['Ram Sharma'])
  })

  it('includes spouse in picker label', () => {
    const p = person('a', 'Ram', 'Sharma')
    expect(formatPersonPickerLabel(p, ['Sita Sharma'], { includeDates: false })).toBe(
      'Ram Sharma · spouse: Sita Sharma',
    )
  })
})
