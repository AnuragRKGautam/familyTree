import type { Gender, Person, PersonWriteInput } from '../types/domain'
import { DataAccessError } from './errors'
import {
  addParentChild,
  addPartnership,
  createPerson,
} from './people'

export interface FamilyChildInput {
  first_name: string
  last_name: string
  gender: Gender
  birth_date?: string | null
  /** Optional new spouse for this child. */
  spouse_first_name?: string
  spouse_last_name?: string
  spouse_gender?: Gender
}

export interface FamilyHouseholdInput {
  primary: PersonWriteInput
  partnerId: string
  children: FamilyChildInput[]
}

export interface CreatedFamilyPerson {
  id: string
  first_name: string
  last_name: string
  role: 'primary' | 'child' | 'child_spouse'
}

export interface FamilyHouseholdResult {
  primaryId: string
  partnerId: string
  childIds: string[]
  created: CreatedFamilyPerson[]
}

export interface FamilyHouseholdPartialError extends Error {
  name: 'FamilyHouseholdPartialError'
  failedStep: string
  created: CreatedFamilyPerson[]
  cause?: unknown
}

export function isFamilyHouseholdPartialError(
  err: unknown,
): err is FamilyHouseholdPartialError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: string }).name === 'FamilyHouseholdPartialError'
  )
}

export interface FamilyHouseholdDeps {
  createPerson: (input: PersonWriteInput) => Promise<Person>
  addPartnership: (a: string, b: string) => Promise<void>
  addParentChild: (parentId: string, childId: string, sortOrder?: number) => Promise<void>
}

const defaultDeps: FamilyHouseholdDeps = {
  createPerson,
  addPartnership,
  addParentChild,
}

function personLabel(p: { first_name: string; last_name: string }): string {
  return `${p.first_name} ${p.last_name}`.trim()
}

function requireName(first: string, last: string, label: string): void {
  if (!first.trim() || !last.trim()) {
    throw new DataAccessError(`${label} needs a first and last name`)
  }
}

/**
 * Create a new person, link an existing partner, then create children (and optional
 * new spouses) with both parents. Child list order becomes sort_order (0 = leftmost).
 */
export async function saveFamilyHousehold(
  input: FamilyHouseholdInput,
  deps: FamilyHouseholdDeps = defaultDeps,
): Promise<FamilyHouseholdResult> {
  requireName(input.primary.first_name, input.primary.last_name, 'Primary person')
  if (!input.partnerId.trim()) {
    throw new DataAccessError('Select an existing partner before saving')
  }

  const created: CreatedFamilyPerson[] = []
  const childIds: string[] = []

  function fail(step: string, cause: unknown): never {
    const message =
      cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : 'Save failed'
    const err = new Error(message) as FamilyHouseholdPartialError
    err.name = 'FamilyHouseholdPartialError'
    err.failedStep = step
    err.created = [...created]
    err.cause = cause
    throw err
  }

  let primary: Person
  try {
    primary = await deps.createPerson({
      ...input.primary,
      first_name: input.primary.first_name.trim(),
      last_name: input.primary.last_name.trim(),
      birth_date: input.primary.birth_date || null,
      death_date: input.primary.death_date || null,
      biography: input.primary.biography ?? null,
      aliases: input.primary.aliases ?? [],
    })
  } catch (e) {
    fail('Creating primary person', e)
  }
  created.push({
    id: primary.id,
    first_name: primary.first_name,
    last_name: primary.last_name,
    role: 'primary',
  })

  try {
    await deps.addPartnership(primary.id, input.partnerId)
  } catch (e) {
    fail(`Linking partner to ${personLabel(primary)}`, e)
  }

  for (let i = 0; i < input.children.length; i++) {
    const row = input.children[i]
    if (!row) continue
    requireName(row.first_name, row.last_name, `Child ${i + 1}`)

    let child: Person
    try {
      child = await deps.createPerson({
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        gender: row.gender,
        birth_date: row.birth_date || null,
      })
    } catch (e) {
      fail(`Creating child ${i + 1} (${row.first_name.trim()} ${row.last_name.trim()})`, e)
    }
    created.push({
      id: child.id,
      first_name: child.first_name,
      last_name: child.last_name,
      role: 'child',
    })
    childIds.push(child.id)

    try {
      await deps.addParentChild(primary.id, child.id, i)
    } catch (e) {
      fail(`Linking ${personLabel(child)} as child of ${personLabel(primary)}`, e)
    }
    try {
      await deps.addParentChild(input.partnerId, child.id, i)
    } catch (e) {
      fail(`Linking ${personLabel(child)} as child of the selected partner`, e)
    }

    const sf = (row.spouse_first_name ?? '').trim()
    const sl = (row.spouse_last_name ?? '').trim()
    if (sf || sl) {
      if (!sf || !sl) {
        fail(
          `Child ${i + 1} spouse needs both first and last name (or leave both blank)`,
          new DataAccessError('Incomplete spouse name'),
        )
      }
      let spouse: Person
      try {
        spouse = await deps.createPerson({
          first_name: sf,
          last_name: sl,
          gender: row.spouse_gender ?? 'U',
        })
      } catch (e) {
        fail(`Creating spouse for ${personLabel(child)}`, e)
      }
      created.push({
        id: spouse.id,
        first_name: spouse.first_name,
        last_name: spouse.last_name,
        role: 'child_spouse',
      })
      try {
        await deps.addPartnership(child.id, spouse.id)
      } catch (e) {
        fail(`Linking spouse to ${personLabel(child)}`, e)
      }
    }
  }

  return {
    primaryId: primary.id,
    partnerId: input.partnerId,
    childIds,
    created,
  }
}
