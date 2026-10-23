import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Person } from '../types/domain'

interface PersonSearchSelectProps {
  people: Person[]
  value: string
  onChange: (personId: string) => void
  placeholder?: string
  disabled?: boolean
  excludeIds?: string[]
}

function labelFor(person: Person): string {
  const dates = [person.birth_date, person.death_date].filter(Boolean).join(' – ')
  return dates
    ? `${person.first_name} ${person.last_name} (${dates})`
    : `${person.first_name} ${person.last_name}`
}

export function PersonSearchSelect({
  people,
  value,
  onChange,
  placeholder = 'Search people by name…',
  disabled = false,
  excludeIds = [],
}: PersonSearchSelectProps) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const available = useMemo(
    () => people.filter((p) => !excludeIds.includes(p.id)),
    [people, excludeIds],
  )

  const selected = available.find((p) => p.id === value) ?? null

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available.slice(0, 40)
    return available
      .filter((p) => {
        const hay = `${p.first_name} ${p.last_name}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 40)
  }, [available, query])

  useEffect(() => {
    if (selected) setQuery(labelFor(selected))
    else if (!value) setQuery('')
  }, [selected, value])

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (selected) setQuery(labelFor(selected))
        else setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [selected])

  return (
    <div className="person-search-select" ref={rootRef}>
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {value ? (
        <button
          type="button"
          className="linkish clear-pick"
          disabled={disabled}
          onClick={() => {
            onChange('')
            setQuery('')
            setOpen(true)
          }}
        >
          Clear
        </button>
      ) : null}
      {open && !disabled ? (
        <ul id={listId} className="person-search-options" role="listbox">
          {filtered.length === 0 ? (
            <li className="muted">No matching people</li>
          ) : (
            filtered.map((p) => (
              <li key={p.id} role="option" aria-selected={p.id === value}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(p.id)
                    setQuery(labelFor(p))
                    setOpen(false)
                  }}
                >
                  {labelFor(p)}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
