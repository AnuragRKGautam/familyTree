import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FamilyChart } from './FamilyChart'
import {
  DEFAULT_FOCUS_PERSON_ID,
  displayName,
  fictionalFamily,
} from './fictionalFamily'
import { buildPersonView, searchPeople } from './graphQueries'
import { toFamilyChartData } from './toFamilyChartData'

export function PrototypePage() {
  const graph = fictionalFamily
  const chartData = useMemo(() => toFamilyChartData(graph), [graph])
  const [selectedId, setSelectedId] = useState<string>(DEFAULT_FOCUS_PERSON_ID)
  const [query, setQuery] = useState('')
  const [fitRequestId, setFitRequestId] = useState(0)
  const [focusNonce, setFocusNonce] = useState(0)

  const selected = buildPersonView(graph, selectedId)
  const hits = searchPeople(graph, query)

  function selectPerson(id: string) {
    setSelectedId(id)
  }

  function focusSelected() {
    setFocusNonce((n) => n + 1)
  }

  return (
    <div className="prototype-shell">
      <header className="prototype-topbar">
        <div>
          <strong>Local chart prototype</strong>
          <span className="muted"> · fictional data · no backend</span>
        </div>
        <nav className="topbar-nav">
          <Link to="/docs-limitations">Limitations</Link>
          <Link to="/">App sign-in</Link>
        </nav>
      </header>

      <div className="prototype-workspace">
        <aside className="prototype-sidebar">
          <section className="prototype-controls">
            <label className="search-label">
              Search by name
              <input
                type="search"
                value={query}
                placeholder="e.g. James, Ash, Maya"
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            {query.trim() ? (
              <ul className="search-results">
                {hits.length === 0 ? <li className="muted">No matches</li> : null}
                {hits.map((hit) => (
                  <li key={hit.id}>
                    <button type="button" onClick={() => selectPerson(hit.id)}>
                      <span>{hit.label}</span>
                      {hit.detail ? <span className="muted"> · {hit.detail}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="prototype-actions">
              <button type="button" onClick={focusSelected}>
                Focus selected
              </button>
              <button type="button" onClick={() => setFitRequestId((n) => n + 1)}>
                Fit to view
              </button>
            </div>
            <p className="muted small">
              Zoom with scroll wheel; pan by dragging the chart background.
            </p>
          </section>

          <section className="prototype-profile">
            {selected ? (
              <>
                <h2>{displayName(selected.person)}</h2>
                <p className="muted">
                  {[
                    selected.person.birthYear != null ? `b. ${selected.person.birthYear}` : null,
                    selected.person.deathYear != null ? `d. ${selected.person.deathYear}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Dates unknown'}
                </p>
                <p className="biography">{selected.person.biography}</p>

                <RelBlock
                  title="Parents"
                  rows={selected.parents.map((r) => ({
                    id: r.person.id,
                    label: `${displayName(r.person)} (${r.kind})`,
                  }))}
                  onSelect={selectPerson}
                />
                <RelBlock
                  title="Partners"
                  rows={selected.partners.map((p) => ({
                    id: p.id,
                    label: displayName(p),
                  }))}
                  onSelect={selectPerson}
                />
                <RelBlock
                  title="Children"
                  rows={selected.children.map((r) => ({
                    id: r.person.id,
                    label: `${displayName(r.person)} (${r.kind})`,
                  }))}
                  onSelect={selectPerson}
                />
              </>
            ) : (
              <p className="muted">Select a person on the chart or from search.</p>
            )}
          </section>
        </aside>

        <section className="prototype-chart-pane">
          <FamilyChart
            data={chartData}
            focusId={selectedId}
            focusNonce={focusNonce}
            onPersonSelect={selectPerson}
            fitRequestId={fitRequestId}
          />
        </section>
      </div>
    </div>
  )
}

function RelBlock({
  title,
  rows,
  onSelect,
}: {
  title: string
  rows: Array<{ id: string; label: string }>
  onSelect: (id: string) => void
}) {
  if (rows.length === 0) return null
  return (
    <div className="relative-group">
      <h3>{title}</h3>
      <ul>
        {rows.map((row) => (
          <li key={`${title}-${row.id}-${row.label}`}>
            <button type="button" className="linkish" onClick={() => onSelect(row.id)}>
              {row.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
