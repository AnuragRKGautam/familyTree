import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './app/AuthProvider'
import { useAuth } from './app/useAuth'
import { SignInPage } from './components/SignInPage'
import { StatusMessage } from './components/StatusMessage'
import { TreePage } from './components/TreePage'
import { PersonForm } from './components/PersonForm'
import { AdminProfiles } from './components/AdminProfiles'
import { PersonProfilePage } from './components/PersonProfilePage'

function Gate({ children }: { children: ReactNode }) {
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
  return children
}

function AppRoutes() {
  return (
    <Gate>
      <Routes>
        <Route path="/" element={<Navigate to="/tree" replace />} />
        <Route path="/tree" element={<TreePage />} />
        <Route path="/tree/:personId" element={<TreePage />} />
        <Route path="/people/new" element={<PersonForm />} />
        <Route path="/people/:personId" element={<PersonProfilePage />} />
        <Route path="/people/:personId/edit" element={<PersonForm />} />
        <Route path="/admin/profiles" element={<AdminProfiles />} />
        <Route path="*" element={<Navigate to="/tree" replace />} />
      </Routes>
    </Gate>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
