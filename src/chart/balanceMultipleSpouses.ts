import type { TreeDatum } from 'family-chart'

/** Minimal tree shape returned by family-chart's store.getTree(). */
export interface ChartTree {
  data: TreeDatum[]
  dim: {
    width: number
    height: number
    x_off: number
    y_off: number
  }
}

/**
 * family-chart stacks every spouse on one side of a person. For 2+ spouses,
 * rebalance so they alternate left/right around the person. Children stay
 * grouped with the correct co-parent because the library sorts children by
 * spouse index (spouse 0 toward the left for males, toward the right for females).
 */
export function balanceMultipleSpouses(tree: ChartTree, nodeSeparation: number): void {
  const nodes = tree.data

  for (const person of nodes) {
    if (person.is_ancestry || person.added || !person.spouses || person.spouses.length < 2) {
      continue
    }

    const spouses = person.spouses
    const hubX =
      (person.x + spouses.reduce((sum: number, sp: TreeDatum) => sum + sp.x, 0)) /
      (spouses.length + 1)
    person.x = hubX

    // Match sortChildrenWithSpouses: males put spouse-index 0 children on the left;
    // females put spouse-index 0 children on the right.
    const spouse0OnLeft = person.data.data.gender !== 'F'
    let leftSlot = 0
    let rightSlot = 0

    spouses.forEach((spouse: TreeDatum, index: number) => {
      const onLeft = spouse0OnLeft ? index % 2 === 0 : index % 2 === 1
      if (onLeft) {
        leftSlot += 1
        spouse.x = hubX - leftSlot * nodeSeparation
      } else {
        rightSlot += 1
        spouse.x = hubX + rightSlot * nodeSeparation
      }
      spouse.sx = (person.x + spouse.x) / 2
      spouse.sy = person.y
    })
  }

  // Child→parent link elbows use the co-parent spouse's sx.
  for (const child of nodes) {
    if (child.is_ancestry || child.added || child.sibling || child.depth === 0) continue
    const p1 = child.parent
    if (!p1?.spouses?.length) continue
    const parentIds = child.data.rels.parents ?? []
    const coParent = p1.spouses.find((sp: TreeDatum) => parentIds.includes(sp.data.id))
    if (!coParent) continue
    const anchor = p1.added ? p1 : coParent
    if (typeof anchor.sx === 'number') {
      child.psx = anchor.sx
      child.psy = anchor.y
    }
  }

  refreshTreeDim(tree, nodeSeparation)
}

function refreshTreeDim(tree: ChartTree, nodeSeparation: number): void {
  const xs = tree.data.map((d: TreeDatum) => d.x)
  const ys = tree.data.map((d: TreeDatum) => d.y)
  if (xs.length === 0 || ys.length === 0) return

  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const levelSep = recoverLevelSeparation(tree, minY, maxY)

  tree.dim = {
    width: maxX - minX + nodeSeparation,
    height: maxY - minY + levelSep,
    x_off: -minX + nodeSeparation / 2,
    y_off: -minY + levelSep / 2,
  }
}

function recoverLevelSeparation(tree: ChartTree, minY: number, maxY: number): number {
  const prevHeight = tree.dim?.height
  const span = maxY - minY
  if (prevHeight !== undefined && span >= 0 && prevHeight > span) {
    return prevHeight - span
  }
  return 150
}

/** Pure helper for tests: spouse X positions around a hub. */
export function assignSpouseSides(
  hubX: number,
  spouseCount: number,
  nodeSeparation: number,
  gender: 'M' | 'F' | 'U',
): number[] {
  const spouse0OnLeft = gender !== 'F'
  const spouseXs: number[] = []
  let leftSlot = 0
  let rightSlot = 0
  for (let index = 0; index < spouseCount; index++) {
    const onLeft = spouse0OnLeft ? index % 2 === 0 : index % 2 === 1
    if (onLeft) {
      leftSlot += 1
      spouseXs.push(hubX - leftSlot * nodeSeparation)
    } else {
      rightSlot += 1
      spouseXs.push(hubX + rightSlot * nodeSeparation)
    }
  }
  return spouseXs
}
