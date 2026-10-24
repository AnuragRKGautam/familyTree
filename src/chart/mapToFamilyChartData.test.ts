import { describe, expect, it } from 'vitest'
import { displayName, mapToFamilyChartData } from './mapToFamilyChartData'
import type { TreePayload } from '../types/domain'

const sample: TreePayload = {
  people: [
    {
      id: 'p1',
      first_name: 'Helen',
      last_name: 'Rivera',
      gender: 'F',
      birth_date: '1948-03-12',
      death_date: null,
      biography: null,
      photo_path: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'p2',
      first_name: 'Arthur',
      last_name: 'Rivera',
      gender: 'M',
      birth_date: '1946-09-01',
      death_date: null,
      biography: null,
      photo_path: null,
      created_at: '',
      updated_at: '',
    },
    {
      id: 'c1',
      first_name: 'Luis',
      last_name: 'Rivera',
      gender: 'U',
      birth_date: null,
      death_date: null,
      biography: null,
      photo_path: null,
      created_at: '',
      updated_at: '',
    },
  ],
  aliases: [],
  partnerships: [{ id: 'r1', person_a_id: 'p1', person_b_id: 'p2' }],
  parentChildren: [
    { id: 'e1', parent_id: 'p1', child_id: 'c1', sort_order: null },
    { id: 'e2', parent_id: 'p2', child_id: 'c1', sort_order: null },
  ],
}

describe('mapToFamilyChartData', () => {
  it('builds bidirectional parents, children, and spouses', () => {
    const data = mapToFamilyChartData(sample)
    const byId = Object.fromEntries(data.map((d) => [d.id, d]))

    expect(byId.p1?.rels.spouses).toContain('p2')
    expect(byId.p2?.rels.spouses).toContain('p1')
    expect(byId.p1?.rels.children).toContain('c1')
    expect(byId.p2?.rels.children).toContain('c1')
    expect(byId.c1?.rels.parents).toEqual(expect.arrayContaining(['p1', 'p2']))
    expect(byId.p1?.data.gender).toBe('F')
    expect(byId.c1?.data.gender).toBe('M') // unknown maps to M for chart
    expect(byId.p1?.data['first name']).toBe('Helen')
  })

  it('formats display names', () => {
    expect(displayName('Helen', 'Rivera')).toBe('Helen Rivera')
  })
})
