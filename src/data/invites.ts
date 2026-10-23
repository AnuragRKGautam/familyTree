import { supabase } from '../lib/supabaseClient'
import type { UserRole } from '../types/domain'
import { DataAccessError, toDataAccessError } from './errors'

export interface Invite {
  id: string
  email: string
  role: UserRole
  root_person_id: string | null
  invited_by: string | null
  created_at: string
  consumed_at: string | null
}

export async function listInvites(): Promise<Invite[]> {
  const { data, error } = await supabase
    .from('invites')
    .select('id, email, role, root_person_id, invited_by, created_at, consumed_at')
    .order('created_at', { ascending: false })

  if (error) throw toDataAccessError(error, 'Failed to load invites')
  return (data ?? []) as Invite[]
}

export async function createInvite(
  email: string,
  role: UserRole,
  rootPersonId: string | null,
): Promise<Invite> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) {
    throw new DataAccessError('Enter a valid email address')
  }
  if (role === 'editor' && !rootPersonId) {
    throw new DataAccessError('Editors need a family access root person')
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('invites')
    .insert({
      email: normalized,
      role,
      root_person_id: role === 'admin' ? null : rootPersonId,
      invited_by: user?.id ?? null,
    })
    .select('id, email, role, root_person_id, invited_by, created_at, consumed_at')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new DataAccessError('A pending invite already exists for that email')
    }
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to create invite')
  }
  return data as Invite
}

export async function deleteInvite(id: string): Promise<void> {
  const { error } = await supabase.from('invites').delete().eq('id', id)
  if (error) {
    if (error.code === '42501' || error.message.toLowerCase().includes('policy')) {
      throw new DataAccessError('Permission denied', 'permission_denied')
    }
    throw toDataAccessError(error, 'Failed to delete invite')
  }
}
