import { BrowserRouter, Link, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AuthProvider } from './app/AuthProvider'
import { useAuth } from './app/useAuth'
import { SignInPage } from './components/SignInPage'
import { SignUpPage } from './components/SignUpPage'
import { StatusMessage } from './components/StatusMessage'
import { TreePage } from './components/TreePage'
import { PersonForm } from './components/PersonForm'
import { AdminProfiles } from './components/AdminProfiles'
import { PersonProfilePage } from './components/PersonProfilePage'
import { PrototypePage } from './prototype/PrototypePage'
import { LimitationsPage } from './prototype/LimitationsPage'

/** Force a fresh form instance when switching new ↔ edit (same component type). */
function PersonNewPage() {
  return <PersonForm key="new" />
}

function PersonEditPage() {
  const { personId } = useParams<{ personId: string }>()
  return <PersonForm key={personId ?? 'edit'} />
}

/** Tree + profile viewing — no login required. */
function PublicLayout() {
  const { status, errorMessage } = useAuth()

  if (status === 'loading') {
    return <StatusMessage title="Loading…" />
  }
  if (status === 'unconfigured') {
    return (
      <StatusMessage
        variant="error"
        title="Supabase is not configured"
        detail="Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      />
    )
  }
  if (status === 'error') {
    return (
      <StatusMessage
        variant="error"
        title="Something went wrong"
        detail={errorMessage ?? 'Unexpected auth error'}
      />
    )
  }
  return <Outlet />
}

/** Edit / admin routes — approved accounts only. */
function AuthedLayout() {
  const { status, errorMessage, signOut } = useAuth()

  if (status === 'loading') {
    return <StatusMessage title="Checking session…" />
  }
  if (status === 'unconfigured') {
    return (
      <StatusMessage
        variant="error"
        title="Supabase is not configured"
        detail="Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      />
    )
  }
  if (status === 'unauthenticated') {
    return <Navigate to="/signin" replace />
  }
  if (status === 'unapproved') {
    return (
      <main className="auth-page">
        <StatusMessage
          variant="error"
          title="Permission denied"
          detail="Your account is signed in but not approved yet. You can browse the public tree; ask an admin to approve you before editing."
        />
        <p>
          <Link to="/tree">Back to tree</Link>
        </p>
        <button type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </main>
    )
  }
  if (status === 'error') {
    return (
      <StatusMessage
        variant="error"
        title="Something went wrong"
        detail={errorMessage ?? 'Unexpected auth error'}
      />
    )
  }
  return <Outlet />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/prototype" element={<PrototypePage />} />
          <Route path="/docs-limitations" element={<LimitationsPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/signin" element={<SignInPage />} />
          <Route path="/" element={<Navigate to="/tree" replace />} />

          <Route element={<PublicLayout />}>
            <Route path="/tree" element={<TreePage />} />
            <Route path="/tree/:personId" element={<TreePage />} />
            <Route path="/people/:personId" element={<PersonProfilePage />} />
          </Route>

          <Route element={<AuthedLayout />}>
            <Route path="/people/new" element={<PersonNewPage />} />
            <Route path="/people/:personId/edit" element={<PersonEditPage />} />
            <Route path="/admin/profiles" element={<AdminProfiles />} />
          </Route>

          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
