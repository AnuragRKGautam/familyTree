import { useEffect, useRef } from 'react'
import type { Data } from 'family-chart'
import {
  createFamilyChartAdapter,
  type FamilyChartAdapter,
  type FamilyChartAdapterOptions,
  type TreePosition,
} from '../chart/familyChartAdapter'

interface FamilyChartViewProps {
  data: Data
  mainId: string | null
  onPersonClick: (personId: string) => void
  cardDisplay?: string[][]
  ancestryDepth?: number
  progenyDepth?: number
  singleParentEmptyCard?: boolean
  cardXSpacing?: number
  cardYSpacing?: number
  balanceSpouses?: boolean
  treePosition?: TreePosition
  hostClassName?: string
}

export function FamilyChartView({
  data,
  mainId,
  onPersonClick,
  cardDisplay,
  ancestryDepth,
  progenyDepth,
  singleParentEmptyCard,
  cardXSpacing,
  cardYSpacing,
  balanceSpouses,
  treePosition = 'main_to_middle',
  hostClassName = 'family-chart-host',
}: FamilyChartViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<FamilyChartAdapter | null>(null)
  const onClickRef = useRef(onPersonClick)
  const optionsRef = useRef({
    cardDisplay,
    ancestryDepth,
    progenyDepth,
    singleParentEmptyCard,
    cardXSpacing,
    cardYSpacing,
    balanceSpouses,
    treePosition,
    mainId,
  })

  useEffect(() => {
    onClickRef.current = onPersonClick
  }, [onPersonClick])

  useEffect(() => {
    optionsRef.current = {
      cardDisplay,
      ancestryDepth,
      progenyDepth,
      singleParentEmptyCard,
      cardXSpacing,
      cardYSpacing,
      balanceSpouses,
      treePosition,
      mainId,
    }
  }, [
    cardDisplay,
    ancestryDepth,
    progenyDepth,
    singleParentEmptyCard,
    cardXSpacing,
    cardYSpacing,
    balanceSpouses,
    treePosition,
    mainId,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el || data.length === 0) return

    const opts = optionsRef.current
    const adapterOptions: FamilyChartAdapterOptions = {
      container: el,
      data,
      mainId: opts.mainId ?? undefined,
      onCardClick: (id) => onClickRef.current(id),
      cardDisplay: opts.cardDisplay,
      ancestryDepth: opts.ancestryDepth,
      progenyDepth: opts.progenyDepth,
      singleParentEmptyCard: opts.singleParentEmptyCard,
      cardXSpacing: opts.cardXSpacing,
      cardYSpacing: opts.cardYSpacing,
      balanceSpouses: opts.balanceSpouses,
      treePosition: opts.treePosition,
    }

    adapterRef.current?.destroy()
    adapterRef.current = null
    try {
      adapterRef.current = createFamilyChartAdapter(adapterOptions)
    } catch (err) {
      console.error('Family chart failed to render', err)
      el.replaceChildren()
      const msg = document.createElement('p')
      msg.className = 'muted'
      msg.textContent =
        err instanceof Error
          ? `Could not draw the family chart: ${err.message}`
          : 'Could not draw the family chart. Check parent links (each person can have at most two parents).'
      el.appendChild(msg)
    }

    return () => {
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
  }, [data, treePosition])

  useEffect(() => {
    // For fit / fit_top the adapter already placed the tree; re-focusing with
    // main_to_middle would shove the root into the vertical center.
    if (!mainId || treePosition === 'fit' || treePosition === 'fit_top') return
    adapterRef.current?.focusPerson(mainId)
  }, [mainId, data, treePosition])

  if (data.length === 0) {
    return null
  }

  return <div ref={containerRef} className={hostClassName} aria-label="Family chart" />
}
