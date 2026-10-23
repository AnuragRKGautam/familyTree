export type UserRole = 'viewer' | 'editor' | 'admin'

export type Gender = 'M' | 'F' | 'U'

export interface Profile {
  id: string
  email: string
  display_name: string | null
  role: UserRole
  approved: boolean
  created_at: string
  updated_at: string
}

export interface Person {
  id: string
  first_name: string
  last_name: string
  gender: Gender
  birth_date: string | null
  death_date: string | null
  biography: string | null
  photo_path: string | null
  created_at: string
  updated_at: string
}

export interface PersonAlias {
  id: string
  person_id: string
  alias: string
}

export interface Partnership {
  id: string
  person_a_id: string
  person_b_id: string
}

export interface ParentChild {
  id: string
  parent_id: string
  child_id: string
}

export interface PersonSearchResult {
  id: string
  first_name: string
  last_name: string
  matched_alias: string | null
}

export interface PersonWithRelations extends Person {
  aliases: string[]
  parent_ids: string[]
  child_ids: string[]
  partner_ids: string[]
  /** People who share at least one parent with this person. */
  sibling_ids: string[]
}

export interface TreePayload {
  people: Person[]
  aliases: PersonAlias[]
  partnerships: Partnership[]
  parentChildren: ParentChild[]
}

export interface PersonWriteInput {
  first_name: string
  last_name: string
  gender: Gender
  birth_date?: string | null
  death_date?: string | null
  biography?: string | null
  aliases?: string[]
}
