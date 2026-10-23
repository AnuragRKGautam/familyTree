import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchMyProfile } from '../data/profiles'
import { DataAccessError } from '../data/errors'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import type { Profile } from '../types/domain'
import { AuthContext, type AuthContextValue, type AuthStatus } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    isSupabaseConfigured() ? 'loading' : 'unconfigured',
  )
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const resolveProfile = useCallback(async (nextSession: Session | null) => {
    if (!isSupabaseConfigured()) {
      setStatus('unconfigured')
      setSession(null)
      setProfile(null)
      return
    }

    setSession(nextSession)
    if (!nextSession?.user) {
      setProfile(null)
      setStatus('unauthenticated')
      setErrorMessage(null)
      return
    }

    try {
      const nextProfile = await fetchMyProfile()
      setProfile(nextProfile)
      if (!nextProfile || !nextProfile.approved) {
        setStatus('unapproved')
      } else {
        setStatus('ready')
      }
      setErrorMessage(null)
    } catch (err) {
      const message =
        err instanceof DataAccessError ? err.message : 'Failed to load profile'
      setErrorMessage(message)
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    let mounted = true
    void supabase.auth.getSession().then(({ data }) => {
      if (mounted) void resolveProfile(data.session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveProfile(nextSession)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [resolveProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    setErrorMessage(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new DataAccessError(error.message, 'auth_error')
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new DataAccessError(error.message, 'auth_error')
  }, [])

  const refreshProfile = useCallback(async () => {
    await resolveProfile(session)
  }, [resolveProfile, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      errorMessage,
      canEdit: profile?.approved === true && (profile.role === 'editor' || profile.role === 'admin'),
      isAdmin: profile?.approved === true && profile.role === 'admin',
      signIn,
      signOut,
      refreshProfile,
    }),
    [status, session, profile, errorMessage, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
