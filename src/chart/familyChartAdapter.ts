import * as f3 from 'family-chart'
import type { Chart, Data, TreeDatum } from 'family-chart'
import 'family-chart/styles/family-chart.css'
import { balanceMultipleSpouses, type ChartTree } from './balanceMultipleSpouses'

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
}

export interface FamilyChartAdapter {
  focusPerson: (personId: string) => void
  updateData: (data: Data, mainId?: string) => void
  destroy: () => void
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

  let currentData = data
  const initialMain =
    mainId && currentData.some((d) => d.id === mainId) ? mainId : currentData[0]?.id
  if (initialMain) {
    chart.updateMainId(initialMain)
  }

  chart.updateTree({ initial: true, tree_position: 'main_to_middle' })

  return {
    focusPerson(personId: string) {
      if (!currentData.some((d) => d.id === personId)) return
      chart.updateMainId(personId)
      chart.updateTree({ tree_position: 'main_to_middle' })
    },
    updateData(nextData: Data, nextMainId?: string) {
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
      container.replaceChildren()
    },
  }
}
