import type { Data } from 'family-chart'
import type { TreePayload } from '../types/domain'
import { compareBirthdays } from './sortChildrenByBirthday'

type GenderCode = 'M' | 'F'

function toChartGender(gender: string): GenderCode {
  if (gender === 'F') return 'F'
  return 'M'
}

/**
 * Maps app domain rows into the documented family-chart Data format.
 * Relationships are written bidirectionally as required by the library docs.
 * Each parent's children list is ordered oldest → youngest by birth date.
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
    person.rels.children.sort((aId, bId) => {
      const a = byId.get(aId)
      const b = byId.get(bId)
      const byDate = compareBirthdays(a?.data.birthday, b?.data.birthday)
      if (byDate !== 0) return byDate
      return aId.localeCompare(bId)
    })
  }

  return [...byId.values()] as Data
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim()
}
