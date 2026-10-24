import { useEffect, useRef } from 'react'
import type { Data } from 'family-chart'
import {
  createFamilyChartAdapter,
  type FamilyChartAdapter,
  type FamilyChartAdapterOptions,
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
  hostClassName = 'family-chart-host',
}: FamilyChartViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<FamilyChartAdapter | null>(null)
  const onClickRef = useRef(onPersonClick)
  const initialMainRef = useRef(mainId)
  const optionsRef = useRef({
    cardDisplay,
    ancestryDepth,
    progenyDepth,
    singleParentEmptyCard,
    cardXSpacing,
    cardYSpacing,
    balanceSpouses,
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
    }
  }, [
    cardDisplay,
    ancestryDepth,
    progenyDepth,
    singleParentEmptyCard,
    cardXSpacing,
    cardYSpacing,
    balanceSpouses,
  ])

  useEffect(() => {
    const el = containerRef.current
    if (!el || data.length === 0) return

    const opts = optionsRef.current
    const adapterOptions: FamilyChartAdapterOptions = {
      container: el,
      data,
      mainId: initialMainRef.current ?? undefined,
      onCardClick: (id) => onClickRef.current(id),
      cardDisplay: opts.cardDisplay,
      ancestryDepth: opts.ancestryDepth,
      progenyDepth: opts.progenyDepth,
      singleParentEmptyCard: opts.singleParentEmptyCard,
      cardXSpacing: opts.cardXSpacing,
      cardYSpacing: opts.cardYSpacing,
      balanceSpouses: opts.balanceSpouses,
    }

    adapterRef.current?.destroy()
    adapterRef.current = createFamilyChartAdapter(adapterOptions)

    return () => {
      adapterRef.current?.destroy()
      adapterRef.current = null
    }
  }, [data])

  useEffect(() => {
    if (mainId) adapterRef.current?.focusPerson(mainId)
  }, [mainId, data])

  if (data.length === 0) {
    return null
  }

  return <div ref={containerRef} className={hostClassName} aria-label="Family chart" />
}
