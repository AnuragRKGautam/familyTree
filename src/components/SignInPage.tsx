import { useState, type FormEvent } from 'react'
import { useAuth } from '../app/useAuth'
import { DataAccessError } from '../data/errors'
import { StatusMessage } from './StatusMessage'

export function SignInPage() {
  const { signIn, status } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'unconfigured') {
    return (
      <StatusMessage
        variant="error"
        title="Supabase is not configured"
        detail="Copy .env.example to .env and set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Never add the service-role key."
      />
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Sign-in failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Family Tree</h1>
        <p className="lede">Sign in with your approved account.</p>
        <form onSubmit={onSubmit} className="stack-form">
          <label>
            Email
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}
