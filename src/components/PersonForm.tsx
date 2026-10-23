import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  addParentChild,
  addPartnership,
  createPerson,
  getPerson,
  listPeople,
  removeParentChild,
  removePartnership,
  updatePerson,
} from '../data/people'
import { uploadPersonPhoto } from '../data/photos'
import { DataAccessError } from '../data/errors'
import type { Gender, Person, PersonWriteInput } from '../types/domain'
import { useAuth } from '../app/useAuth'
import { StatusMessage } from './StatusMessage'

const emptyForm: PersonWriteInput = {
  first_name: '',
  last_name: '',
  gender: 'U',
  birth_date: '',
  death_date: '',
  biography: '',
  aliases: [],
}

export function PersonForm() {
  const { personId } = useParams<{ personId: string }>()
  const isEdit = Boolean(personId) && personId !== 'new'
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [form, setForm] = useState<PersonWriteInput>(emptyForm)
  const [aliasText, setAliasText] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [parentIds, setParentIds] = useState<string[]>([])
  const [partnerIds, setPartnerIds] = useState<string[]>([])
  const [childIds, setChildIds] = useState<string[]>([])
  const [linkParentId, setLinkParentId] = useState('')
  const [linkPartnerId, setLinkPartnerId] = useState('')
  const [linkChildId, setLinkChildId] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!canEdit) return
    void listPeople().then(setPeople).catch(() => setPeople([]))
  }, [canEdit])

  useEffect(() => {
    if (!isEdit || !personId) return
    let cancelled = false
    setLoading(true)
    void getPerson(personId)
      .then((person) => {
        if (cancelled || !person) return
        setForm({
          first_name: person.first_name,
          last_name: person.last_name,
          gender: person.gender,
          birth_date: person.birth_date ?? '',
          death_date: person.death_date ?? '',
          biography: person.biography ?? '',
          aliases: person.aliases,
        })
        setAliasText(person.aliases.join(', '))
        setParentIds(person.parent_ids)
        setPartnerIds(person.partner_ids)
        setChildIds(person.child_ids)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof DataAccessError ? err.message : 'Failed to load person')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isEdit, personId])

  if (!canEdit) {
    return (
      <StatusMessage
        variant="error"
        title="Permission denied"
        detail="Your role cannot add or edit records."
      />
    )
  }

  if (loading) return <StatusMessage title="Loading form…" />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const payload: PersonWriteInput = {
      ...form,
      aliases: aliasText
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
    }
    try {
      const saved = isEdit && personId
        ? await updatePerson(personId, payload)
        : await createPerson(payload)
      if (photoFile) {
        await uploadPersonPhoto(saved.id, photoFile)
      }
      navigate(`/people/${saved.id}`)
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function linkParent() {
    if (!personId || !linkParentId) return
    try {
      await addParentChild(linkParentId, personId)
      setParentIds((ids) => [...new Set([...ids, linkParentId])])
      setLinkParentId('')
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not link parent')
    }
  }

  async function linkPartner() {
    if (!personId || !linkPartnerId) return
    try {
      await addPartnership(personId, linkPartnerId)
      setPartnerIds((ids) => [...new Set([...ids, linkPartnerId])])
      setLinkPartnerId('')
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not link partner')
    }
  }

  async function linkChild() {
    if (!personId || !linkChildId) return
    try {
      await addParentChild(personId, linkChildId)
      setChildIds((ids) => [...new Set([...ids, linkChildId])])
      setLinkChildId('')
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not link child')
    }
  }

  const otherPeople = people.filter((p) => p.id !== personId)

  return (
    <main className="page-panel">
      <h1>{isEdit ? 'Edit person' : 'Add person'}</h1>
      <form className="stack-form" onSubmit={onSubmit}>
        <label>
          First name
          <input
            required
            value={form.first_name}
            onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
          />
        </label>
        <label>
          Last name
          <input
            required
            value={form.last_name}
            onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
          />
        </label>
        <label>
          Gender
          <select
            value={form.gender}
            onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as Gender }))}
          >
            <option value="F">F</option>
            <option value="M">M</option>
            <option value="U">Unknown</option>
          </select>
        </label>
        <label>
          Birth date
          <input
            type="date"
            value={form.birth_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, birth_date: e.target.value }))}
          />
        </label>
        <label>
          Death date
          <input
            type="date"
            value={form.death_date ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, death_date: e.target.value }))}
          />
        </label>
        <label>
          Aliases (comma-separated)
          <input value={aliasText} onChange={(e) => setAliasText(e.target.value)} />
        </label>
        <label>
          Biography (plain text)
          <textarea
            rows={5}
            value={form.biography ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, biography: e.target.value }))}
          />
        </label>
        <label>
          Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>

      {isEdit && personId ? (
        <section className="relation-editor">
          <h2>Relationships</h2>
          <div className="relation-row">
            <select value={linkParentId} onChange={(e) => setLinkParentId(e.target.value)}>
              <option value="">Add parent…</option>
              {otherPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void linkParent()}>
              Link parent
            </button>
          </div>
          <ul>
            {parentIds.map((id) => {
              const p = people.find((x) => x.id === id)
              return (
                <li key={id}>
                  Parent: {p ? `${p.first_name} ${p.last_name}` : id}{' '}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      void removeParentChild(id, personId).then(() =>
                        setParentIds((ids) => ids.filter((x) => x !== id)),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="relation-row">
            <select value={linkPartnerId} onChange={(e) => setLinkPartnerId(e.target.value)}>
              <option value="">Add partner…</option>
              {otherPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void linkPartner()}>
              Link partner
            </button>
          </div>
          <ul>
            {partnerIds.map((id) => {
              const p = people.find((x) => x.id === id)
              return (
                <li key={id}>
                  Partner: {p ? `${p.first_name} ${p.last_name}` : id}{' '}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      void removePartnership(personId, id).then(() =>
                        setPartnerIds((ids) => ids.filter((x) => x !== id)),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="relation-row">
            <select value={linkChildId} onChange={(e) => setLinkChildId(e.target.value)}>
              <option value="">Add child…</option>
              {otherPeople.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => void linkChild()}>
              Link child
            </button>
          </div>
          <ul>
            {childIds.map((id) => {
              const p = people.find((x) => x.id === id)
              return (
                <li key={id}>
                  Child: {p ? `${p.first_name} ${p.last_name}` : id}{' '}
                  <button
                    type="button"
                    className="linkish"
                    onClick={() =>
                      void removeParentChild(personId, id).then(() =>
                        setChildIds((ids) => ids.filter((x) => x !== id)),
                      )
                    }
                  >
                    Remove
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </main>
  )
}
