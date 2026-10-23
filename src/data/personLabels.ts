import type { Partnership, Person } from '../types/domain'

/** Map person id → spouse display names (first + last). */
export function buildSpouseNamesByPersonId(
  people: Person[],
  partnerships: Partnership[],
): Map<string, string[]> {
  const byId = new Map(people.map((p) => [p.id, p]))
  const map = new Map<string, string[]>()

  function add(personId: string, spouseName: string) {
    const list = map.get(personId) ?? []
    if (!list.includes(spouseName)) list.push(spouseName)
    map.set(personId, list)
  }

  for (const edge of partnerships) {
    const a = byId.get(edge.person_a_id)
    const b = byId.get(edge.person_b_id)
    if (!a || !b) continue
    add(a.id, `${b.first_name} ${b.last_name}`.trim())
    add(b.id, `${a.first_name} ${a.last_name}`.trim())
  }

  return map
}

export function formatPersonPickerLabel(
  person: Person,
  spouseNames: string[] | undefined,
  options?: { includeDates?: boolean },
): string {
  const includeDates = options?.includeDates !== false
  const name = `${person.first_name} ${person.last_name}`.trim()
  const dates = includeDates
    ? [person.birth_date, person.death_date].filter(Boolean).join(' – ')
    : ''
  const base = dates ? `${name} (${dates})` : name
  if (!spouseNames || spouseNames.length === 0) return base
  const spousePart =
    spouseNames.length === 1
      ? `spouse: ${spouseNames[0]}`
      : `spouses: ${spouseNames.join(', ')}`
  return `${base} · ${spousePart}`
}
