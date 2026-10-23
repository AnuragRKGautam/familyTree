import { useEffect, useRef } from 'react'
import type { Data } from 'family-chart'
import {
  createFamilyChartController,
  type FamilyChartController,
} from './familyChartController'

export interface FamilyChartProps {
  data: Data
  focusId: string | null
  /** Increment to re-run focus when the same person is already selected. */
  focusNonce: number
  onPersonSelect: (personId: string) => void
  /** Increment to request fit-to-view without remounting. */
  fitRequestId: number
}

/**
 * React wrapper around family-chart.
 * - Initializes once per mount; destroys on unmount (Strict Mode safe).
 * - Focus / fit / data updates go through the controller (no duplicate createChart).
 */
export function FamilyChart({
  data,
  focusId,
  focusNonce,
  onPersonSelect,
  fitRequestId,
}: FamilyChartProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const controllerRef = useRef<FamilyChartController | null>(null)
  const onSelectRef = useRef(onPersonSelect)
  const mountedData = useRef(data)
  const mountedFocus = useRef(focusId)
  const skipNextFocus = useRef(true)

  useEffect(() => {
    onSelectRef.current = onPersonSelect
  }, [onPersonSelect])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const controller = createFamilyChartController({
      container: host,
      data: mountedData.current,
      mainId: mountedFocus.current ?? undefined,
      onPersonSelect: (id) => onSelectRef.current(id),
    })
    controllerRef.current = controller
    skipNextFocus.current = true

    return () => {
      controller.destroy()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (data === mountedData.current) return
    mountedData.current = data
    controllerRef.current?.updateData(data, focusId ?? undefined)
  }, [data, focusId])

  useEffect(() => {
    if (!focusId) return
    if (skipNextFocus.current) {
      skipNextFocus.current = false
      return
    }
    controllerRef.current?.focusPerson(focusId)
  }, [focusId, focusNonce])

  useEffect(() => {
    if (fitRequestId > 0) controllerRef.current?.fitToView()
  }, [fitRequestId])

  return <div ref={hostRef} className="prototype-chart-host" aria-label="Family chart" />
}
