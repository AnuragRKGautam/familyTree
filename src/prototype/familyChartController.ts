import * as f3 from 'family-chart'
import type { Chart, Data, TreeDatum } from 'family-chart'
import 'family-chart/styles/family-chart.css'

export interface FamilyChartControllerOptions {
  container: HTMLElement
  data: Data
  mainId?: string
  ancestryDepth?: number
  progenyDepth?: number
  onPersonSelect?: (personId: string) => void
}

export interface FamilyChartController {
  focusPerson: (personId: string) => void
  fitToView: () => void
  updateData: (data: Data, mainId?: string) => void
  destroy: () => void
}

/**
 * Documented family-chart APIs only:
 * createChart, setCardHtml, setCardDisplay, setOnCardClick,
 * setAncestryDepth, setProgenyDepth, setSingleParentEmptyCard,
 * setShowSiblingsOfMain, updateMainId, updateData, updateTree.
 *
 * Zoom/pan: provided by the library’s built-in D3 zoom on the SVG
 * (wheel / drag on the chart surface). No separate Chart method in 0.9.0.
 *
 * Fit: updateTree({ tree_position: 'fit' }).
 */
export function createFamilyChartController(
  options: FamilyChartControllerOptions,
): FamilyChartController {
  const {
    container,
    data,
    mainId,
    ancestryDepth = 5,
    progenyDepth = 5,
    onPersonSelect,
  } = options

  container.replaceChildren()
  container.classList.add('f3', 'prototype-chart-root')

  let currentData = data
  const chart: Chart = f3.createChart(container, currentData)

  const card = chart
    .setCardHtml()
    .setCardDisplay([
      ['first name', 'last name'],
      ['birthday'],
    ])

  card.setOnCardClick((_event: MouseEvent, datum: TreeDatum) => {
    const id = datum.data.id
    if (typeof id === 'string') {
      onPersonSelect?.(id)
      // Default library behavior also focuses; we keep selection + focus in sync.
      chart.updateMainId(id)
      chart.updateTree({ tree_position: 'main_to_middle' })
    }
  })

  chart
    .setAncestryDepth(ancestryDepth)
    .setProgenyDepth(progenyDepth)
    .setShowSiblingsOfMain(true)
    .setSingleParentEmptyCard(true, { label: 'Unknown parent' })

  const initialMain =
    mainId && currentData.some((d) => d.id === mainId) ? mainId : currentData[0]?.id
  if (initialMain) chart.updateMainId(initialMain)

  chart.updateTree({ initial: true, tree_position: 'main_to_middle' })

  let destroyed = false

  return {
    focusPerson(personId: string) {
      if (destroyed || !currentData.some((d) => d.id === personId)) return
      chart.updateMainId(personId)
      chart.updateTree({ tree_position: 'main_to_middle' })
    },
    fitToView() {
      if (destroyed) return
      // Documented ViewProps.tree_position: 'fit'
      chart.updateTree({ tree_position: 'fit' })
    },
    updateData(nextData: Data, nextMainId?: string) {
      if (destroyed) return
      currentData = nextData
      chart.updateData(nextData)
      const focus =
        nextMainId && nextData.some((d) => d.id === nextMainId)
          ? nextMainId
          : nextData[0]?.id
      if (focus) chart.updateMainId(focus)
      chart.updateTree({ tree_position: 'main_to_middle' })
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      // Clears DOM nodes and associated zoom listeners attached under the container.
      container.replaceChildren()
      container.classList.remove('f3', 'prototype-chart-root')
    },
  }
}
