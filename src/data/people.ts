import { supabase } from '../lib/supabaseClient'
import type {
  ParentChild,
  Partnership,
  Person,
  PersonAlias,
  PersonSearchResult,
  PersonWithRelations,
  PersonWriteInput,
  TreePayload,
} from '../types/domain'
import { DataAccessError, toDataAccessError } from './errors'

const PEOPLE_PUBLIC_COLUMNS =
  'id, first_name, last_name, gender, biography, photo_path, created_at, updated_at'
const PEOPLE_FULL_COLUMNS =
  'id, first_name, last_name, gender, birth_date, death_date, biography, photo_path, created_at, updated_at'

async function sessionCanReadDates(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return Boolean(session?.user)
}

async function peopleSelectColumns(): Promise<string> {
  return (await sessionCanReadDates()) ? PEOPLE_FULL_COLUMNS : PEOPLE_PUBLIC_COLUMNS
}

function mapPerson(row: Record<string, unknown>): Person {
  return {
    id: row.id as string,
    first_name: row.first_name as string,
    last_name: row.last_name as string,
    gender: row.gender as Person['gender'],
    birth_date: (row.birth_date as string | null | undefined) ?? null,
    death_date: (row.death_date as string | null | undefined) ?? null,
    biography: (row.biography as string | null | undefined) ?? null,
    photo_path: (row.photo_path as string | null | undefined) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

export async function listPeople(): Promise<Person[]> {
  const columns = await peopleSelectColumns()
  const { data, error } = await supabase
    .from('people')
    .select(columns)
    .order('last_name')
    .order('first_name')

  if (error) throw toDataAccessError(error, 'Failed to load people')
  return (data ?? []).map((row) => mapPerson(row as unknown as Record<string, unknown>))
}

export async function getPerson(id: string): Promise<PersonWithRelations | null> {
  const columns = await peopleSelectColumns()
  const { data: person, error } = await supabase
    .from('people')
    .select(columns)
    .eq('id', id)
    .maybeSingle()

  if (error) throw toDataAccessError(error, 'Failed to load person')
  if (!person) return null

  const [aliasesRes, parentsRes, childrenRes, partnersA, partnersB] = await Promise.all([
    supabase.from('person_aliases').select('alias').eq('person_id', id),
    supabase.from('parent_child').select('parent_id').eq('child_id', id),
    supabase.from('parent_child').select('child_id').eq('parent_id', id),
    supabase.from('partnerships').select('person_b_id').eq('person_a_id', id),
    supabase.from('partnerships').select('person_a_id').eq('person_b_id', id),
  ])

  for (const res of [aliasesRes, parentsRes, childrenRes, partnersA, partnersB]) {
    if (res.error) throw toDataAccessError(res.error, 'Failed to load relationships')
  }

  const partner_ids = [
    ...(partnersA.data ?? []).map((r) => r.person_b_id as string),
    ...(partnersB.data ?? []).map((r) => r.person_a_id as string),
  ]
  const parent_ids = (parentsRes.data ?? []).map((r) => r.parent_id as string)
  const child_ids = (childrenRes.data ?? []).map((r) => r.child_id as string)
  const sibling_ids = await listSiblingIds(id, parent_ids)

  return {
    ...mapPerson(person as unknown as Record<string, unknown>),
    aliases: (aliasesRes.data ?? []).map((r) => r.alias as string),
    parent_ids,
    child_ids,
    partner_ids,
    sibling_ids,
  }
}

/** Other children of any of the given parents (excludes personId). */
export async function listSiblingIds(personId: string, parentIds: string[]): Promise<string[]> {
  if (parentIds.length === 0) return []
  const { data, error } = await supabase
    .from('parent_child')
    .select('child_id')
    .in('parent_id', parentIds)
    .neq('child_id', personId)
  if (error) throw toDataAccessError(error, 'Failed to load siblings')
  return [...new Set((data ?? []).map((r) => r.child_id as string))]
}

/** Make siblingId a child of each of personId's current parents (shared parents ⇒ siblings). */
export async function linkSiblingViaParents(
  personId: string,
  siblingId: string,
  parentIds: string[],
): Promise<void> {
  if (personId === siblingId) {
    throw new DataAccessError('A person cannot be their own sibling')
  }
  if (parentIds.length === 0) {
    throw new DataAccessError('Add at least one parent before linking a sibling')
  }
  for (const parentId of parentIds) {
    await addParentChild(parentId, siblingId)
  }
}

function sanitizeSearchTerm(raw: string): string {
  // Strip PostgREST filter metacharacters; keep a simple substring search.
  return raw.trim().replace(/[%_,.()]/g, ' ').replace(/\s+/g, ' ')
}

export async function searchPeople(query: string): Promise<PersonSearchResult[]> {
  const trimmed = sanitizeSearchTerm(query)
  if (!trimmed) return []

  const pattern = `%${trimmed}%`

  const { data: byName, error: nameError } = await supabase
    .from('people')
    .select('id, first_name, last_name')
    .or(`first_name.ilike."${pattern}",last_name.ilike."${pattern}"`)
    .limit(25)

  if (nameError) throw toDataAccessError(nameError, 'Search failed')

  const { data: byAlias, error: aliasError } = await supabase
    .from('person_aliases')
    .select('person_id, alias, people!inner(id, first_name, last_name)')
    .ilike('alias', pattern)
    .limit(25)

  if (aliasError) throw toDataAccessError(aliasError, 'Alias search failed')

  const results = new Map<string, PersonSearchResult>()

  for (const row of byName ?? []) {
    results.set(row.id, {
      id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      matched_alias: null,
    })
  }

  for (const row of byAlias ?? []) {
    const person = row.people as unknown as {
      id: string
      first_name: string
      last_name: string
    }
    if (!results.has(person.id)) {
      results.set(person.id, {
        id: person.id,
        first_name: person.first_name,
        last_name: person.last_name,
        matched_alias: row.alias,
      })
    }
  }

  return [...results.values()].sort((a, b) =>
    `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`),
  )
}

export async function loadTreePayload(): Promise<TreePayload> {
  const columns = await peopleSelectColumns()
  const [peopleRes, aliasesRes, partnershipsRes, parentChildRes] = await Promise.all([
    supabase.from('people').select(columns),
    supabase.from('person_aliases').select('id, person_id, alias'),
    supabase.from('partnerships').select('id, person_a_id, person_b_id'),
    supabase.from('parent_child').select('id, parent_id, child_id'),
  ])

  for (const res of [peopleRes, aliasesRes, partnershipsRes, parentChildRes]) {
    if (res.error) {
      if (res.error.code === '42501' || res.error.message.toLowerCase().includes('policy')) {
        throw new DataAccessError('Permission denied', 'permission_denied')
      }
      throw toDataAccessError(res.error, 'Failed to load family tree')
    }
  }

  return {
    people: (peopleRes.data ?? []).map((row) =>
      mapPerson(row as unknown as Record<string, unknown>),
    ),
    aliases: (aliasesRes.data ?? []) as PersonAlias[],
    partnerships: (partnershipsRes.data ?? []) as Partnership[],
    parentChildren: (parentChildRes.data ?? []) as ParentChild[],
  }
}

async function replaceAliases(personId: string, aliases: string[]): Promise<void> {
  const { error: deleteError } = await supabase
    .from('person_aliases')
    .delete()
    .eq('person_id', personId)
  if (deleteError) throw toDataAccessError(deleteError, 'Failed to clear aliases')

  const cleaned = [...new Set(aliases.map((a) => a.trim()).filter(Boolean))]
  if (cleaned.length === 0) return

  const { error: insertError } = await supabase.from('person_aliases').insert(
    cleaned.map((alias) => ({ person_id: personId, alias })),
  )
  if (insertError) throw toDataAccessError(insertError, 'Failed to save aliases')
}

export async function createPerson(input: PersonWriteInput): Promise<Person> {
  const { aliases = [], ...fields } = input
  const { data, error } = await supabase
    .from('people')
    .insert({
      first_name: fields.first_name.trim(),
      last_name: fields.last_name.trim(),
      gender: fields.gender,
      birth_date: fields.birth_date || null,
      death_date: fields.death_date || null,
      biography: fields.biography?.trim() || null,
    })
    .select(
      'id, first_name, last_name, gender, birth_date, death_date, biography, photo_path, created_at, updated_at',
    )
    .single()

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to create person')
  }

  await replaceAliases(data.id, aliases)
  return data as Person
}

export async function updatePerson(id: string, input: PersonWriteInput): Promise<Person> {
  const { aliases = [], ...fields } = input
  const { data, error } = await supabase
    .from('people')
    .update({
      first_name: fields.first_name.trim(),
      last_name: fields.last_name.trim(),
      gender: fields.gender,
      birth_date: fields.birth_date || null,
      death_date: fields.death_date || null,
      biography: fields.biography?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id, first_name, last_name, gender, birth_date, death_date, biography, photo_path, created_at, updated_at',
    )
    .single()

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to update person')
  }

  await replaceAliases(id, aliases)
  return data as Person
}

export async function setPersonPhotoPath(personId: string, photoPath: string | null): Promise<void> {
  const { error } = await supabase
    .from('people')
    .update({ photo_path: photoPath, updated_at: new Date().toISOString() })
    .eq('id', personId)

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to update photo path')
  }
}

export async function addParentChild(parentId: string, childId: string): Promise<void> {
  if (parentId === childId) {
    throw new DataAccessError('A person cannot be their own parent')
  }
  const { error } = await supabase.from('parent_child').insert({
    parent_id: parentId,
    child_id: childId,
  })
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to link parent/child')
  }
}

export async function removeParentChild(parentId: string, childId: string): Promise<void> {
  const { error } = await supabase
    .from('parent_child')
    .delete()
    .eq('parent_id', parentId)
    .eq('child_id', childId)
  if (error) throw toDataAccessError(error, 'Failed to unlink parent/child')
}

export async function addPartnership(personAId: string, personBId: string): Promise<void> {
  if (personAId === personBId) {
    throw new DataAccessError('A person cannot be partnered with themselves')
  }
  const [a, b] = personAId < personBId ? [personAId, personBId] : [personBId, personAId]
  const { error } = await supabase.from('partnerships').insert({
    person_a_id: a,
    person_b_id: b,
  })
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to create partnership')
  }
}

export async function removePartnership(personAId: string, personBId: string): Promise<void> {
  const [a, b] = personAId < personBId ? [personAId, personBId] : [personBId, personAId]
  const { error } = await supabase
    .from('partnerships')
    .delete()
    .eq('person_a_id', a)
    .eq('person_b_id', b)
  if (error) throw toDataAccessError(error, 'Failed to remove partnership')
}
