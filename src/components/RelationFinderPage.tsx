import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Data } from 'family-chart'
import { loadTreePayload, listPartnerships, listPeople } from '../data/people'
import { buildSpouseNamesByPersonId } from '../data/personLabels'
import { mapToFamilyChartData } from '../chart/mapToFamilyChartData'
import { findRelationBetween, relationSentence } from '../chart/findRelation'
import { DataAccessError } from '../data/errors'
import type { Partnership, Person } from '../types/domain'
import { PersonSearchSelect } from './PersonSearchSelect'
import { FamilyChartView } from './FamilyChartView'
import { StatusMessage } from './StatusMessage'

export function RelationFinderPage() {
  const navigate = useNavigate()
  const [people, setPeople] = useState<Person[]>([])
  const [partnerships, setPartnerships] = useState<Partnership[]>([])
  const [chartData, setChartData] = useState<Data>([])
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [finding, setFinding] = useState(false)
  const [resultLabel, setResultLabel] = useState<string | null>(null)
  const [pathData, setPathData] = useState<Data | null>(null)
  const [chartRootId, setChartRootId] = useState<string | null>(null)
  const [resultError, setResultError] = useState<string | null>(null)

  const spouseNamesByPersonId = useMemo(
    () => buildSpouseNamesByPersonId(people, partnerships),
    [people, partnerships],
  )

  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void Promise.all([listPeople(), listPartnerships(), loadTreePayload()])
      .then(([nextPeople, nextPartnerships, payload]) => {
        if (cancelled) return
        setPeople(nextPeople)
        setPartnerships(nextPartnerships)
        setChartData(mapToFamilyChartData(payload))
        setError(null)
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
  }, [])

  function nameOf(id: string): string {
    const p = peopleById.get(id)
    return p ? `${p.first_name} ${p.last_name}` : id
  }

  function onFind() {
    setResultError(null)
    setResultLabel(null)
    setPathData(null)
    setChartRootId(null)
    if (!fromId || !toId) {
      setResultError('Select both people.')
      return
    }
    setFinding(true)
    // Defer so the button state paints; kinship walks can be heavy.
    window.setTimeout(() => {
      try {
        const result = findRelationBetween(chartData, fromId, toId)
        setResultLabel(result.kinshipLabel)
        setPathData(result.pathData)
        setChartRootId(result.chartRootId)
        if (!result.kinshipLabel && !result.pathData) {
          setResultError(relationSentence(nameOf(fromId), nameOf(toId), null))
        } else if (result.kinshipLabel && !result.pathData) {
          setResultError(
            'Related, but a connection chart could not be built for these two people.',
          )
        }
      } catch (err) {
        setResultError(err instanceof Error ? err.message : 'Could not compute relation')
      } finally {
        setFinding(false)
      }
    }, 0)
  }

  function swapPeople() {
    setFromId(toId)
    setToId(fromId)
    setResultLabel(null)
    setPathData(null)
    setChartRootId(null)
    setResultError(null)
  }

  if (loading) return <StatusMessage title="Loading people…" />
  if (error) {
    return <StatusMessage variant="error" title="Could not load tree data" detail={error} />
  }

  const sentence =
    resultLabel && fromId && toId
      ? relationSentence(nameOf(fromId), nameOf(toId), resultLabel)
      : null

  return (
    <main className="page-panel relation-page">
      <p>
        <Link to="/tree">← Back to tree</Link>
      </p>
      <h1>Find relation</h1>
      <p className="lede">
        Choose two people to see how they are related, with a small chart of the connecting path.
      </p>

      <div className="relation-picker">
        <label>
          Person A
          <PersonSearchSelect
            people={people}
            value={fromId}
            onChange={setFromId}
            spouseNamesByPersonId={spouseNamesByPersonId}
            placeholder="Search first person…"
          />
        </label>
        <button type="button" className="relation-swap" onClick={swapPeople} title="Swap people">
          Swap
        </button>
        <label>
          Person B
          <PersonSearchSelect
            people={people}
            value={toId}
            onChange={setToId}
            spouseNamesByPersonId={spouseNamesByPersonId}
            excludeIds={fromId ? [fromId] : []}
            placeholder="Search second person…"
          />
        </label>
        <button type="button" disabled={finding || !fromId || !toId} onClick={onFind}>
          {finding ? 'Finding…' : 'Find relation'}
        </button>
      </div>

      {resultError ? <p className="form-error">{resultError}</p> : null}
      {sentence ? (
        <p className="relation-result" role="status">
          {sentence}
        </p>
      ) : null}

      {pathData && pathData.length > 0 ? (
        <section className="relation-path-chart" aria-label="Relation path chart">
          <h2>Connection path</h2>
          <p className="muted small">
            Rooted at the shared connection
            {chartRootId ? ` (${nameOf(chartRootId)})` : ''}, with both sides of the relation.
            Labels are relative to {nameOf(fromId)}. Click a card to open them on the main tree.
          </p>
          <FamilyChartView
            data={pathData}
            mainId={chartRootId ?? fromId}
            onPersonClick={(id) => navigate(`/tree/${id}`)}
            cardDisplay={[
              ['kinship'],
              ['first name', 'last name'],
            ]}
            ancestryDepth={12}
            progenyDepth={12}
            singleParentEmptyCard={false}
            cardXSpacing={200}
            cardYSpacing={90}
            balanceSpouses={true}
            hostClassName="family-chart-host family-chart-host--relation"
          />
        </section>
      ) : null}
    </main>
  )
}
