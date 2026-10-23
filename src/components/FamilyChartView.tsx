import { useEffect, useRef } from 'react'
import type { Data } from 'family-chart'
import {
  createFamilyChartAdapter,
  type FamilyChartAdapter,
} from '../chart/familyChartAdapter'

interface FamilyChartViewProps {
  data: Data
  mainId: string | null
  onPersonClick: (personId: string) => void
}

export function FamilyChartView({ data, mainId, onPersonClick }: FamilyChartViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const adapterRef = useRef<FamilyChartAdapter | null>(null)
  const onClickRef = useRef(onPersonClick)
  const initialMainRef = useRef(mainId)

  useEffect(() => {
    onClickRef.current = onPersonClick
  }, [onPersonClick])

  useEffect(() => {
    const el = containerRef.current
    if (!el || data.length === 0) return

    adapterRef.current?.destroy()
    adapterRef.current = createFamilyChartAdapter({
      container: el,
      data,
      mainId: initialMainRef.current ?? undefined,
      onCardClick: (id) => onClickRef.current(id),
    })

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

  return <div ref={containerRef} className="family-chart-host" aria-label="Family chart" />
}
