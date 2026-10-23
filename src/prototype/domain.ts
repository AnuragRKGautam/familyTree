/** Application domain for the local chart prototype. No family-chart types here. */

export type Gender = 'female' | 'male' | 'unknown'

export type ParentageKind = 'biological' | 'adoptive'

export interface Person {
  id: string
  firstName: string
  lastName: string
  gender: Gender
  birthYear: number | null
  deathYear: number | null
  biography: string
  /** Alternate names for search */
  aliases: string[]
}

export interface Partnership {
  id: string
  personAId: string
  personBId: string
  note?: string
}

export interface ParentChild {
  id: string
  parentId: string
  childId: string
  kind: ParentageKind
}

export interface FamilyGraph {
  people: Person[]
  partnerships: Partnership[]
  parentChildren: ParentChild[]
}

export interface PersonView {
  person: Person
  partners: Person[]
  parents: Array<{ person: Person; kind: ParentageKind }>
  children: Array<{ person: Person; kind: ParentageKind }>
}
