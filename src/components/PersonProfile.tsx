import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPerson, listPeople } from '../data/people'
import { getSignedPhotoUrl } from '../data/photos'
import { DataAccessError } from '../data/errors'
import type { Person, PersonWithRelations } from '../types/domain'
import { StatusMessage } from './StatusMessage'
import { useAuth } from '../app/useAuth'

interface PersonProfileProps {
  personId: string
  onFocus: (personId: string) => void
}

function RelativeList({
  ids,
  label,
  relatives,
  onFocus,
}: {
  ids: string[]
  label: string
  relatives: Map<string, Person>
  onFocus: (personId: string) => void
}) {
  if (ids.length === 0) return null
  return (
    <div className="relative-group">
      <h3>{label}</h3>
      <ul>
        {ids.map((id) => {
          const rel = relatives.get(id)
          const name = rel ? `${rel.first_name} ${rel.last_name}` : id
          return (
            <li key={id}>
              <button type="button" className="linkish" onClick={() => onFocus(id)}>
                {name}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function PersonProfile({ personId, onFocus }: PersonProfileProps) {
  const { canEdit, canEditPerson } = useAuth()
  const [person, setPerson] = useState<PersonWithRelations | null>(null)
  const [relatives, setRelatives] = useState<Map<string, Person>>(new Map())
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState(personId)

  if (activeId !== personId) {
    setActiveId(personId)
    setLoading(true)
    setPerson(null)
    setError(null)
    setPhotoUrl(null)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [detail, all] = await Promise.all([getPerson(personId), listPeople()])
        if (cancelled) return
        if (!detail) {
          setPerson(null)
          setPhotoUrl(null)
          setError(null)
          return
        }
        setPerson(detail)
        setRelatives(new Map(all.map((p) => [p.id, p])))
        const url = await getSignedPhotoUrl(detail.photo_path)
        if (!cancelled) {
          setPhotoUrl(url)
          setError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setPerson(null)
          setError(err instanceof DataAccessError ? err.message : 'Failed to load profile')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [personId])

  if (loading) {
    return <StatusMessage title="Loading profile…" />
  }
  if (error) {
    return <StatusMessage variant="error" title="Could not load profile" detail={error} />
  }
  if (!person) {
    return <StatusMessage variant="empty" title="Person not found" />
  }

  return (
    <article className="person-profile">
      <header className="profile-header">
        {photoUrl ? (
          <img src={photoUrl} alt="" className="profile-photo" width={96} height={96} />
        ) : (
          <div className="profile-photo placeholder" aria-hidden />
        )}
        <div>
          <h2>
            {person.first_name} {person.last_name}
          </h2>
          {person.aliases.length > 0 ? (
            <p className="muted">Also known as: {person.aliases.join(', ')}</p>
          ) : null}
          <p className="muted">
            {[person.birth_date, person.death_date].filter(Boolean).join(' – ') || 'Dates unknown'}
          </p>
        </div>
      </header>

      {canEdit && canEditPerson(person.id) ? (
        <p>
          <Link to={`/people/${person.id}/edit`}>Edit record (link parents, partner, children, siblings)</Link>
        </p>
      ) : canEdit ? (
        <p className="muted">View only — this person is above your family access root.</p>
      ) : null}

      {person.biography ? <p className="biography">{person.biography}</p> : (
        <p className="muted">No biography yet.</p>
      )}

      <RelativeList ids={person.parent_ids} label="Parents" relatives={relatives} onFocus={onFocus} />
      <RelativeList ids={person.partner_ids} label="Partners" relatives={relatives} onFocus={onFocus} />
      <RelativeList ids={person.sibling_ids} label="Siblings" relatives={relatives} onFocus={onFocus} />
      <RelativeList ids={person.child_ids} label="Children" relatives={relatives} onFocus={onFocus} />
    </article>
  )
}
