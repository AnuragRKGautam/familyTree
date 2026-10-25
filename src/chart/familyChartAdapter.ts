import * as d3 from 'd3'
import * as f3 from 'family-chart'
import type { Chart, Data, TreeDatum } from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { balanceMultipleSpouses, type ChartTree } from './balanceMultipleSpouses'
import { formatCardHoverText, isDeceasedFlag } from './cardTooltip'
import {
  createSortChildrenFromData,
  orderHierarchyChildrenByBirth,
} from './sortChildrenByBirthday'

export type TreePosition = 'fit' | 'main_to_middle' | 'fit_top'

export interface FamilyChartAdapterOptions {
  container: HTMLElement
  data: Data
  mainId?: string
  ancestryDepth?: number
  progenyDepth?: number
  onCardClick?: (personId: string) => void
  /** Card field rows passed to setCardDisplay. */
  cardDisplay?: string[][]
  singleParentEmptyCard?: boolean
  cardXSpacing?: number
  cardYSpacing?: number
  /** When false, skip left/right multi-spouse rebalance (default true). */
  balanceSpouses?: boolean
  /**
   * How to place the tree in the viewport.
   * - main_to_middle: center on the main person (default for the main tree)
   * - fit: scale to fit, centered
   * - fit_top: scale to fit, aligned to the top of the container (relation path)
   */
  treePosition?: TreePosition
}

export interface FamilyChartAdapter {
  focusPerson: (personId: string) => void
  updateData: (data: Data, mainId?: string) => void
  fitToView: () => void
  reflow: () => void
  destroy: () => void
}

type TreeDim = { width: number; height: number; x_off: number; y_off: number }

const LONG_PRESS_MS = 450
const MOVE_CANCEL_PX = 12

function finePointerHover(): boolean {
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function getZoomListener(svg: SVGElement): Element & { __zoomObj?: d3.ZoomBehavior<Element, unknown> } {
  const asAny = svg as SVGElement & { __zoomObj?: d3.ZoomBehavior<Element, unknown> }
  if (asAny.__zoomObj) return asAny
  return svg.parentNode as Element & { __zoomObj?: d3.ZoomBehavior<Element, unknown> }
}

/** Fit the tree and pin its top near the top of the SVG viewport. */
function applyFitTop(chart: Chart) {
  const tree = chart.store.getTree() as { dim?: TreeDim } | undefined
  const dim = tree?.dim
  const svg = chart.svg
  if (!dim || !svg) return

  const svgDim = svg.getBoundingClientRect()
  if (svgDim.width <= 0 || svgDim.height <= 0 || dim.width <= 0 || dim.height <= 0) return

  let k = Math.min(svgDim.width / dim.width, svgDim.height / dim.height)
  if (k > 1) k = 1
  const pad = 16
  const x = dim.x_off + (svgDim.width - dim.width * k) / k / 2
  const y = dim.y_off + pad / k

  const listener = getZoomListener(svg)
  const zoom = listener.__zoomObj
  if (!zoom) return
  d3.select(listener).call(zoom.transform as never, d3.zoomIdentity.scale(k).translate(x, y))
}

/**
 * Thin wrapper around documented family-chart APIs only.
 * See docs/implementation-plan.md for the verified method list.
 */
export function createFamilyChartAdapter(options: FamilyChartAdapterOptions): FamilyChartAdapter {
  const {
    container,
    data,
    mainId,
    ancestryDepth = 4,
    progenyDepth = 4,
    onCardClick,
    cardDisplay = [
      ['first name', 'last name'],
      ['birthday'],
    ],
    singleParentEmptyCard = true,
    cardXSpacing,
    cardYSpacing,
    balanceSpouses = true,
    treePosition = 'main_to_middle',
  } = options

  container.replaceChildren()
  container.classList.add('f3')

  const chart: Chart = f3.createChart(container, data)

  const card = chart.setCardHtml().setCardDisplay(cardDisplay)

  let tooltipEl = container.querySelector<HTMLDivElement>('.f3-person-tooltip')
  if (!tooltipEl) {
    tooltipEl = document.createElement('div')
    tooltipEl.className = 'f3-person-tooltip'
    tooltipEl.hidden = true
    container.appendChild(tooltipEl)
  }

  let suppressNextClick = false
  const cleanups: Array<() => void> = []

  function hideTooltip() {
    if (!tooltipEl) return
    tooltipEl.hidden = true
    tooltipEl.textContent = ''
  }

  function positionTooltip(clientX: number, clientY: number) {
    if (!tooltipEl) return
    const hostRect = container.getBoundingClientRect()
    const x = clientX - hostRect.left + 12
    const y = clientY - hostRect.top + 12
    tooltipEl.style.left = `${Math.min(Math.max(8, x), Math.max(8, hostRect.width - 220))}px`
    tooltipEl.style.top = `${Math.min(Math.max(8, y), Math.max(8, hostRect.height - 40))}px`
  }

  function showTooltipAt(clientX: number, clientY: number, datum: TreeDatum) {
    if (!tooltipEl) return
    if (datum.data.to_add || datum.data._new_rel_data) {
      hideTooltip()
      return
    }
    const personData = datum.data.data as Record<string, unknown>
    const text = formatCardHoverText(
      typeof personData.aliases === 'string' ? personData.aliases : null,
      typeof personData.biography === 'string' ? personData.biography : null,
    )
    if (!text) {
      hideTooltip()
      return
    }
    tooltipEl.hidden = false
    tooltipEl.textContent = text
    positionTooltip(clientX, clientY)
  }

  function showTooltip(event: Event, datum: TreeDatum) {
    const mouse = event as MouseEvent
    showTooltipAt(mouse.clientX, mouse.clientY, datum)
  }

  function bindTouchTooltip(cardEl: HTMLElement, datum: TreeDatum) {
    if (cardEl.dataset.touchTooltipBound === '1') return
    cardEl.dataset.touchTooltipBound = '1'

    let pressTimer: number | null = null
    let startX = 0
    let startY = 0

    function clearPress() {
      if (pressTimer != null) {
        window.clearTimeout(pressTimer)
        pressTimer = null
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') return
      clearPress()
      startX = e.clientX
      startY = e.clientY
      pressTimer = window.setTimeout(() => {
        pressTimer = null
        suppressNextClick = true
        showTooltipAt(e.clientX, e.clientY, datum)
      }, LONG_PRESS_MS)
    }

    const onPointerMove = (e: PointerEvent) => {
      if (pressTimer == null) return
      if (
        Math.abs(e.clientX - startX) > MOVE_CANCEL_PX ||
        Math.abs(e.clientY - startY) > MOVE_CANCEL_PX
      ) {
        clearPress()
      }
    }

    const onPointerEnd = () => clearPress()

    cardEl.addEventListener('pointerdown', onPointerDown)
    cardEl.addEventListener('pointermove', onPointerMove)
    cardEl.addEventListener('pointerup', onPointerEnd)
    cardEl.addEventListener('pointercancel', onPointerEnd)
    cleanups.push(() => {
      clearPress()
      cardEl.removeEventListener('pointerdown', onPointerDown)
      cardEl.removeEventListener('pointermove', onPointerMove)
      cardEl.removeEventListener('pointerup', onPointerEnd)
      cardEl.removeEventListener('pointercancel', onPointerEnd)
    })
  }

  const onOutsidePointer = (e: PointerEvent) => {
    if (!tooltipEl || tooltipEl.hidden) return
    const target = e.target as Element | null
    if (target?.closest?.('.card') || target?.closest?.('.f3-person-tooltip')) return
    hideTooltip()
  }
  container.addEventListener('pointerdown', onOutsidePointer)
  cleanups.push(() => container.removeEventListener('pointerdown', onOutsidePointer))

  card.setOnCardUpdate(function (this: HTMLElement, datum: TreeDatum) {
    const el = this.querySelector('.card') as HTMLElement | null
    if (!el || datum.data.to_add || datum.data._new_rel_data) return
    const personData = datum.data.data as Record<string, unknown>
    const deceased = isDeceasedFlag(personData)
    el.classList.toggle('card-deceased', deceased)
    if (deceased) {
      el.setAttribute('data-deceased', 'true')
      if (!el.querySelector('.deceased-mark')) {
        const mark = document.createElement('span')
        mark.className = 'deceased-mark'
        mark.textContent = '†'
        mark.title = 'Deceased'
        mark.setAttribute('aria-label', 'Deceased')
        const nameRow =
          el.querySelector('.card-label > div') ?? el.querySelector('.card-inner > div')
        if (nameRow) nameRow.appendChild(mark)
        else el.appendChild(mark)
      }
    } else {
      el.removeAttribute('data-deceased')
      el.querySelector('.deceased-mark')?.remove()
    }
    bindTouchTooltip(el, datum)
  })

  card.onCardMouseenter = (e: Event, d: TreeDatum) => {
    if (!finePointerHover()) return
    showTooltip(e, d)
  }
  card.onCardMouseleave = () => {
    if (!finePointerHover()) return
    hideTooltip()
  }

  if (onCardClick) {
    card.setOnCardClick((_event: MouseEvent, datum: TreeDatum) => {
      if (suppressNextClick) {
        suppressNextClick = false
        return
      }
      hideTooltip()
      const id = datum.data.id
      if (typeof id === 'string') onCardClick(id)
    })
  }

  chart.setAncestryDepth(ancestryDepth).setProgenyDepth(progenyDepth)
  chart.setSingleParentEmptyCard(singleParentEmptyCard, { label: 'Unknown parent' })
  let currentData = data

  function applyChildOrdering(nextData: Data) {
    chart.setSortChildrenFunction(createSortChildrenFromData(nextData))
    chart.setModifyTreeHierarchy((root, isAncestry) => {
      orderHierarchyChildrenByBirth(
        root as {
          data: Data[number]
          children?: Array<{ data: Data[number]; children?: unknown }> | null
        },
        nextData,
        isAncestry,
      )
    })
  }

  chart.setAncestryDepth(ancestryDepth).setProgenyDepth(progenyDepth)
  chart.setSingleParentEmptyCard(singleParentEmptyCard, { label: 'Unknown parent' })
  // Left → right: manual sort_order, then oldest → youngest by birthday.
  applyChildOrdering(currentData)
  if (typeof cardXSpacing === 'number') chart.setCardXSpacing(cardXSpacing)
  if (typeof cardYSpacing === 'number') chart.setCardYSpacing(cardYSpacing)

  // Place multiple spouses on both sides of a person (library stacks them on one side).
  if (balanceSpouses) {
    chart.beforeUpdate = () => {
      const tree = chart.store.getTree() as ChartTree | undefined
      if (!tree) return
      const nodeSeparation = chart.store.state.node_separation ?? 250
      balanceMultipleSpouses(tree, nodeSeparation)
    }
  }

  if (treePosition === 'fit_top') {
    chart.afterUpdate = () => {
      applyFitTop(chart)
    }
  }

  const initialMain =
    mainId && currentData.some((d) => d.id === mainId) ? mainId : currentData[0]?.id
  if (initialMain) {
    chart.updateMainId(initialMain)
  }

  const viewPosition = treePosition === 'fit_top' ? 'fit' : treePosition

  function runTreeUpdate(position: TreePosition | 'fit' | 'main_to_middle', initial = false) {
    chart.updateTree({ initial, tree_position: position })
    if (treePosition === 'fit_top') {
      requestAnimationFrame(() => applyFitTop(chart))
    }
  }

  try {
    runTreeUpdate(viewPosition, true)
  } catch (err) {
    container.replaceChildren()
    const msg = document.createElement('p')
    msg.className = 'status-message status-message--error'
    msg.textContent =
      err instanceof Error
        ? `Could not draw the family chart: ${err.message}`
        : 'Could not draw the family chart.'
    container.appendChild(msg)
    throw err
  }

  return {
    focusPerson(personId: string) {
      if (!currentData.some((d) => d.id === personId)) return
      chart.updateMainId(personId)
      runTreeUpdate(viewPosition)
    },
    updateData(nextData: Data, nextMainId?: string) {
      currentData = nextData
      applyChildOrdering(nextData)
      chart.updateData(nextData)
      const focus =
        nextMainId && nextData.some((d) => d.id === nextMainId)
          ? nextMainId
          : nextData[0]?.id
      if (focus) chart.updateMainId(focus)
      runTreeUpdate(viewPosition)
    },
    fitToView() {
      runTreeUpdate('fit')
    },
    reflow() {
      runTreeUpdate(viewPosition === 'main_to_middle' ? 'fit' : viewPosition)
      if (viewPosition === 'main_to_middle' && initialMain) {
        // After fitting to the new size, re-center on the focused person.
        requestAnimationFrame(() => {
          chart.updateTree({ tree_position: 'main_to_middle' })
        })
      }
    },
    destroy() {
      for (const cleanup of cleanups) cleanup()
      cleanups.length = 0
      hideTooltip()
      container.replaceChildren()
    },
  }
}
