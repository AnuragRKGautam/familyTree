import { useEffect, useState } from 'react'
import { searchPeople } from '../data/people'
import { DataAccessError } from '../data/errors'
import { formatSearchRelationHint } from '../data/personLabels'
import type { PersonSearchResult } from '../types/domain'

interface PersonSearchProps {
  onSelect: (personId: string) => void
}

export function PersonSearch({ onSelect }: PersonSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setError(null)
      return
    }

    const handle = window.setTimeout(() => {
      setLoading(true)
      void searchPeople(trimmed)
        .then((rows) => {
          setResults(rows)
          setError(null)
        })
        .catch((err: unknown) => {
          setResults([])
          setError(err instanceof DataAccessError ? err.message : 'Search failed')
        })
        .finally(() => setLoading(false))
    }, 250)

    return () => window.clearTimeout(handle)
  }, [query])

  return (
    <div className="person-search">
      <label className="search-label">
        Search people
        <input
          type="search"
          placeholder="Name or alias"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-controls="search-results"
        />
      </label>
      {loading ? <p className="muted">Searching…</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {!loading && query.trim() && results.length === 0 && !error ? (
        <p className="muted">No matches.</p>
      ) : null}
      <ul id="search-results" className="search-results">
        {results.map((row) => {
          const relation = formatSearchRelationHint(row.spouse_names, row.parent_names)
          return (
            <li key={row.id}>
              <button type="button" onClick={() => onSelect(row.id)}>
                <span className="search-result-main">
                  <span>
                    {row.first_name} {row.last_name}
                  </span>
                  {row.matched_alias ? (
                    <span className="muted"> alias: {row.matched_alias}</span>
                  ) : null}
                </span>
                {relation ? <span className="search-result-meta muted">{relation}</span> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
