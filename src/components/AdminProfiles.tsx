import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listProfiles, updateProfileAccess } from '../data/profiles'
import { createInvite, deleteInvite, listInvites, type Invite } from '../data/invites'
import { listAccessGrants, setAccessRoot, type AccessGrant } from '../data/access'
import { listPeople } from '../data/people'
import { DataAccessError } from '../data/errors'
import type { Person, Profile, UserRole } from '../types/domain'
import { useAuth } from '../app/useAuth'
import { StatusMessage } from './StatusMessage'
import { PersonSearchSelect } from './PersonSearchSelect'

export function AdminProfiles() {
  const { isAdmin } = useAuth()
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer')
  const [inviteRootId, setInviteRootId] = useState('')
  const [inviting, setInviting] = useState(false)

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )

  const rootByProfile = useMemo(() => {
    const map = new Map<string, string>()
    for (const g of grants) map.set(g.profile_id, g.root_person_id)
    return map
  }, [grants])

  async function reload() {
    const [nextProfiles, nextInvites, nextGrants, nextPeople] = await Promise.all([
      listProfiles(),
      listInvites(),
      listAccessGrants(),
      listPeople(),
    ])
    setProfiles(nextProfiles)
    setInvites(nextInvites)
    setGrants(nextGrants)
    setPeople(nextPeople)
  }

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    void reload()
      .catch((err: unknown) =>
        setError(err instanceof DataAccessError ? err.message : 'Failed to load access data'),
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

  if (loading) return <StatusMessage title="Loading access settings…" />

  function personName(id: string | null | undefined): string {
    if (!id) return '—'
    const p = peopleById.get(id)
    return p ? `${p.first_name} ${p.last_name}` : id.slice(0, 8)
  }

  async function onInvite(event: FormEvent) {
    event.preventDefault()
    setInviting(true)
    setError(null)
    setNotice(null)
    try {
      await createInvite(
        inviteEmail,
        inviteRole,
        inviteRole === 'admin' ? null : inviteRootId || null,
      )
      setInviteEmail('')
      setInviteRole('viewer')
      setInviteRootId('')
      await reload()
      setNotice(
        `Invite saved for ${inviteEmail.trim().toLowerCase()}. They register at /signup with that email.`,
      )
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not create invite')
    } finally {
      setInviting(false)
    }
  }

  async function patch(id: string, patch: { approved?: boolean; role?: UserRole }) {
    setError(null)
    try {
      const updated = await updateProfileAccess(id, patch)
      setProfiles((rows) => rows.map((p) => (p.id === id ? updated : p)))
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Update failed')
    }
  }

  async function changeRoot(profileId: string, rootPersonId: string | null) {
    setError(null)
    try {
      await setAccessRoot(profileId, rootPersonId)
      await reload()
      setNotice('Family access root updated.')
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not update access root')
    }
  }

  const pendingInvites = invites.filter((i) => !i.consumed_at)
  const pendingUsers = profiles.filter((p) => !p.approved)
  const signupUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/signup` : '/signup'

  return (
    <main className="page-panel access-page">
      <p>
        <Link to="/tree">← Back to tree</Link>
      </p>
      <h1>Users & access</h1>
      <p className="lede">
        Invite relatives and optionally limit editors to a <strong>family branch</strong>: they may
        add/edit that person and relatives at that level or below (spouse, children, siblings,
        descendants), but not change ancestors above that person. Admins are unrestricted.
      </p>

      {error ? <p className="form-error">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <section className="access-section">
        <h2>Add user (invite)</h2>
        <p className="muted small">
          Sign-up link: <a href={signupUrl}>{signupUrl}</a>
        </p>
        <form className="stack-form invite-form" onSubmit={onInvite}>
          <label>
            Email
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="relative@example.com"
            />
          </label>
          <label>
            Role
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
            >
              <option value="viewer">viewer — view only</option>
              <option value="editor">editor — edit within a family branch</option>
              <option value="admin">admin — full access</option>
            </select>
          </label>
          {inviteRole !== 'admin' ? (
            <label>
              Family access root {inviteRole === 'editor' ? '(required)' : '(optional)'}
              <PersonSearchSelect
                people={people}
                value={inviteRootId}
                onChange={setInviteRootId}
                placeholder="Search person who anchors their access…"
              />
            </label>
          ) : (
            <p className="muted small">Admins can edit the whole tree; no root needed.</p>
          )}
          <button type="submit" disabled={inviting}>
            {inviting ? 'Saving…' : 'Add invite'}
          </button>
        </form>
      </section>

      <section className="access-section">
        <h2>Pending invites</h2>
        {pendingInvites.length === 0 ? (
          <p className="muted">No open invites.</p>
        ) : (
          <table className="profiles-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Access root</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingInvites.map((invite) => (
                <tr key={invite.id}>
                  <td>{invite.email}</td>
                  <td>{invite.role}</td>
                  <td>{personName(invite.root_person_id)}</td>
                  <td>{new Date(invite.created_at).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="linkish"
                      onClick={() =>
                        void deleteInvite(invite.id)
                          .then(reload)
                          .catch((err: unknown) =>
                            setError(
                              err instanceof DataAccessError ? err.message : 'Delete failed',
                            ),
                          )
                      }
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="access-section">
        <h2>Waiting for approval</h2>
        {pendingUsers.length === 0 ? (
          <p className="muted">No pending users.</p>
        ) : (
          <table className="profiles-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Access root</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pendingUsers.map((p) => (
                <tr key={p.id}>
                  <td>{p.email}</td>
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
                  <td className="root-cell">
                    <PersonSearchSelect
                      people={people}
                      value={rootByProfile.get(p.id) ?? ''}
                      onChange={(id) => void changeRoot(p.id, id || null)}
                      placeholder="Set family root…"
                    />
                  </td>
                  <td>
                    <button type="button" onClick={() => void patch(p.id, { approved: true })}>
                      Approve
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="access-section">
        <h2>All users</h2>
        <table className="profiles-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Approved</th>
              <th>Role</th>
              <th>Family access root</th>
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
                <td className="root-cell">
                  {p.role === 'admin' ? (
                    <span className="muted">Full tree</span>
                  ) : (
                    <PersonSearchSelect
                      people={people}
                      value={rootByProfile.get(p.id) ?? ''}
                      onChange={(id) => void changeRoot(p.id, id || null)}
                      placeholder="Search root person…"
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
