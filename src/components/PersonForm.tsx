import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  addParentChild,
  addPartnership,
  createPerson,
  getPerson,
  linkSiblingViaParents,
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
import { PersonSearchSelect } from './PersonSearchSelect'

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
  const { personId: routePersonId } = useParams<{ personId: string }>()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')
  const isNewRoute = !routePersonId || routePersonId === 'new'
  const navigate = useNavigate()
  const { canEdit } = useAuth()

  const [savedId, setSavedId] = useState<string | null>(isNewRoute ? null : (routePersonId ?? null))
  const personId = isNewRoute ? null : savedId
  const isEdit = Boolean(personId)

  const addPersonHref = useMemo(() => {
    const currentId = isNewRoute ? null : (savedId ?? routePersonId)
    if (!currentId) return '/people/new'
    const back = `/people/${currentId}/edit`
    return `/people/new?returnTo=${encodeURIComponent(back)}`
  }, [isNewRoute, savedId, routePersonId])

  const [form, setForm] = useState<PersonWriteInput>(emptyForm)
  const [aliasText, setAliasText] = useState('')
  const [people, setPeople] = useState<Person[]>([])
  const [parentIds, setParentIds] = useState<string[]>([])
  const [partnerIds, setPartnerIds] = useState<string[]>([])
  const [childIds, setChildIds] = useState<string[]>([])
  const [siblingIds, setSiblingIds] = useState<string[]>([])
  const [linkParentId, setLinkParentId] = useState('')
  const [linkPartnerId, setLinkPartnerId] = useState('')
  const [linkChildId, setLinkChildId] = useState('')
  const [linkSiblingId, setLinkSiblingId] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(!isNewRoute)
  const [saving, setSaving] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Reset when switching between /people/new and /people/:id/edit (same component type).
  useEffect(() => {
    if (isNewRoute) {
      setSavedId(null)
      setForm(emptyForm)
      setAliasText('')
      setParentIds([])
      setPartnerIds([])
      setChildIds([])
      setSiblingIds([])
      setLinkParentId('')
      setLinkPartnerId('')
      setLinkChildId('')
      setLinkSiblingId('')
      setPhotoFile(null)
      setLoading(false)
      setError(null)
      setNotice(
        returnTo
          ? 'Create the new person, then you will return to the previous edit page to link them.'
          : null,
      )
      return
    }
    if (routePersonId && routePersonId !== 'new') {
      setSavedId(routePersonId)
      setLoading(true)
      setError(null)
      setNotice(null)
    }
  }, [isNewRoute, routePersonId, returnTo])

  useEffect(() => {
    if (!canEdit) return
    void listPeople().then(setPeople).catch(() => setPeople([]))
  }, [canEdit, personId])

  useEffect(() => {
    if (!personId) return
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
        setSiblingIds(person.sibling_ids)
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
  }, [personId])

  const otherPeople = useMemo(
    () => people.filter((p) => p.id !== personId),
    [people, personId],
  )

  if (!canEdit) {
    return (
      <StatusMessage
        variant="error"
        title="Permission denied"
        detail="Your role cannot add or edit records. Set your profile role to editor or admin in Supabase."
      />
    )
  }

  if (loading) return <StatusMessage title="Loading form…" />

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)
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
        setPhotoFile(null)
      }
      setSavedId(saved.id)
      setPeople((rows) => {
        const without = rows.filter((p) => p.id !== saved.id)
        return [...without, saved].sort((a, b) =>
          `${a.last_name}${a.first_name}`.localeCompare(`${b.last_name}${b.first_name}`),
        )
      })
      setNotice('Details saved. Use Relationships below to link family.')

      if (isNewRoute && returnTo && returnTo.startsWith('/')) {
        navigate(returnTo, { replace: true })
        return
      }
      if (isNewRoute) {
        navigate(`/people/${saved.id}/edit`, { replace: true })
      }
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function withLinkError(action: () => Promise<void>) {
    setLinking(true)
    setError(null)
    setNotice(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof DataAccessError ? err.message : 'Could not update relationship')
    } finally {
      setLinking(false)
    }
  }

  async function refreshRelations(id: string) {
    const detail = await getPerson(id)
    if (!detail) return
    setParentIds(detail.parent_ids)
    setPartnerIds(detail.partner_ids)
    setChildIds(detail.child_ids)
    setSiblingIds(detail.sibling_ids)
    setPeople(await listPeople())
  }

  async function linkParent() {
    if (!personId || !linkParentId) return
    await withLinkError(async () => {
      await addParentChild(linkParentId, personId)
      setLinkParentId('')
      await refreshRelations(personId)
    })
  }

  async function linkPartner() {
    if (!personId || !linkPartnerId) return
    await withLinkError(async () => {
      await addPartnership(personId, linkPartnerId)
      setLinkPartnerId('')
      await refreshRelations(personId)
    })
  }

  async function linkChild() {
    if (!personId || !linkChildId) return
    await withLinkError(async () => {
      await addParentChild(personId, linkChildId)
      setLinkChildId('')
      await refreshRelations(personId)
    })
  }

  async function linkSibling() {
    if (!personId || !linkSiblingId) return
    await withLinkError(async () => {
      await linkSiblingViaParents(personId, linkSiblingId, parentIds)
      setLinkSiblingId('')
      await refreshRelations(personId)
    })
  }

  function personLabel(id: string): string {
    const p = people.find((x) => x.id === id)
    return p ? `${p.first_name} ${p.last_name}` : id
  }

  return (
    <main className="page-panel">
      <div className="form-toolbar">
        <Link to={personId ? `/tree/${personId}` : '/tree'}>← Back to tree</Link>
        {isEdit ? (
          <button
            type="button"
            className="button-link"
            onClick={() => navigate(addPersonHref)}
          >
            Add person
          </button>
        ) : null}
      </div>

      <h1>{isEdit ? 'Edit person' : 'Add person'}</h1>
      <p className="lede">
        {isEdit
          ? 'Update details, search existing people to link, or add a new person first.'
          : returnTo
            ? 'Create this person, then you will return to the previous edit page to link them.'
            : 'Save the person first, then link parents, partners, children, and siblings.'}
      </p>

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
        {notice ? <p className="muted">{notice}</p> : null}
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : isEdit ? 'Save details' : 'Create person'}
        </button>
      </form>

      <section className="relation-editor">
        <div className="form-toolbar">
          <h2>Relationships</h2>
          {isEdit ? (
            <button
              type="button"
              className="button-link"
              onClick={() => navigate(addPersonHref)}
            >
              Add person
            </button>
          ) : null}
        </div>

        {!isEdit ? (
          <p className="muted">
            Create and save this person above first. Then you can search and link relatives here.
          </p>
        ) : (
          <>
            <p className="muted small">
              Type a name to search existing people, then click Link. Need someone new? Use{' '}
              <Link to={addPersonHref}>Add person</Link> — you will come back here afterward.
            </p>

            {otherPeople.length === 0 ? (
              <p className="muted">
                No other people yet. <Link to={addPersonHref}>Add a person</Link> to link.
              </p>
            ) : null}

            <RelationBlock
              title="Parents"
              hint="Search and link this person’s parents."
              selectValue={linkParentId}
              onSelectChange={setLinkParentId}
              options={otherPeople}
              excludeIds={[...parentIds]}
              linkedIds={parentIds}
              linkLabel="Link parent"
              onLink={() => void linkParent()}
              onRemove={(id) =>
                void withLinkError(async () => {
                  if (!personId) return
                  await removeParentChild(id, personId)
                  await refreshRelations(personId)
                })
              }
              personLabel={personLabel}
              linking={linking}
            />

            <RelationBlock
              title="Partner / spouse"
              hint="Search and link a spouse or partner."
              selectValue={linkPartnerId}
              onSelectChange={setLinkPartnerId}
              options={otherPeople}
              excludeIds={[...partnerIds]}
              linkedIds={partnerIds}
              linkLabel="Link partner"
              onLink={() => void linkPartner()}
              onRemove={(id) =>
                void withLinkError(async () => {
                  if (!personId) return
                  await removePartnership(personId, id)
                  await refreshRelations(personId)
                })
              }
              personLabel={personLabel}
              linking={linking}
            />

            <RelationBlock
              title="Children"
              hint="Search and link children."
              selectValue={linkChildId}
              onSelectChange={setLinkChildId}
              options={otherPeople}
              excludeIds={[...childIds]}
              linkedIds={childIds}
              linkLabel="Link child"
              onLink={() => void linkChild()}
              onRemove={(id) =>
                void withLinkError(async () => {
                  if (!personId) return
                  await removeParentChild(personId, id)
                  await refreshRelations(personId)
                })
              }
              personLabel={personLabel}
              linking={linking}
            />

            <div className="relation-group">
              <h3>Siblings</h3>
              <p className="muted small">
                Siblings share parents. Add at least one parent first, then search for a sibling to
                attach to the same parent(s).
              </p>
              {parentIds.length === 0 ? (
                <p className="muted">Add a parent above before linking siblings.</p>
              ) : (
                <div className="relation-row">
                  <PersonSearchSelect
                    people={otherPeople}
                    value={linkSiblingId}
                    onChange={setLinkSiblingId}
                    excludeIds={siblingIds}
                    disabled={linking}
                    placeholder="Search sibling by name…"
                  />
                  <button
                    type="button"
                    disabled={!linkSiblingId || linking}
                    onClick={() => void linkSibling()}
                  >
                    Link sibling
                  </button>
                </div>
              )}
              <ul>
                {siblingIds.length === 0 ? <li className="muted">None linked yet.</li> : null}
                {siblingIds.map((id) => (
                  <li key={id}>
                    Sibling: {personLabel(id)}{' '}
                    <span className="muted">(unlink via shared parents if needed)</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

function RelationBlock({
  title,
  hint,
  selectValue,
  onSelectChange,
  options,
  excludeIds,
  linkedIds,
  linkLabel,
  onLink,
  onRemove,
  personLabel,
  linking,
}: {
  title: string
  hint: string
  selectValue: string
  onSelectChange: (value: string) => void
  options: Person[]
  excludeIds: string[]
  linkedIds: string[]
  linkLabel: string
  onLink: () => void
  onRemove: (id: string) => void
  personLabel: (id: string) => string
  linking: boolean
}) {
  return (
    <div className="relation-group">
      <h3>{title}</h3>
      <p className="muted small">{hint}</p>
      <div className="relation-row">
        <PersonSearchSelect
          people={options}
          value={selectValue}
          onChange={onSelectChange}
          excludeIds={excludeIds}
          disabled={linking || options.length === 0}
          placeholder={`Search ${title.toLowerCase()}…`}
        />
        <button type="button" disabled={!selectValue || linking} onClick={onLink}>
          {linkLabel}
        </button>
      </div>
      <ul>
        {linkedIds.length === 0 ? <li className="muted">None linked yet.</li> : null}
        {linkedIds.map((id) => (
          <li key={id}>
            {personLabel(id)}{' '}
            <button type="button" className="linkish" disabled={linking} onClick={() => onRemove(id)}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
