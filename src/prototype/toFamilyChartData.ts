import type { Data } from 'family-chart'
import type { FamilyGraph, Gender, ParentChild, ParentageKind } from './domain'

/**
 * Translates our domain FamilyGraph into family-chart's Data format.
 * Callers outside this module should never construct library rels objects.
 *
 * Mapping notes:
 * - family-chart (with single-parent empty cards) expects at most **two**
 *   parents per child. Extra parent links are omitted from the chart payload
 *   (see preferParentsForChart). Profile UI still shows full domain links.
 * - Adoptive vs biological is not visually distinct in the free chart.
 * - Partnerships become bidirectional spouses.
 * - Gender unknown maps to 'M' because the library only accepts 'M' | 'F'.
 */
export function toFamilyChartData(graph: FamilyGraph): Data {
  const nodes = new Map(
    graph.people.map((person) => [
      person.id,
      {
        id: person.id,
        data: {
          gender: toChartGender(person.gender),
          'first name': person.firstName,
          'last name': person.lastName,
          birthday: person.birthYear != null ? String(person.birthYear) : '',
        },
        rels: {
          parents: [] as string[],
          spouses: [] as string[],
          children: [] as string[],
        },
      },
    ]),
  )

  const byChild = new Map<string, ParentChild[]>()
  for (const edge of graph.parentChildren) {
    const list = byChild.get(edge.childId) ?? []
    list.push(edge)
    byChild.set(edge.childId, list)
  }

  for (const [childId, edges] of byChild) {
    const chosen = preferParentsForChart(edges)
    for (const edge of chosen) {
      const parent = nodes.get(edge.parentId)
      const child = nodes.get(childId)
      if (!parent || !child) continue
      if (!parent.rels.children.includes(childId)) {
        parent.rels.children.push(childId)
      }
      if (!child.rels.parents.includes(edge.parentId)) {
        child.rels.parents.push(edge.parentId)
      }
    }
  }

  for (const edge of graph.partnerships) {
    const a = nodes.get(edge.personAId)
    const b = nodes.get(edge.personBId)
    if (!a || !b) continue
    if (!a.rels.spouses.includes(edge.personBId)) a.rels.spouses.push(edge.personBId)
    if (!b.rels.spouses.includes(edge.personAId)) b.rels.spouses.push(edge.personAId)
  }

  return [...nodes.values()] as Data
}

/**
 * Pick up to two parent edges for the chart.
 * Prefer a full adoptive pair when present; otherwise biological; never >2.
 */
export function preferParentsForChart(edges: ParentChild[]): ParentChild[] {
  const adoptive = edges.filter((e) => e.kind === 'adoptive')
  const biological = edges.filter((e) => e.kind === 'biological')

  if (adoptive.length >= 2) return adoptive.slice(0, 2)
  if (adoptive.length === 1) {
    const extras = biological.slice(0, 1)
    return [...adoptive, ...extras].slice(0, 2)
  }
  return biological.slice(0, 2)
}

export function parentKindsOnChart(edges: ParentChild[]): ParentageKind[] {
  return preferParentsForChart(edges).map((e) => e.kind)
}

function toChartGender(gender: Gender): 'M' | 'F' {
  if (gender === 'female') return 'F'
  return 'M'
}
