import { useEffect, useState } from 'react'
import { listProfiles, updateProfileAccess } from '../data/profiles'
import { DataAccessError } from '../data/errors'
import type { Profile, UserRole } from '../types/domain'
import { useAuth } from '../app/useAuth'
import { StatusMessage } from './StatusMessage'

export function AdminProfiles() {
  const { isAdmin } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void listProfiles()
      .then(setProfiles)
      .catch((err: unknown) =>
        setError(err instanceof DataAccessError ? err.message : 'Failed to load profiles'),
      )
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!isAdmin) {
    return (
      <StatusMessage
        variant="error"
        title="Permission denied"
        detail="Only admins can manage access."
      />
    )
  }

  if (loading) return <StatusMessage title="Loading profiles…" />
  if (error) return <StatusMessage variant="error" title="Error" detail={error} />

  async function patch(id: string, patch: { approved?: boolean; role?: UserRole }) {
    try {
      const updated = await updateProfileAccess(id, patch)
      setProfiles((rows) => rows.map((p) => (p.id === id ? updated : p)))
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Update failed')
    }
  }

  return (
    <main className="page-panel">
      <h1>Access management</h1>
      <p className="lede">Approve relatives and assign roles. Permissions are enforced by RLS.</p>
      <table className="profiles-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Approved</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((p) => (
            <tr key={p.id}>
              <td>{p.email}</td>
              <td>
                <input
                  type="checkbox"
                  checked={p.approved}
                  onChange={(e) => void patch(p.id, { approved: e.target.checked })}
                />
              </td>
              <td>
                <select
                  value={p.role}
                  onChange={(e) => void patch(p.id, { role: e.target.value as UserRole })}
                >
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
