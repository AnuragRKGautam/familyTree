import { describe, expect, it } from 'vitest'
import type { Data } from 'family-chart'
import { mapToFamilyChartData } from './mapToFamilyChartData'
import { compareBirthdays, sortChildrenByBirthday } from './sortChildrenByBirthday'
import type { TreePayload } from '../types/domain'

function person(
  id: string,
  first: string,
  birthday: string,
): Data[number] {
  return {
    id,
    data: { gender: 'M', 'first name': first, 'last name': 'T', birthday },
    rels: { parents: [], spouses: [], children: [] },
  }
}

describe('compareBirthdays', () => {
  it('orders older before younger', () => {
    expect(compareBirthdays('1990-01-01', '1995-06-15')).toBeLessThan(0)
    expect(compareBirthdays('2000-12-31', '1999-01-01')).toBeGreaterThan(0)
  })

  it('puts missing birthdays after known ones', () => {
    expect(compareBirthdays('', '1990-01-01')).toBeGreaterThan(0)
    expect(compareBirthdays('1990-01-01', null)).toBeLessThan(0)
  })
})

describe('sortChildrenByBirthday', () => {
  it('sorts datums oldest to youngest', () => {
    const kids = [
      person('c', 'Young', '2005-01-01'),
      person('a', 'Old', '1990-01-01'),
      person('b', 'Mid', '1998-06-01'),
    ]
    kids.sort(sortChildrenByBirthday)
    expect(kids.map((k) => k.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('mapToFamilyChartData child order', () => {
  it('orders each parent’s children oldest to youngest', () => {
    const payload: TreePayload = {
      people: [
        {
          id: 'parent',
          first_name: 'Parent',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1960-01-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'young',
          first_name: 'Young',
          last_name: 'Test',
          gender: 'F',
          birth_date: '2001-05-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'old',
          first_name: 'Old',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1995-02-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
      ],
      aliases: [],
      partnerships: [],
      parentChildren: [
        { id: 'e1', parent_id: 'parent', child_id: 'young', sort_order: null },
        { id: 'e2', parent_id: 'parent', child_id: 'old', sort_order: null },
      ],
    }
    const data = mapToFamilyChartData(payload)
    const parent = data.find((d) => d.id === 'parent')
    expect(parent?.rels.children).toEqual(['old', 'young'])
  })

  it('prefers manual sort_order over birth date', () => {
    const payload: TreePayload = {
      people: [
        {
          id: 'parent',
          first_name: 'Parent',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1960-01-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'young',
          first_name: 'Young',
          last_name: 'Test',
          gender: 'F',
          birth_date: '2001-05-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'old',
          first_name: 'Old',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1995-02-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
      ],
      aliases: [],
      partnerships: [],
      parentChildren: [
        { id: 'e1', parent_id: 'parent', child_id: 'young', sort_order: 0 },
        { id: 'e2', parent_id: 'parent', child_id: 'old', sort_order: 1 },
      ],
    }
    const data = mapToFamilyChartData(payload)
    expect(data.find((d) => d.id === 'parent')?.rels.children).toEqual(['young', 'old'])
  })

  it('copies manual order onto co-parent who has no sort_order', () => {
    const payload: TreePayload = {
      people: [
        {
          id: 'father',
          first_name: 'Father',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1960-01-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'mother',
          first_name: 'Mother',
          last_name: 'Test',
          gender: 'F',
          birth_date: '1962-01-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'young',
          first_name: 'Young',
          last_name: 'Test',
          gender: 'F',
          birth_date: '2001-05-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'old',
          first_name: 'Old',
          last_name: 'Test',
          gender: 'M',
          birth_date: '1995-02-01',
          death_date: null,
          biography: null,
          photo_path: null,
          created_at: '',
          updated_at: '',
        },
      ],
      aliases: [],
      partnerships: [{ id: 'p1', person_a_id: 'father', person_b_id: 'mother' }],
      parentChildren: [
        { id: 'e1', parent_id: 'father', child_id: 'young', sort_order: 0 },
        { id: 'e2', parent_id: 'father', child_id: 'old', sort_order: 1 },
        { id: 'e3', parent_id: 'mother', child_id: 'young', sort_order: null },
        { id: 'e4', parent_id: 'mother', child_id: 'old', sort_order: null },
      ],
    }
    const data = mapToFamilyChartData(payload)
    expect(data.find((d) => d.id === 'father')?.rels.children).toEqual(['young', 'old'])
    expect(data.find((d) => d.id === 'mother')?.rels.children).toEqual(['young', 'old'])
  })
})
