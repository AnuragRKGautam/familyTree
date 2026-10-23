import type { FamilyGraph, Person, PersonView } from './domain'
import { displayName } from './fictionalFamily'

export function buildPersonView(graph: FamilyGraph, personId: string): PersonView | null {
  const person = graph.people.find((p) => p.id === personId)
  if (!person) return null

  const byId = new Map(graph.people.map((p) => [p.id, p]))

  const partners = graph.partnerships
    .filter((ps) => ps.personAId === personId || ps.personBId === personId)
    .map((ps) => {
      const otherId = ps.personAId === personId ? ps.personBId : ps.personAId
      return byId.get(otherId)
    })
    .filter((p): p is Person => Boolean(p))

  const parents = graph.parentChildren
    .filter((pc) => pc.childId === personId)
    .map((pc) => {
      const parent = byId.get(pc.parentId)
      return parent ? { person: parent, kind: pc.kind } : null
    })
    .filter((row): row is { person: Person; kind: typeof graph.parentChildren[0]['kind'] } =>
      Boolean(row),
    )

  const children = graph.parentChildren
    .filter((pc) => pc.parentId === personId)
    .map((pc) => {
      const child = byId.get(pc.childId)
      return child ? { person: child, kind: pc.kind } : null
    })
    .filter((row): row is { person: Person; kind: typeof graph.parentChildren[0]['kind'] } =>
      Boolean(row),
    )

  return { person, partners, parents, children }
}

export interface SearchHit {
  id: string
  label: string
  detail: string | null
}

export function searchPeople(graph: FamilyGraph, query: string): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const hits: SearchHit[] = []
  for (const person of graph.people) {
    const name = displayName(person).toLowerCase()
    const aliasHit = person.aliases.find((a) => a.toLowerCase().includes(q))
    if (name.includes(q) || aliasHit) {
      hits.push({
        id: person.id,
        label: displayName(person),
        detail: aliasHit ? `alias: ${aliasHit}` : person.birthYear ? `b. ${person.birthYear}` : null,
      })
    }
  }
  return hits.sort((a, b) => a.label.localeCompare(b.label))
}
