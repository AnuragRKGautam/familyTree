import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { DataAccessError } from '../data/errors'
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient'
import { StatusMessage } from './StatusMessage'

export function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!isSupabaseConfigured()) {
    return (
      <StatusMessage
        variant="error"
        title="Supabase is not configured"
        detail="Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env."
      />
    )
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || undefined,
          },
        },
      })
      if (signUpError) throw new DataAccessError(signUpError.message, 'auth_error')
      setDone(true)
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Sign-up failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <h1>Check your access</h1>
          <p className="lede">
            Account created for <strong>{email.trim().toLowerCase()}</strong>. If an admin already
            invited this email, you can sign in now. Otherwise wait until an admin approves you under
            Access.
          </p>
          <p>
            <Link to="/tree">Go to sign in</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="lede">
          Family members can register here. An admin must invite or approve you before you can view
          the tree.
        </p>
        <form onSubmit={onSubmit} className="stack-form">
          <label>
            Display name
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="muted">
          Already have an account? <Link to="/tree">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
