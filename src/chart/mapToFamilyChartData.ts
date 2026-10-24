import type { Data } from 'family-chart'
import type { ParentChild, TreePayload } from '../types/domain'
import { compareBirthdays } from './sortChildrenByBirthday'

type GenderCode = 'M' | 'F'

function toChartGender(gender: string): GenderCode {
  if (gender === 'F') return 'F'
  return 'M'
}

/** Compare two children under the same parent: manual sort_order, then birthday, then id. */
export function compareChildrenForParent(
  aId: string,
  bId: string,
  parentId: string,
  edges: ParentChild[],
  birthdayById: Map<string, string>,
): number {
  const edgeA = edges.find((e) => e.parent_id === parentId && e.child_id === aId)
  const edgeB = edges.find((e) => e.parent_id === parentId && e.child_id === bId)
  const orderA = edgeA?.sort_order
  const orderB = edgeB?.sort_order
  const aHas = typeof orderA === 'number'
  const bHas = typeof orderB === 'number'
  if (aHas && bHas && orderA !== orderB) return (orderA as number) - (orderB as number)
  if (aHas && !bHas) return -1
  if (!aHas && bHas) return 1
  const byDate = compareBirthdays(birthdayById.get(aId), birthdayById.get(bId))
  if (byDate !== 0) return byDate
  return aId.localeCompare(bId)
}

/**
 * Maps app domain rows into the documented family-chart Data format.
 * Relationships are written bidirectionally as required by the library docs.
 * Each parent's children list is ordered by sort_order, then oldest → youngest.
 */
export function mapToFamilyChartData(payload: TreePayload): Data {
  const byId = new Map(
    payload.people.map((p) => [
      p.id,
      {
        id: p.id,
        data: {
          gender: toChartGender(p.gender),
          'first name': p.first_name,
          'last name': p.last_name,
          birthday: p.birth_date ?? '',
        },
        rels: {
          parents: [] as string[],
          spouses: [] as string[],
          children: [] as string[],
        },
      },
    ]),
  )

  const birthdayById = new Map(
    payload.people.map((p) => [p.id, p.birth_date ?? ''] as const),
  )

  for (const edge of payload.parentChildren) {
    const parent = byId.get(edge.parent_id)
    const child = byId.get(edge.child_id)
    if (!parent || !child) continue
    if (!parent.rels.children.includes(edge.child_id)) {
      parent.rels.children.push(edge.child_id)
    }
    if (!child.rels.parents.includes(edge.parent_id)) {
      child.rels.parents.push(edge.parent_id)
    }
  }

  for (const edge of payload.partnerships) {
    const a = byId.get(edge.person_a_id)
    const b = byId.get(edge.person_b_id)
    if (!a || !b) continue
    if (!a.rels.spouses.includes(edge.person_b_id)) {
      a.rels.spouses.push(edge.person_b_id)
    }
    if (!b.rels.spouses.includes(edge.person_a_id)) {
      b.rels.spouses.push(edge.person_a_id)
    }
  }

  for (const person of byId.values()) {
    if (person.rels.children.length < 2) continue
    person.rels.children.sort((aId, bId) =>
      compareChildrenForParent(aId, bId, person.id, payload.parentChildren, birthdayById),
    )
  }

  return [...byId.values()] as Data
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim()
}
