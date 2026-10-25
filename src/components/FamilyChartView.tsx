import { useEffect, useImperativeHandle, useRef, forwardRef } from 'react'
import type { Data } from 'family-chart'
import {
  createFamilyChartAdapter,
  type FamilyChartAdapter,
  type FamilyChartAdapterOptions,
  type TreePosition,
} from '../chart/familyChartAdapter'

export interface FamilyChartViewHandle {
  fitToView: () => void
  reflow: () => void
}

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
  /** Bump to force remount after major layout changes (e.g. sidebar). */
  layoutKey?: string | number
}

export const FamilyChartView = forwardRef<FamilyChartViewHandle, FamilyChartViewProps>(
  function FamilyChartView(
    {
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
      layoutKey = 0,
    },
    ref,
  ) {
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

    useImperativeHandle(ref, () => ({
      fitToView() {
        adapterRef.current?.fitToView()
      },
      reflow() {
        adapterRef.current?.reflow()
      },
    }))

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
    }, [data, treePosition, layoutKey])

    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      let lastW = 0
      let lastH = 0
      let timer: number | null = null

      const observer = new ResizeObserver((entries) => {
        const entry = entries[0]
        if (!entry) return
        const { width, height } = entry.contentRect
        if (width < 32 || height < 32) return
        if (lastW === 0 && lastH === 0) {
          lastW = width
          lastH = height
          return
        }
        if (Math.abs(width - lastW) < 24 && Math.abs(height - lastH) < 24) return
        lastW = width
        lastH = height
        if (timer != null) window.clearTimeout(timer)
        timer = window.setTimeout(() => {
          adapterRef.current?.reflow()
        }, 120)
      })

      observer.observe(el)
      return () => {
        if (timer != null) window.clearTimeout(timer)
        observer.disconnect()
      }
    }, [data, layoutKey])

    useEffect(() => {
      // For fit / fit_top the adapter already placed the tree; re-focusing with
      // main_to_middle would shove the root into the vertical center.
      if (!mainId || treePosition === 'fit' || treePosition === 'fit_top') return
      adapterRef.current?.focusPerson(mainId)
    }, [mainId, data, treePosition, layoutKey])

    if (data.length === 0) {
      return null
    }

    return <div ref={containerRef} className={hostClassName} aria-label="Family chart" />
  },
)
