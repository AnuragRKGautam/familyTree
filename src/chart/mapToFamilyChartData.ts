import type { Data } from 'family-chart'
import type { ParentChild, TreePayload } from '../types/domain'
import { compareBirthdays } from './sortChildrenByBirthday'

type GenderCode = 'M' | 'F'

function toChartGender(gender: string): GenderCode {
  if (gender === 'F') return 'F'
  return 'M'
}

/**
 * family-chart only supports two parents. Prefer one male + one female when
 * present; otherwise keep the first two linked parents.
 */
function pickTwoParents(
  parentIds: string[],
  byId: Map<string, { data: { gender: GenderCode } }>,
): string[] {
  if (parentIds.length <= 2) return parentIds
  const male = parentIds.find((id) => byId.get(id)?.data.gender === 'M')
  const female = parentIds.find((id) => byId.get(id)?.data.gender === 'F')
  if (male && female) return [male, female]
  return parentIds.slice(0, 2)
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
  const aliasesByPerson = new Map<string, string[]>()
  for (const row of payload.aliases) {
    const list = aliasesByPerson.get(row.person_id) ?? []
    if (!list.includes(row.alias)) list.push(row.alias)
    aliasesByPerson.set(row.person_id, list)
  }

  const byId = new Map(
    payload.people.map((p) => {
      const aliases = aliasesByPerson.get(p.id) ?? []
      const deceased =
        p.is_deceased === true ||
        (typeof p.death_date === 'string' && p.death_date.trim().length > 0)
      return [
        p.id,
        {
          id: p.id,
          data: {
            gender: toChartGender(p.gender),
            'first name': p.first_name,
            'last name': p.last_name,
            birthday: p.birth_date ?? '',
            death: p.death_date ?? '',
            deceased,
            aliases: aliases.join(', '),
            biography: p.biography ?? '',
          },
          rels: {
            parents: [] as string[],
            spouses: [] as string[],
            children: [] as string[],
          },
        },
      ] as const
    }),
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

  // family-chart crashes if any child has more than two parents ("child has more
  // than 1 parent" inside createRelsToAdd). Cap to two and drop extras from both sides.
  for (const person of byId.values()) {
    if (person.rels.parents.length <= 2) continue
    const kept = pickTwoParents(person.rels.parents, byId)
    const dropped = person.rels.parents.filter((id) => !kept.includes(id))
    person.rels.parents = kept
    for (const parentId of dropped) {
      const parent = byId.get(parentId)
      if (!parent) continue
      parent.rels.children = parent.rels.children.filter((id) => id !== person.id)
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

  // Partners who share children must use the same left→right order. Otherwise the
  // chart follows birthday order under the co-parent when only one parent was
  // reordered (family-chart hangs kids under whichever parent is on the path).
  for (const edge of payload.partnerships) {
    const a = byId.get(edge.person_a_id)
    const b = byId.get(edge.person_b_id)
    if (!a || !b) continue
    const shared = a.rels.children.filter((id) => b.rels.children.includes(id))
    if (shared.length < 2) continue

    const orderedCount = (parentId: string) =>
      payload.parentChildren.filter(
        (e) =>
          e.parent_id === parentId &&
          shared.includes(e.child_id) &&
          typeof e.sort_order === 'number',
      ).length

    const primaryId =
      orderedCount(a.id) >= orderedCount(b.id) ? a.id : b.id
    const orderedShared = [...shared].sort((x, y) =>
      compareChildrenForParent(x, y, primaryId, payload.parentChildren, birthdayById),
    )

    for (const person of [a, b]) {
      const exclusive = person.rels.children.filter((id) => !shared.includes(id))
      const merged: string[] = []
      let sharedPlaced = false
      for (const id of person.rels.children) {
        if (shared.includes(id)) {
          if (!sharedPlaced) {
            merged.push(...orderedShared)
            sharedPlaced = true
          }
        } else {
          merged.push(id)
        }
      }
      if (!sharedPlaced) merged.push(...orderedShared)
      // Keep exclusive kids that weren't visited (shouldn't happen) at the end.
      for (const id of exclusive) {
        if (!merged.includes(id)) merged.push(id)
      }
      person.rels.children = merged
    }
  }

  return [...byId.values()] as Data
}

export function displayName(first: string, last: string): string {
  return `${first} ${last}`.trim()
}
