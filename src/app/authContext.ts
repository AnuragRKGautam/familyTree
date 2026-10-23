import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import type { Profile } from '../types/domain'

export type AuthStatus =
  | 'loading'
  | 'unconfigured'
  | 'unauthenticated'
  | 'unapproved'
  | 'ready'
  | 'error'

export interface AuthContextValue {
  status: AuthStatus
  session: Session | null
  user: User | null
  profile: Profile | null
  errorMessage: string | null
  canEdit: boolean
  isAdmin: boolean
  /** null = unrestricted (admin). Set = only these person ids (+ new orphans via RLS). */
  accessScopeIds: Set<string> | null
  accessRootIds: string[]
  canEditPerson: (personId: string) => boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
