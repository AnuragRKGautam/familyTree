import { supabase } from '../lib/supabaseClient'
import type { UserRole } from '../types/domain'
import { DataAccessError, toDataAccessError } from './errors'

export interface AccessGrant {
  id: string
  profile_id: string
  root_person_id: string
  created_at: string
}

export async function listAccessGrants(): Promise<AccessGrant[]> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, profile_id, root_person_id, created_at')
    .order('created_at', { ascending: false })
  if (error) throw toDataAccessError(error, 'Failed to load access grants')
  return (data ?? []) as AccessGrant[]
}

export async function listAccessGrantsForProfile(profileId: string): Promise<AccessGrant[]> {
  const { data, error } = await supabase
    .from('access_grants')
    .select('id, profile_id, root_person_id, created_at')
    .eq('profile_id', profileId)
  if (error) throw toDataAccessError(error, 'Failed to load access grants')
  return (data ?? []) as AccessGrant[]
}

export async function setAccessRoot(profileId: string, rootPersonId: string | null): Promise<void> {
  const { error: delError } = await supabase
    .from('access_grants')
    .delete()
    .eq('profile_id', profileId)
  if (delError) throw toDataAccessError(delError, 'Failed to clear access grants')

  if (!rootPersonId) return

  const { error } = await supabase.from('access_grants').insert({
    profile_id: profileId,
    root_person_id: rootPersonId,
  })
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to set access root')
  }
}

export async function fetchMyAccessScopeIds(): Promise<string[] | null> {
  const { data: roots, error: rootsError } = await supabase.rpc('get_my_access_roots')
  if (rootsError) throw toDataAccessError(rootsError, 'Failed to load access roots')

  const rootIds = ((roots ?? []) as Array<{ root_person_id: string }>).map((r) => r.root_person_id)
  if (rootIds.length === 0) return null

  const { data, error } = await supabase.rpc('get_my_access_scope')
  if (error) throw toDataAccessError(error, 'Failed to load access scope')
  return ((data ?? []) as Array<{ person_id: string }>).map((r) => r.person_id)
}

export async function canMutatePerson(personId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('can_mutate_person', { p: personId })
  if (error) throw toDataAccessError(error, 'Failed to check edit permission')
  return Boolean(data)
}

export function roleNeedsAccessRoot(role: UserRole): boolean {
  return role === 'editor'
}
