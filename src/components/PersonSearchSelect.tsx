import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { Person } from '../types/domain'
import { formatPersonPickerLabel } from '../data/personLabels'

interface PersonSearchSelectProps {
  people: Person[]
  value: string
  onChange: (personId: string) => void
  placeholder?: string
  disabled?: boolean
  excludeIds?: string[]
  /** person id → spouse display names (shown to disambiguate duplicate names) */
  spouseNamesByPersonId?: Map<string, string[]>
}

export function PersonSearchSelect({
  people,
  value,
  onChange,
  placeholder = 'Search people by name…',
  disabled = false,
  excludeIds = [],
  spouseNamesByPersonId,
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

  const selectedLabel = useMemo(
    () =>
      selected
        ? formatPersonPickerLabel(selected, spouseNamesByPersonId?.get(selected.id))
        : '',
    [selected, spouseNamesByPersonId],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return available.slice(0, 40)
    return available
      .filter((p) => {
        const spouses = spouseNamesByPersonId?.get(p.id)?.join(' ') ?? ''
        const hay = `${p.first_name} ${p.last_name} ${spouses}`.toLowerCase()
        return hay.includes(q)
      })
      .slice(0, 40)
  }, [available, query, spouseNamesByPersonId])

  useEffect(() => {
    if (selected) setQuery(selectedLabel)
    else if (!value) setQuery('')
  }, [selected, value, selectedLabel])

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        if (selected) setQuery(selectedLabel)
        else setQuery('')
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [selected, selectedLabel])

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
            filtered.map((p) => {
              const spouses = spouseNamesByPersonId?.get(p.id) ?? []
              const name = `${p.first_name} ${p.last_name}`.trim()
              const dates = [p.birth_date, p.death_date].filter(Boolean).join(' – ')
              return (
                <li key={p.id} role="option" aria-selected={p.id === value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(p.id)
                      setQuery(
                        formatPersonPickerLabel(p, spouseNamesByPersonId?.get(p.id)),
                      )
                      setOpen(false)
                    }}
                  >
                    <span className="person-option-name">
                      {name}
                      {dates ? <span className="muted"> ({dates})</span> : null}
                    </span>
                    {spouses.length > 0 ? (
                      <span className="person-option-spouse muted">
                        {spouses.length === 1 ? 'Spouse: ' : 'Spouses: '}
                        {spouses.join(', ')}
                      </span>
                    ) : (
                      <span className="person-option-spouse muted">No spouse linked</span>
                    )}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
