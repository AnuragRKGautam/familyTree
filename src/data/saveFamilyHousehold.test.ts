import { describe, expect, it, vi } from 'vitest'
import type { Person } from '../types/domain'
import {
  isFamilyHouseholdPartialError,
  saveFamilyHousehold,
  type FamilyHouseholdDeps,
} from './saveFamilyHousehold'

function person(partial: Partial<Person> & Pick<Person, 'id' | 'first_name' | 'last_name'>): Person {
  return {
    gender: 'U',
    birth_date: null,
    death_date: null,
    biography: null,
    photo_path: null,
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

describe('saveFamilyHousehold', () => {
  it('creates primary, links partner, creates ordered children with both parents', async () => {
    const created: string[] = []
    const partnerships: Array<[string, string]> = []
    const parentLinks: Array<[string, string, number | undefined]> = []
    let n = 0

    const deps: FamilyHouseholdDeps = {
      createPerson: vi.fn(async (input) => {
        n += 1
        const p = person({
          id: `p${n}`,
          first_name: input.first_name,
          last_name: input.last_name,
          gender: input.gender,
        })
        created.push(p.id)
        return p
      }),
      addPartnership: vi.fn(async (a, b) => {
        partnerships.push([a, b])
      }),
      addParentChild: vi.fn(async (parentId, childId, sortOrder) => {
        parentLinks.push([parentId, childId, sortOrder])
      }),
    }

    const result = await saveFamilyHousehold(
      {
        primary: { first_name: 'Ram', last_name: 'Sharma', gender: 'M' },
        partnerId: 'partner-1',
        children: [
          { first_name: 'Asha', last_name: 'Sharma', gender: 'F' },
          {
            first_name: 'Vikram',
            last_name: 'Sharma',
            gender: 'M',
            spouse_first_name: 'Meera',
            spouse_last_name: 'Sharma',
            spouse_gender: 'F',
          },
        ],
      },
      deps,
    )

    expect(result.primaryId).toBe('p1')
    expect(result.childIds).toEqual(['p2', 'p3'])
    expect(partnerships).toEqual([
      ['p1', 'partner-1'],
      ['p3', 'p4'],
    ])
    expect(parentLinks).toEqual([
      ['p1', 'p2', 0],
      ['partner-1', 'p2', 0],
      ['p1', 'p3', 1],
      ['partner-1', 'p3', 1],
    ])
    expect(result.created.map((c) => c.role)).toEqual([
      'primary',
      'child',
      'child',
      'child_spouse',
    ])
  })

  it('reports partial progress when a later step fails', async () => {
    let n = 0
    const deps: FamilyHouseholdDeps = {
      createPerson: vi.fn(async (input) => {
        n += 1
        if (n === 2) throw new Error('child create failed')
        return person({
          id: `p${n}`,
          first_name: input.first_name,
          last_name: input.last_name,
        })
      }),
      addPartnership: vi.fn(async () => undefined),
      addParentChild: vi.fn(async () => undefined),
    }

    try {
      await saveFamilyHousehold(
        {
          primary: { first_name: 'Ram', last_name: 'Sharma', gender: 'M' },
          partnerId: 'partner-1',
          children: [{ first_name: 'Asha', last_name: 'Sharma', gender: 'F' }],
        },
        deps,
      )
      expect.unreachable('should throw')
    } catch (err) {
      expect(isFamilyHouseholdPartialError(err)).toBe(true)
      if (isFamilyHouseholdPartialError(err)) {
        expect(err.created).toHaveLength(1)
        expect(err.created[0]?.role).toBe('primary')
        expect(err.failedStep).toContain('Creating child 1')
      }
    }
  })

  it('rejects missing partner', async () => {
    await expect(
      saveFamilyHousehold(
        {
          primary: { first_name: 'Ram', last_name: 'Sharma', gender: 'M' },
          partnerId: '',
          children: [],
        },
        {
          createPerson: vi.fn(),
          addPartnership: vi.fn(),
          addParentChild: vi.fn(),
        },
      ),
    ).rejects.toThrow(/partner/i)
  })
})
