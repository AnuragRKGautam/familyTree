import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { loadTreePayload } from '../data/people'
import { DataAccessError } from '../data/errors'
import { mapToFamilyChartData } from '../chart/mapToFamilyChartData'
import type { Data } from 'family-chart'
import { useAuth } from '../app/useAuth'
import { AppTopbar } from './AppTopbar'
import { FamilyChartView, type FamilyChartViewHandle } from './FamilyChartView'
import { PersonProfile } from './PersonProfile'
import { PersonSearch } from './PersonSearch'
import { StatusMessage } from './StatusMessage'

const SIDEBAR_STORAGE_KEY = 'familytree.sidebarOpen'
const NARROW_MQ = '(max-width: 900px)'

function isNarrowScreen(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(NARROW_MQ).matches
}

function readSidebarOpen(): boolean {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY)
    if (raw === null) {
      // On phones, start with the chart visible.
      return !isNarrowScreen()
    }
    return raw !== '0'
  } catch {
    return !isNarrowScreen()
  }
}

export function TreePage() {
  const { personId } = useParams<{ personId?: string }>()
  const navigate = useNavigate()
  const { canEdit, isAdmin, profile, signOut, accessRootIds, accessScopeIds, isLoggedIn, status } =
    useAuth()
  const [chartData, setChartData] = useState<Data>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [denied, setDenied] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(readSidebarOpen)
  const [layoutKey, setLayoutKey] = useState(0)
  const chartRef = useRef<FamilyChartViewHandle | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarOpen ? '1' : '0')
    } catch {
      /* ignore */
    }
    const id = window.setTimeout(() => {
      setLayoutKey((k) => k + 1)
      chartRef.current?.reflow()
    }, 80)
    return () => window.clearTimeout(id)
  }, [sidebarOpen])

  useEffect(() => {
    const mq = window.matchMedia(NARROW_MQ)
    function onChange() {
      // First visit with no stored preference: keep chart-first on narrow screens.
      try {
        if (localStorage.getItem(SIDEBAR_STORAGE_KEY) !== null) return
      } catch {
        /* ignore */
      }
      setSidebarOpen(!mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

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
  }, [refresh, isLoggedIn])

  const mainId = useMemo(() => {
    if (personId && chartData.some((d) => d.id === personId)) return personId
    return chartData[0]?.id ?? null
  }, [personId, chartData])

  function selectPerson(id: string) {
    navigate(`/tree/${id}`)
    if (isNarrowScreen()) setSidebarOpen(true)
  }

  return (
    <div className="app-shell">
      <AppTopbar
        subtitle={
          isLoggedIn && profile ? (
            <>
              · {profile.email} ({profile.role}
              {!profile.approved ? ', pending approval' : ''})
            </>
          ) : (
            <> · Public view</>
          )
        }
      >
        <Link to="/relation">Find relation</Link>
        {canEdit && (isAdmin || (accessScopeIds && accessScopeIds.size > 0)) ? (
          <>
            <Link to="/people/new">Add person</Link>
            <Link to="/people/add-family">Add family</Link>
          </>
        ) : null}
        {isAdmin ? <Link to="/admin/profiles">Users & access</Link> : null}
        {isLoggedIn ? (
          <button type="button" className="linkish" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : (
          <>
            <Link to="/signin">Sign in</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </AppTopbar>

      {status === 'unapproved' ? (
        <p className="banner-warn">
          You are signed in but not approved yet. You can browse the tree and see dates; editing
          unlocks after an admin approves your account.
        </p>
      ) : null}

      {!isAdmin && canEdit && accessRootIds.length === 0 ? (
        <p className="banner-warn">
          You are an editor without a family access root. Ask an admin to assign a person under{' '}
          <strong>Users & access</strong> so you can edit that branch.
        </p>
      ) : null}

      <div className={`workspace${sidebarOpen ? '' : ' workspace--sidebar-collapsed'}`}>
        {sidebarOpen ? (
          <aside className="sidebar">
            <div className="sidebar-toolbar">
              <span className="sidebar-toolbar-label">Profile</span>
              <button
                type="button"
                className="sidebar-toggle"
                onClick={() => setSidebarOpen(false)}
                aria-expanded={true}
                aria-controls="tree-sidebar"
                title="Minimize panel"
              >
                Minimize panel
              </button>
            </div>
            <div id="tree-sidebar" className="sidebar-body">
              <PersonSearch onSelect={selectPerson} />
              {personId ? (
                <PersonProfile personId={personId} onFocus={selectPerson} />
              ) : (
                <p className="muted">Select a person to open their profile.</p>
              )}
            </div>
          </aside>
        ) : (
          <div className="sidebar-rail" aria-hidden={false}>
            <button
              type="button"
              className="sidebar-toggle sidebar-toggle--expand"
              onClick={() => setSidebarOpen(true)}
              aria-expanded={false}
              title="Show panel"
            >
              Show panel
            </button>
          </div>
        )}

        <section className="chart-pane">
          {!loading && !denied && !error && chartData.length > 0 ? (
            <div className="chart-toolbar">
              <button type="button" onClick={() => chartRef.current?.fitToView()}>
                Fit to view
              </button>
              <span className="muted">Pinch to zoom · drag to pan · long-press a card for details</span>
            </div>
          ) : null}
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
              ref={chartRef}
              data={chartData}
              mainId={mainId}
              onPersonClick={selectPerson}
              layoutKey={layoutKey}
            />
          ) : null}
        </section>
      </div>
    </div>
  )
}
