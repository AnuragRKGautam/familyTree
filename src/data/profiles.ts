import { supabase } from '../lib/supabaseClient'
import type { Profile, UserRole } from '../types/domain'
import { DataAccessError, toDataAccessError } from './errors'

export async function fetchMyProfile(): Promise<Profile | null> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError) throw toDataAccessError(userError, 'Failed to read auth user')
  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, approved, created_at, updated_at')
    .eq('id', user.id)
    .maybeSingle()

  if (error) throw toDataAccessError(error, 'Failed to load profile')
  return data as Profile | null
}

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, approved, created_at, updated_at')
    .order('email')

  if (error) throw toDataAccessError(error, 'Failed to list profiles')
  return (data ?? []) as Profile[]
}

export async function updateProfileAccess(
  profileId: string,
  patch: { approved?: boolean; role?: UserRole },
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', profileId)
    .select('id, email, display_name, role, approved, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to update profile')
  }
  return data as Profile
}
