import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { fetchMyProfile } from '../data/profiles'
import { fetchMyAccessScopeIds } from '../data/access'
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
  const [accessScopeIds, setAccessScopeIds] = useState<Set<string> | null>(null)
  const [accessRootIds, setAccessRootIds] = useState<string[]>([])

  const resolveProfile = useCallback(async (nextSession: Session | null) => {
    if (!isSupabaseConfigured()) {
      setStatus('unconfigured')
      setSession(null)
      setProfile(null)
      setAccessScopeIds(null)
      setAccessRootIds([])
      return
    }

    setSession(nextSession)
    if (!nextSession?.user) {
      setProfile(null)
      setAccessScopeIds(null)
      setAccessRootIds([])
      setStatus('unauthenticated')
      setErrorMessage(null)
      return
    }

    try {
      const nextProfile = await fetchMyProfile()
      setProfile(nextProfile)
      if (!nextProfile || !nextProfile.approved) {
        setAccessScopeIds(new Set())
        setAccessRootIds([])
        setStatus('unapproved')
        setErrorMessage(null)
        return
      }

      if (nextProfile.role === 'admin') {
        setAccessScopeIds(null)
        setAccessRootIds([])
      } else if (nextProfile.role === 'editor') {
        const scope = await fetchMyAccessScopeIds()
        if (scope === null) {
          setAccessScopeIds(new Set())
          setAccessRootIds([])
        } else {
          setAccessScopeIds(new Set(scope))
          const { data } = await supabase.rpc('get_my_access_roots')
          setAccessRootIds(
            ((data ?? []) as Array<{ root_person_id: string }>).map((r) => r.root_person_id),
          )
        }
      } else {
        setAccessScopeIds(null)
        setAccessRootIds([])
      }

      setStatus('ready')
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

  const isAdmin = profile?.approved === true && profile.role === 'admin'
  const canEdit =
    profile?.approved === true && (profile.role === 'editor' || profile.role === 'admin')

  const canEditPerson = useCallback(
    (personId: string) => {
      if (!canEdit) return false
      if (isAdmin || accessScopeIds === null) return true
      return accessScopeIds.has(personId)
    },
    [canEdit, isAdmin, accessScopeIds],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      errorMessage,
      canEdit,
      isAdmin,
      accessScopeIds,
      accessRootIds,
      canEditPerson,
      signIn,
      signOut,
      refreshProfile,
    }),
    [
      status,
      session,
      profile,
      errorMessage,
      canEdit,
      isAdmin,
      accessScopeIds,
      accessRootIds,
      canEditPerson,
      signIn,
      signOut,
      refreshProfile,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
