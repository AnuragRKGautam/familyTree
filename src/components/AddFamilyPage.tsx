import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { listPartnerships, listPeople } from '../data/people'
import {
  isFamilyHouseholdPartialError,
  saveFamilyHousehold,
  type CreatedFamilyPerson,
  type FamilyChildInput,
} from '../data/saveFamilyHousehold'
import { buildSpouseNamesByPersonId } from '../data/personLabels'
import { DataAccessError } from '../data/errors'
import type { Gender, Partnership, Person } from '../types/domain'
import { useAuth } from '../app/useAuth'
import { StatusMessage } from './StatusMessage'
import { PersonSearchSelect } from './PersonSearchSelect'

interface ChildRow extends FamilyChildInput {
  key: string
}

function emptyChild(): ChildRow {
  return {
    key: crypto.randomUUID(),
    first_name: '',
    last_name: '',
    gender: 'U',
    birth_date: '',
    spouse_first_name: '',
    spouse_last_name: '',
    spouse_gender: 'U',
  }
}

export function AddFamilyPage() {
  const navigate = useNavigate()
  const { canEdit, isAdmin, accessScopeIds, refreshProfile } = useAuth()

  const [people, setPeople] = useState<Person[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partialCreated, setPartialCreated] = useState<CreatedFamilyPerson[] | null>(null)
  const [failedStep, setFailedStep] = useState<string | null>(null)

  const [primaryFirst, setPrimaryFirst] = useState('')
  const [primaryLast, setPrimaryLast] = useState('')
  const [primaryGender, setPrimaryGender] = useState<Gender>('U')
  const [primaryBirth, setPrimaryBirth] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [children, setChildren] = useState<ChildRow[]>([emptyChild()])

  const spouseNamesByPersonId = useMemo(
    () => buildSpouseNamesByPersonId(people, partnerships),
    [people, partnerships],
  )

  useEffect(() => {
    if (!canEdit) return
    let cancelled = false
    setLoading(true)
    void Promise.all([listPeople(), listPartnerships()])
      .then(([nextPeople, nextPartnerships]) => {
        if (cancelled) return
        setPeople(nextPeople)
        setPartnerships(nextPartnerships)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof DataAccessError ? err.message : 'Failed to load people')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [canEdit])

  const partnerOptions = useMemo(() => {
    if (isAdmin || accessScopeIds === null) return people
    if (!accessScopeIds || accessScopeIds.size === 0) return []
    return people.filter((p) => accessScopeIds.has(p.id))
  }, [people, isAdmin, accessScopeIds])

  if (!canEdit) {
    return (
      <StatusMessage
        variant="error"
        title="Permission denied"
        detail="Your role cannot add family records."
      />
    )
  }

  if (!isAdmin && canEdit && accessScopeIds !== null && accessScopeIds.size === 0) {
    return (
      <StatusMessage
        variant="error"
        title="No family access root"
        detail="An admin must assign you a family access person before you can add a family."
      />
    )
  }

  if (loading) return <StatusMessage title="Loading…" />

  function updateChild(key: string, patch: Partial<ChildRow>) {
    setChildren((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function moveChild(key: string, direction: -1 | 1) {
    setChildren((rows) => {
      const index = rows.findIndex((r) => r.key === key)
      if (index < 0) return rows
      const target = index + direction
      if (target < 0 || target >= rows.length) return rows
      const next = [...rows]
      const [item] = next.splice(index, 1)
      if (!item) return rows
      next.splice(target, 0, item)
      return next
    })
  }

  function removeChild(key: string) {
    setChildren((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)))
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setPartialCreated(null)
    setFailedStep(null)

    const childPayload = children
      .map((c) => ({
        first_name: c.first_name.trim(),
        last_name: c.last_name.trim(),
        gender: c.gender,
        birth_date: c.birth_date?.trim() || null,
        spouse_first_name: c.spouse_first_name?.trim() || '',
        spouse_last_name: c.spouse_last_name?.trim() || '',
        spouse_gender: c.spouse_gender ?? 'U',
      }))
      .filter((c) => c.first_name || c.last_name || c.spouse_first_name || c.spouse_last_name)

    try {
      const result = await saveFamilyHousehold({
        primary: {
          first_name: primaryFirst.trim(),
          last_name: primaryLast.trim(),
          gender: primaryGender,
          birth_date: primaryBirth.trim() || null,
        },
        partnerId,
        children: childPayload,
      })
      await refreshProfile()
      navigate(`/tree/${result.primaryId}`, { replace: true })
    } catch (err) {
      if (isFamilyHouseholdPartialError(err)) {
        setFailedStep(err.failedStep)
        setPartialCreated(err.created)
        setError(err.message)
      } else {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    } finally {
      setSaving(false)
    }
  }

  const spouseCount = children.filter(
    (c) => (c.spouse_first_name ?? '').trim() && (c.spouse_last_name ?? '').trim(),
  ).length
  const namedChildren = children.filter((c) => c.first_name.trim() && c.last_name.trim()).length

  return (
    <main className="page-panel add-family-page">
      <p>
        <Link to="/tree">← Back to tree</Link>
        {' · '}
        <Link to="/people/new">Add single person</Link>
      </p>
      <h1>Add family</h1>
      <p className="lede">
        Create one new person, link an existing partner, list their children (and each child’s spouse
        if known), then save everything at once.
      </p>

      <form className="add-family-form" onSubmit={(e) => void onSubmit(e)}>
        <section className="relation-group">
          <h2>1. New person</h2>
          <div className="form-grid">
            <label>
              First name
              <input
                required
                value={primaryFirst}
                onChange={(e) => setPrimaryFirst(e.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              Last name
              <input
                required
                value={primaryLast}
                onChange={(e) => setPrimaryLast(e.target.value)}
                disabled={saving}
              />
            </label>
            <label>
              Gender
              <select
                value={primaryGender}
                onChange={(e) => setPrimaryGender(e.target.value as Gender)}
                disabled={saving}
              >
                <option value="U">Unknown</option>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </label>
            <label>
              Birth date
              <input
                type="date"
                value={primaryBirth}
                onChange={(e) => setPrimaryBirth(e.target.value)}
                disabled={saving}
              />
            </label>
          </div>
        </section>

        <section className="relation-group">
          <h2>2. Existing partner</h2>
          <p className="muted small">Search and select someone already in the tree.</p>
          <PersonSearchSelect
            people={partnerOptions}
            value={partnerId}
            onChange={setPartnerId}
            disabled={saving || partnerOptions.length === 0}
            placeholder="Search partner…"
            spouseNamesByPersonId={spouseNamesByPersonId}
          />
        </section>

        <section className="relation-group">
          <h2>3. Children</h2>
          <p className="muted small">
            Top of the list is leftmost on the chart. Use ↑ ↓ to reorder. Spouse fields are optional.
          </p>
          <div className="family-child-rows">
            {children.map((child, index) => (
              <div key={child.key} className="family-child-row">
                <div className="family-child-row__head">
                  <strong>Child {index + 1}</strong>
                  <span className="children-order-actions">
                    <button
                      type="button"
                      className="linkish"
                      disabled={saving || index === 0}
                      onClick={() => moveChild(child.key, -1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="linkish"
                      disabled={saving || index === children.length - 1}
                      onClick={() => moveChild(child.key, 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className="linkish"
                      disabled={saving || children.length <= 1}
                      onClick={() => removeChild(child.key)}
                    >
                      Remove
                    </button>
                  </span>
                </div>
                <div className="form-grid">
                  <label>
                    First name
                    <input
                      value={child.first_name}
                      onChange={(e) => updateChild(child.key, { first_name: e.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Last name
                    <input
                      value={child.last_name}
                      onChange={(e) => updateChild(child.key, { last_name: e.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Gender
                    <select
                      value={child.gender}
                      onChange={(e) =>
                        updateChild(child.key, { gender: e.target.value as Gender })
                      }
                      disabled={saving}
                    >
                      <option value="U">Unknown</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </label>
                  <label>
                    Birth date
                    <input
                      type="date"
                      value={child.birth_date ?? ''}
                      onChange={(e) => updateChild(child.key, { birth_date: e.target.value })}
                      disabled={saving}
                    />
                  </label>
                  <label>
                    Spouse first name
                    <input
                      value={child.spouse_first_name ?? ''}
                      onChange={(e) =>
                        updateChild(child.key, { spouse_first_name: e.target.value })
                      }
                      disabled={saving}
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Spouse last name
                    <input
                      value={child.spouse_last_name ?? ''}
                      onChange={(e) =>
                        updateChild(child.key, { spouse_last_name: e.target.value })
                      }
                      disabled={saving}
                      placeholder="Optional"
                    />
                  </label>
                  <label>
                    Spouse gender
                    <select
                      value={child.spouse_gender ?? 'U'}
                      onChange={(e) =>
                        updateChild(child.key, { spouse_gender: e.target.value as Gender })
                      }
                      disabled={saving}
                    >
                      <option value="U">Unknown</option>
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => setChildren((rows) => [...rows, emptyChild()])}
          >
            Add another child
          </button>
        </section>

        <section className="relation-group add-family-review">
          <h2>4. Save</h2>
          <p className="muted">
            Will create the primary person
            {namedChildren > 0 ? `, ${namedChildren} child${namedChildren === 1 ? '' : 'ren'}` : ''}
            {spouseCount > 0
              ? `, and ${spouseCount} child spouse${spouseCount === 1 ? '' : 's'}`
              : ''}
            , then link the selected partner and parent relationships.
          </p>
          {error ? <p className="form-error">{error}</p> : null}
          {failedStep ? (
            <p className="form-error">Stopped at: {failedStep}</p>
          ) : null}
          {partialCreated && partialCreated.length > 0 ? (
            <div className="add-family-partial">
              <p>
                Some people were already created. Open them to finish links manually, or fix the
                issue and avoid re-creating the same names.
              </p>
              <ul>
                {partialCreated.map((p) => (
                  <li key={p.id}>
                    <Link to={`/people/${p.id}/edit`}>
                      {p.first_name} {p.last_name}
                    </Link>{' '}
                    <span className="muted">({p.role.replace('_', ' ')})</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <button type="submit" disabled={saving || !partnerId}>
            {saving ? 'Saving family…' : 'Save entire family'}
          </button>
        </section>
      </form>
    </main>
  )
}
