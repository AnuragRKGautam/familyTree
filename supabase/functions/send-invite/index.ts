// Sends a Supabase Auth invite email for an address already stored in public.invites.
// Deploy: npx supabase functions deploy send-invite
// Requires Auth → URL configuration to allow the app origin as a redirect URL.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ error: 'Missing authorization' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ error: 'Server misconfigured' }, 500)
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await caller.auth.getUser()
    if (userError || !user) {
      return json({ error: 'Unauthorized' }, 401)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('role, approved')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile?.approved || profile.role !== 'admin') {
      return json({ error: 'Only admins can send invites' }, 403)
    }

    const body = (await req.json()) as {
      email?: string
      redirect_to?: string
    }
    const email = (body.email ?? '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return json({ error: 'Valid email required' }, 400)
    }

    const { data: invite, error: inviteError } = await admin
      .from('invites')
      .select('id, email, consumed_at')
      .eq('email', email)
      .is('consumed_at', null)
      .maybeSingle()

    if (inviteError) {
      return json({ error: inviteError.message }, 400)
    }
    if (!invite) {
      return json({ error: 'No pending invite for that email. Save the invite first.' }, 400)
    }

    const redirectTo =
      typeof body.redirect_to === 'string' && body.redirect_to.startsWith('http')
        ? body.redirect_to
        : undefined

    const { data: invited, error: inviteAuthError } = await admin.auth.admin.inviteUserByEmail(
      email,
      redirectTo ? { redirectTo } : undefined,
    )

    if (inviteAuthError) {
      // User may already exist from a previous invite — still useful signal to the admin.
      return json(
        {
          error: inviteAuthError.message,
          hint: 'If they already have an account, ask them to sign in or use password reset. Otherwise share the /signup link.',
        },
        400,
      )
    }

    return json({
      ok: true,
      user_id: invited.user?.id ?? null,
      email,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invite email failed'
    return json({ error: message }, 500)
  }
})

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
