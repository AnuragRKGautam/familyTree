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

export interface InviteEmailResult {
  sent: boolean
  error?: string
}

/** Send Supabase Auth invite email via Edge Function (service role stays on the server). */
export async function sendInviteEmail(email: string): Promise<InviteEmailResult> {
  const normalized = email.trim().toLowerCase()
  const redirectTo =
    typeof window !== 'undefined' ? `${window.location.origin}/` : undefined

  const { data, error } = await supabase.functions.invoke('send-invite', {
    body: { email: normalized, redirect_to: redirectTo },
  })

  if (error) {
    return {
      sent: false,
      error:
        error.message.includes('Failed to send') || error.message.includes('FunctionsHttpError')
          ? 'Invite email function is not deployed or failed. Deploy supabase/functions/send-invite, or share the signup link manually.'
          : error.message,
    }
  }

  const payload = data as { ok?: boolean; error?: string; hint?: string } | null
  if (payload?.error) {
    return {
      sent: false,
      error: payload.hint ? `${payload.error} ${payload.hint}` : payload.error,
    }
  }
  if (!payload?.ok) {
    return { sent: false, error: 'Invite email was not sent' }
  }
  return { sent: true }
}

export async function createInvite(
  email: string,
  role: UserRole,
  rootPersonId: string | null,
): Promise<{ invite: Invite; email: InviteEmailResult }> {
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

  const invite = data as Invite
  const emailResult = await sendInviteEmail(invite.email)
  return { invite, email: emailResult }
}

export function inviteMailtoHref(email: string, signupUrl: string): string {
  const subject = encodeURIComponent('You are invited to our family tree')
  const body = encodeURIComponent(
    `You have been invited to our private family tree.\n\n` +
      `1. Open this link and create an account with this same email (${email}):\n${signupUrl}\n\n` +
      `2. Or, if you received a Supabase invite email, use that link to set your password, then sign in.\n`,
  )
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`
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
