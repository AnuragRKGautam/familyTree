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
    supabase.from('parent_child').select('child_id, sort_order').eq('parent_id', id),
    supabase.from('partnerships').select('person_b_id').eq('person_a_id', id),
    supabase.from('partnerships').select('person_a_id').eq('person_b_id', id),
  ])

  for (const res of [aliasesRes, parentsRes, partnersA, partnersB]) {
    if (res.error) throw toDataAccessError(res.error, 'Failed to load relationships')
  }

  let childRows: Array<{ child_id: string; sort_order: number | null }> = []
  if (childrenRes.error) {
    const basic = await supabase.from('parent_child').select('child_id').eq('parent_id', id)
    if (basic.error) throw toDataAccessError(basic.error, 'Failed to load relationships')
    childRows = (basic.data ?? []).map((r) => ({
      child_id: r.child_id as string,
      sort_order: null,
    }))
  } else {
    childRows = (childrenRes.data ?? []).map((r) => ({
      child_id: r.child_id as string,
      sort_order:
        typeof r.sort_order === 'number'
          ? r.sort_order
          : r.sort_order == null
            ? null
            : Number(r.sort_order),
    }))
  }

  const partner_ids = [
    ...(partnersA.data ?? []).map((r) => r.person_b_id as string),
    ...(partnersB.data ?? []).map((r) => r.person_a_id as string),
  ]
  const parent_ids = (parentsRes.data ?? []).map((r) => r.parent_id as string)

  // Order children: sort_order, then birth date (loaded below if needed).
  const childIdSet = childRows.map((r) => r.child_id)
  let birthByChild = new Map<string, string>()
  if (childIdSet.length > 0) {
    const { data: childPeople } = await supabase
      .from('people')
      .select('id, birth_date')
      .in('id', childIdSet)
    birthByChild = new Map(
      (childPeople ?? []).map((p) => [p.id as string, (p.birth_date as string | null) ?? '']),
    )
  }
  childRows.sort((a, b) => {
    const aHas = typeof a.sort_order === 'number'
    const bHas = typeof b.sort_order === 'number'
    if (aHas && bHas && a.sort_order !== b.sort_order) {
      return (a.sort_order as number) - (b.sort_order as number)
    }
    if (aHas && !bHas) return -1
    if (!aHas && bHas) return 1
    const byDate = (birthByChild.get(a.child_id) ?? '').localeCompare(
      birthByChild.get(b.child_id) ?? '',
    )
    // Empty birth dates sort last
    const aBirth = birthByChild.get(a.child_id) ?? ''
    const bBirth = birthByChild.get(b.child_id) ?? ''
    if (!aBirth && bBirth) return 1
    if (aBirth && !bBirth) return -1
    if (byDate !== 0) return byDate
    return a.child_id.localeCompare(b.child_id)
  })
  const child_ids = childRows.map((r) => r.child_id)
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

export async function listPartnerships(): Promise<Partnership[]> {
  const { data, error } = await supabase
    .from('partnerships')
    .select('id, person_a_id, person_b_id')
  if (error) throw toDataAccessError(error, 'Failed to load partnerships')
  return (data ?? []) as Partnership[]
}

export async function loadTreePayload(): Promise<TreePayload> {
  const columns = await peopleSelectColumns()
  const [peopleRes, aliasesRes, partnershipsRes, parentChildRes] = await Promise.all([
    supabase.from('people').select(columns),
    supabase.from('person_aliases').select('id, person_id, alias'),
    supabase.from('partnerships').select('id, person_a_id, person_b_id'),
    loadParentChildRows(),
  ])

  for (const res of [peopleRes, aliasesRes, partnershipsRes]) {
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
    parentChildren: parentChildRes,
  }
}

async function loadParentChildRows(): Promise<ParentChild[]> {
  const withOrder = await supabase
    .from('parent_child')
    .select('id, parent_id, child_id, sort_order')
  if (!withOrder.error) {
    return (withOrder.data ?? []).map((row) => ({
      id: row.id as string,
      parent_id: row.parent_id as string,
      child_id: row.child_id as string,
      sort_order:
        typeof row.sort_order === 'number'
          ? row.sort_order
          : row.sort_order == null
            ? null
            : Number(row.sort_order),
    }))
  }
  // Migration not applied yet — fall back without sort_order.
  const basic = await supabase.from('parent_child').select('id, parent_id, child_id')
  if (basic.error) {
    if (basic.error.code === '42501' || basic.error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(basic.error, 'Failed to load family tree')
  }
  return (basic.data ?? []).map((row) => ({
    id: row.id as string,
    parent_id: row.parent_id as string,
    child_id: row.child_id as string,
    sort_order: null,
  }))
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

export async function addParentChild(
  parentId: string,
  childId: string,
  sortOrder?: number,
): Promise<void> {
  if (parentId === childId) {
    throw new DataAccessError('A person cannot be their own parent')
  }

  const { data: existingParents, error: parentsError } = await supabase
    .from('parent_child')
    .select('parent_id')
    .eq('child_id', childId)
  if (parentsError) throw toDataAccessError(parentsError, 'Failed to check existing parents')
  const already = (existingParents ?? []).map((r) => r.parent_id as string)
  if (already.includes(parentId)) return
  if (already.length >= 2) {
    throw new DataAccessError(
      'This person already has two parents. Unlink one before adding another — the chart only supports two parents.',
    )
  }

  let resolvedOrder = sortOrder
  if (typeof resolvedOrder !== 'number') {
    const { data: existing, error: existingError } = await supabase
      .from('parent_child')
      .select('sort_order')
      .eq('parent_id', parentId)
    if (!existingError) {
      const maxOrder = (existing ?? []).reduce((max, row) => {
        const n = typeof row.sort_order === 'number' ? row.sort_order : -1
        return Math.max(max, n)
      }, -1)
      resolvedOrder = maxOrder + 1
    }
  }

  const row: { parent_id: string; child_id: string; sort_order?: number } = {
    parent_id: parentId,
    child_id: childId,
  }
  if (typeof resolvedOrder === 'number') row.sort_order = resolvedOrder

  const { error } = await supabase.from('parent_child').insert(row)
  if (error) {
    // Column may not exist yet — retry without sort_order.
    if (typeof resolvedOrder === 'number') {
      const retry = await supabase.from('parent_child').insert({
        parent_id: parentId,
        child_id: childId,
      })
      if (!retry.error) return
    }
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

/**
 * Persist left→right child order for a parent (0 = leftmost).
 * Also mirrors the same order onto any co-parent who shares these children,
 * so the chart looks the same from either parent.
 */
export async function reorderChildren(parentId: string, childIdsInOrder: string[]): Promise<void> {
  async function writeOrder(forParentId: string) {
    for (let i = 0; i < childIdsInOrder.length; i++) {
      const childId = childIdsInOrder[i]
      if (!childId) continue
      const { data, error } = await supabase
        .from('parent_child')
        .update({ sort_order: i })
        .eq('parent_id', forParentId)
        .eq('child_id', childId)
        .select('id')
      if (error) {
        if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
          throw new DataAccessError(
            'Permission denied — ask an admin to apply the parent_child update policy migration.',
            'permission_denied',
          )
        }
        throw toDataAccessError(error, 'Failed to save child order')
      }
      if (!data || data.length === 0) {
        throw new DataAccessError(
          'Could not save child order (no row updated). Apply migration 20260324130000_parent_child_update_policy.sql in Supabase, then try again.',
        )
      }
    }
  }

  await writeOrder(parentId)

  // Mirror the same absolute indices onto every other parent linked to these children.
  const { data: otherEdges } = await supabase
    .from('parent_child')
    .select('parent_id, child_id')
    .in('child_id', childIdsInOrder)
    .neq('parent_id', parentId)

  const byOtherParent = new Map<string, string[]>()
  for (const row of otherEdges ?? []) {
    const otherId = row.parent_id as string
    const childId = row.child_id as string
    const list = byOtherParent.get(otherId) ?? []
    list.push(childId)
    byOtherParent.set(otherId, list)
  }

  for (const [otherId, sharedChildIds] of byOtherParent) {
    const sharedSet = new Set(sharedChildIds)
    for (let i = 0; i < childIdsInOrder.length; i++) {
      const childId = childIdsInOrder[i]
      if (!childId || !sharedSet.has(childId)) continue
      const { error } = await supabase
        .from('parent_child')
        .update({ sort_order: i })
        .eq('parent_id', otherId)
        .eq('child_id', childId)
      // Co-parent may be outside editor scope; primary parent's order still saved.
      if (error) continue
    }
  }
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
