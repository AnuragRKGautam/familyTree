import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loadTreePayload } from '../data/people'
import { DataAccessError } from '../data/errors'
import { mapToFamilyChartData } from '../chart/mapToFamilyChartData'
import type { Data } from 'family-chart'
import { useAuth } from '../app/useAuth'
import { FamilyChartView } from './FamilyChartView'
import { PersonProfile } from './PersonProfile'
import { PersonSearch } from './PersonSearch'
import { StatusMessage } from './StatusMessage'

export function TreePage() {
  const { personId } = useParams<{ personId?: string }>()
  const navigate = useNavigate()
  const { canEdit, isAdmin, profile, signOut } = useAuth()
  const [chartData, setChartData] = useState<Data>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const payload = await loadTreePayload()
      setChartData(mapToFamilyChartData(payload))
      setError(null)
      setDenied(false)
    } catch (err) {
      if (err instanceof DataAccessError && err.code === 'permission_denied') {
        setDenied(true)
      } else {
        setError(err instanceof DataAccessError ? err.message : 'Failed to load tree')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const mainId = useMemo(() => {
    if (personId && chartData.some((d) => d.id === personId)) return personId
    return chartData[0]?.id ?? null
  }, [personId, chartData])

  function selectPerson(id: string) {
    navigate(`/tree/${id}`)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>Family Tree</strong>
          <span className="muted">
            {' '}
            · {profile?.email} ({profile?.role})
          </span>
        </div>
        <nav className="topbar-nav">
          {canEdit ? <Link to="/people/new">Add person</Link> : null}
          {isAdmin ? <Link to="/admin/profiles">Access</Link> : null}
          <button type="button" className="linkish" onClick={() => void signOut()}>
            Sign out
          </button>
        </nav>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <PersonSearch onSelect={selectPerson} />
          {personId ? (
            <PersonProfile personId={personId} onFocus={selectPerson} />
          ) : (
            <p className="muted">Select a person to open their profile.</p>
          )}
        </aside>

        <section className="chart-pane">
          {loading ? <StatusMessage title="Loading family tree…" /> : null}
          {denied ? (
            <StatusMessage
              variant="error"
              title="Permission denied"
              detail="Your account is not approved to view this tree."
            />
          ) : null}
          {error ? (
            <StatusMessage variant="error" title="Could not load tree" detail={error} />
          ) : null}
          {!loading && !denied && !error && chartData.length === 0 ? (
            <StatusMessage
              variant="empty"
              title="No people yet"
              detail={
                canEdit
                  ? 'Add the first person to begin the tree.'
                  : 'Ask an editor to add family records.'
              }
            />
          ) : null}
          {!loading && !denied && !error && chartData.length > 0 ? (
            <FamilyChartView
              data={chartData}
              mainId={mainId}
              onPersonClick={selectPerson}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}
