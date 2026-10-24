import * as d3 from 'd3'
import * as f3 from 'family-chart'
import type { Chart, Data, TreeDatum } from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { balanceMultipleSpouses, type ChartTree } from './balanceMultipleSpouses'
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
  destroy: () => void
}

type TreeDim = { width: number; height: number; x_off: number; y_off: number }

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

  if (onCardClick) {
    card.setOnCardClick((_event: MouseEvent, datum: TreeDatum) => {
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
  chart.updateTree({ initial: true, tree_position: viewPosition })
  if (treePosition === 'fit_top') {
    // initial:true uses fit centering; afterUpdate then pins to top — run once more
    // in case afterUpdate ran before layout settled.
    requestAnimationFrame(() => applyFitTop(chart))
  }

  return {
    focusPerson(personId: string) {
      if (!currentData.some((d) => d.id === personId)) return
      chart.updateMainId(personId)
      chart.updateTree({ tree_position: viewPosition })
      if (treePosition === 'fit_top') {
        requestAnimationFrame(() => applyFitTop(chart))
      }
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
      chart.updateTree({ tree_position: viewPosition })
      if (treePosition === 'fit_top') {
        requestAnimationFrame(() => applyFitTop(chart))
      }
    },
    destroy() {
      container.replaceChildren()
    },
  }
}
