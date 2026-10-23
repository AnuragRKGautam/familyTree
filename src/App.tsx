import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom'
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

function AuthedLayout() {
  const { status, errorMessage, signOut } = useAuth()

  if (status === 'loading') {
    return <StatusMessage title="Checking session…" />
  }
  if (status === 'unconfigured' || status === 'unauthenticated') {
    return <SignInPage />
  }
  if (status === 'unapproved') {
    return (
      <main className="auth-page">
        <StatusMessage
          variant="error"
          title="Permission denied"
          detail="Your account is signed in but not approved yet. Ask an admin to approve your profile."
        />
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
          <Route path="/" element={<Navigate to="/tree" replace />} />

          <Route element={<AuthedLayout />}>
            <Route path="/tree" element={<TreePage />} />
            <Route path="/tree/:personId" element={<TreePage />} />
            <Route path="/people/new" element={<PersonNewPage />} />
            <Route path="/people/:personId" element={<PersonProfilePage />} />
            <Route path="/people/:personId/edit" element={<PersonEditPage />} />
            <Route path="/admin/profiles" element={<AdminProfiles />} />
          </Route>

          <Route path="*" element={<Navigate to="/tree" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
