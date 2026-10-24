import * as f3 from 'family-chart'
import type { Data, Datum } from 'family-chart'

export interface RelationFindResult {
  /** Kinship of person B relative to person A (e.g. "cousin", "father"). */
  kinshipLabel: string | null
  /** Subset of chart data connecting A and B for a small path chart. */
  pathData: Data | null
  /** Focus/root person for the path chart (usually the common ancestor). */
  chartRootId: string | null
}

type EdgeKind = 'parent' | 'child' | 'spouse'

/**
 * Label B relative to A, and build a path chart rooted at the connecting
 * ancestor so *both* sides of the relation are visible.
 */
export function findRelationBetween(data: Data, fromId: string, toId: string): RelationFindResult {
  const clean = sanitizeChartData(data)

  if (fromId === toId) {
    const self = clean.find((d) => d.id === fromId)
    if (!self) return { kinshipLabel: null, pathData: null, chartRootId: null }
    return {
      kinshipLabel: 'self',
      chartRootId: fromId,
      pathData: [
        {
          ...self,
          data: { ...self.data, kinship: 'Self' },
        },
      ] as Data,
    }
  }

  if (!clean.some((d) => d.id === fromId) || !clean.some((d) => d.id === toId)) {
    return { kinshipLabel: null, pathData: null, chartRootId: null }
  }

  let kinshipLabel: string | null = null
  let kinshipMap: Record<string, string> = {}

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'
  document.body.appendChild(host)

  try {
    const chart = f3.createChart(host, structuredClone(clean) as Data)
    try {
      kinshipMap = chart.calculateKinships(fromId, { show_in_law: true })
      const rawLabel = kinshipMap[toId] ?? null
      if (rawLabel) {
        const toGender = clean.find((d) => d.id === toId)?.data.gender
        const side = cousinLineSide(clean, fromId, toId)
        const generation = generationRelativeTo(clean, fromId, toId)
        kinshipLabel = formatKinshipLabel(rawLabel, toGender, side, generation)
      }
    } catch {
      kinshipMap = {}
      kinshipLabel = null
    }
  } finally {
    host.remove()
  }

  const pathIds = findShortestRelationPath(clean, fromId, toId)
  if (!pathIds || pathIds.length === 0) {
    return { kinshipLabel, pathData: null, chartRootId: null }
  }

  if (!kinshipLabel) {
    const toGender = clean.find((d) => d.id === toId)?.data.gender
    kinshipLabel =
      labelFromPathGenerations(clean, pathIds, toGender) ??
      describePathConnection(clean, pathIds)
  }

  const peakId = findPeakOnPath(clean, pathIds)
  const pathData = buildDualBranchPathChart(
    clean,
    pathIds,
    fromId,
    toId,
    peakId,
    kinshipLabel,
    kinshipMap,
  )

  return { kinshipLabel, pathData, chartRootId: peakId }
}

/** Drop dangling parent/spouse/child ids that crash family-chart kinship walks. */
export function sanitizeChartData(data: Data): Data {
  const ids = new Set(data.map((d) => d.id))
  return data.map((d) => ({
    id: d.id,
    data: { ...d.data },
    rels: {
      parents: [...new Set((d.rels.parents ?? []).filter((id) => ids.has(id)))],
      spouses: [...new Set((d.rels.spouses ?? []).filter((id) => ids.has(id)))],
      children: [...new Set((d.rels.children ?? []).filter((id) => ids.has(id)))],
    },
  })) as Data
}

/** Shortest path over parent/child/spouse edges. */
export function findShortestRelationPath(
  data: Data,
  fromId: string,
  toId: string,
): string[] | null {
  if (fromId === toId) return [fromId]
  const byId = new Map(data.map((d) => [d.id, d]))
  if (!byId.has(fromId) || !byId.has(toId)) return null

  const queue: string[] = [fromId]
  const prev = new Map<string, { id: string; kind: EdgeKind } | null>([[fromId, null]])

  while (queue.length > 0) {
    const cur = queue.shift()!
    const datum = byId.get(cur)
    if (!datum) continue

    const neighbors: Array<{ id: string; kind: EdgeKind }> = [
      ...(datum.rels.parents ?? []).map((id) => ({ id, kind: 'parent' as const })),
      ...(datum.rels.children ?? []).map((id) => ({ id, kind: 'child' as const })),
      ...(datum.rels.spouses ?? []).map((id) => ({ id, kind: 'spouse' as const })),
    ]

    for (const next of neighbors) {
      if (!byId.has(next.id) || prev.has(next.id)) continue
      prev.set(next.id, { id: cur, kind: next.kind })
      if (next.id === toId) {
        return reconstructPath(prev, fromId, toId)
      }
      queue.push(next.id)
    }
  }
  return null
}

function reconstructPath(
  prev: Map<string, { id: string; kind: EdgeKind } | null>,
  fromId: string,
  toId: string,
): string[] {
  const path = [toId]
  let cur = toId
  while (cur !== fromId) {
    const step = prev.get(cur)
    if (!step) break
    path.push(step.id)
    cur = step.id
  }
  path.reverse()
  return path
}

/**
 * Peak on a path: the last node at minimum generation depth when walking from
 * the start (parent −1, child +1, spouse 0).
 *
 * This roots charts at the true hinge — e.g. daughter-in-law’s parent when the
 * path goes Satya → son → DIL → up to her parents → across to her brother →
 * down to his child — instead of stopping at the first person.
 */
export function findPeakOnPath(data: Data, pathIds: string[]): string {
  if (pathIds.length === 0) return ''
  const first = pathIds[0]
  if (pathIds.length === 1 || first === undefined) return first ?? ''

  const byId = new Map(data.map((d) => [d.id, d]))
  let depth = 0
  let minDepth = 0
  let peakIndex = 0

  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromId = pathIds[i]
    const nextId = pathIds[i + 1]
    if (fromId === undefined || nextId === undefined) break
    const from = byId.get(fromId)
    if (!from) break

    if ((from.rels.parents ?? []).includes(nextId)) depth -= 1
    else if ((from.rels.children ?? []).includes(nextId)) depth += 1
    // spouse: same generation

    if (depth <= minDepth) {
      minDepth = depth
      peakIndex = i + 1
    }
  }

  return pathIds[peakIndex] ?? first
}

/**
 * Build a chart rooted at the path peak with both branches as descendants,
 * so cousins (etc.) appear on opposite sides under the shared ancestor.
 */
export function buildDualBranchPathChart(
  data: Data,
  pathIds: string[],
  fromId: string,
  toId: string,
  peakId: string,
  toKinshipLabel: string | null,
  kinshipMap: Record<string, string> = {},
): Data {
  const byId = new Map(data.map((d) => [d.id, d]))
  const peakIdx = pathIds.indexOf(peakId)
  if (peakIdx < 0) {
    return buildPathChartDataLegacy(data, pathIds, fromId, toKinshipLabel)
  }

  // [peak, …, fromId] and [peak, …, toId]
  const chainFrom = pathIds.slice(0, peakIdx + 1).reverse()
  const chainTo = pathIds.slice(peakIdx)

  const nodes = new Map<string, Datum>()

  function labelFor(id: string): string {
    const gender = byId.get(id)?.data.gender
    if (id === fromId) return 'Self'
    if (id === toId && toKinshipLabel) return toKinshipLabel
    const side = cousinLineSide(data, fromId, id)
    const generation = generationRelativeTo(data, fromId, id)
    if (id === peakId && id !== fromId && id !== toId) {
      const fromMap = kinshipMap[id]
      return fromMap
        ? formatKinshipLabel(fromMap, gender, side, generation)
        : 'Common ancestor'
    }
    const fromMap = kinshipMap[id]
    if (fromMap) return formatKinshipLabel(fromMap, gender, side, generation)

    // Kinship engine often skips people only reachable via spouse bridges.
    // Only infer a generation label when the last step to this person is blood
    // (not a spouse hop — that would mis-label in-laws as grandchildren).
    const fromIdx = pathIds.indexOf(fromId)
    const idIdx = pathIds.indexOf(id)
    if (fromIdx >= 0 && idIdx >= 0 && fromIdx !== idIdx) {
      const sub =
        fromIdx < idIdx
          ? pathIds.slice(fromIdx, idIdx + 1)
          : pathIds.slice(idIdx, fromIdx + 1).reverse()
      const prevId = sub[sub.length - 2]
      const lastId = sub[sub.length - 1]
      if (prevId && lastId) {
        const prev = byId.get(prevId)
        const viaSpouse = (prev?.rels.spouses ?? []).includes(lastId)
        if (!viaSpouse) {
          const fromPath = labelFromPathGenerations(data, sub, gender)
          if (fromPath) return fromPath
        }
      }
    }
    return 'Relative'
  }

  function ensure(id: string): Datum {
    const existing = nodes.get(id)
    if (existing) return existing
    const src = byId.get(id)
    const node: Datum = src
      ? {
          id,
          data: { ...src.data, kinship: labelFor(id) },
          rels: { parents: [], spouses: [], children: [] },
        }
      : {
          id,
          data: {
            gender: 'M',
            'first name': '?',
            'last name': '',
            birthday: '',
            kinship: labelFor(id),
          },
          rels: { parents: [], spouses: [], children: [] },
        }
    nodes.set(id, node)
    return node
  }

  function edgeKind(aId: string, bId: string): EdgeKind | null {
    const a = byId.get(aId)
    if (!a) return null
    if ((a.rels.parents ?? []).includes(bId)) return 'parent'
    if ((a.rels.children ?? []).includes(bId)) return 'child'
    if ((a.rels.spouses ?? []).includes(bId)) return 'spouse'
    return null
  }

  function linkParentChild(parentId: string, childId: string) {
    const parent = ensure(parentId)
    const child = ensure(childId)
    const children = parent.rels.children ?? (parent.rels.children = [])
    const parents = child.rels.parents ?? (child.rels.parents = [])
    if (!children.includes(childId)) children.push(childId)
    if (!parents.includes(parentId)) parents.push(parentId)
  }

  /**
   * Wire chain[i] → chain[i+1]. Spouse hops are kept as spouse links, but the
   * next blood child is hung off the blood-side partner only. family-chart
   * otherwise parks those children under the in-law card and they disappear
   * from the descending tree (e.g. Satya → Avnish + Ritu, Riddhi missing).
   */
  function wireChain(chain: string[]) {
    let spouseAnchorId: string | null = null

    for (let i = 0; i < chain.length - 1; i++) {
      const aId = chain[i]
      const bId = chain[i + 1]
      if (aId === undefined || bId === undefined) continue
      const a = ensure(aId)
      const b = ensure(bId)
      const kind = edgeKind(aId, bId)
      const spousesA = a.rels.spouses ?? (a.rels.spouses = [])
      const spousesB = b.rels.spouses ?? (b.rels.spouses = [])

      if (kind === 'spouse' || (!kind && edgeKind(bId, aId) === 'spouse')) {
        if (!spousesA.includes(bId)) spousesA.push(bId)
        if (!spousesB.includes(aId)) spousesB.push(aId)
        spouseAnchorId = aId
        continue
      }

      if (kind === 'parent') {
        spouseAnchorId = null
        // a's parent is b — invert for descending tree from peak
        linkParentChild(bId, aId)
      } else if (spouseAnchorId && spouseAnchorId !== aId) {
        // Path was … → blood → spouse(a) → child(b): show child under blood partner.
        ensure(aId) // keep the in-law card on the chart as spouse only
        linkParentChild(spouseAnchorId, bId)
        spouseAnchorId = null
      } else {
        linkParentChild(aId, bId)
        spouseAnchorId = null
      }
    }
  }

  ensure(peakId)
  wireChain(chainFrom)
  wireChain(chainTo)

  return [...nodes.values()] as Data
}

/** @deprecated kept for tests / emergency fallback */
export function buildPathChartData(
  data: Data,
  pathIds: string[],
  fromId: string,
  toKinshipLabel: string | null,
): Data {
  const peakId = findPeakOnPath(data, pathIds)
  return buildDualBranchPathChart(
    data,
    pathIds,
    fromId,
    pathIds[pathIds.length - 1] ?? fromId,
    peakId,
    toKinshipLabel,
    {},
  )
}

function buildPathChartDataLegacy(
  data: Data,
  pathIds: string[],
  fromId: string,
  toKinshipLabel: string | null,
): Data {
  const byId = new Map(data.map((d) => [d.id, d]))
  const pathSet = new Set(pathIds)
  return pathIds
    .map((id) => {
      const src = byId.get(id)
      if (!src) return null
      const kinship =
        id === fromId
          ? 'Self'
          : id === pathIds[pathIds.length - 1] && toKinshipLabel
            ? toKinshipLabel
            : 'Relative'
      return {
        id,
        data: { ...src.data, kinship },
        rels: {
          parents: (src.rels.parents ?? []).filter((p) => pathSet.has(p)),
          spouses: (src.rels.spouses ?? []).filter((s) => pathSet.has(s)),
          children: (src.rels.children ?? []).filter((c) => pathSet.has(c)),
        },
      }
    })
    .filter(Boolean) as Data
}

function describePathFallback(pathLength: number): string {
  if (pathLength <= 1) return 'Self'
  if (pathLength === 2) return 'Relative'
  return `${pathLength - 1}-step relative`
}

function pathHasSpouseEdge(data: Data, pathIds: string[]): boolean {
  const byId = new Map(data.map((d) => [d.id, d]))
  for (let i = 0; i < pathIds.length - 1; i++) {
    const a = pathIds[i]
    const b = pathIds[i + 1]
    if (a === undefined || b === undefined) continue
    if ((byId.get(a)?.rels.spouses ?? []).includes(b)) return true
  }
  return false
}

/** Fallback when kinship and monotone generation labels both fail. */
function describePathConnection(data: Data, pathIds: string[]): string {
  if (pathHasSpouseEdge(data, pathIds) && generationDeltaAlongPath(data, pathIds) === null) {
    return 'Relative by marriage'
  }
  return describePathFallback(pathIds.length)
}

/**
 * Net generation change along a path: child +1, parent −1, spouse 0.
 * Returns null if the path both ascends and descends (collateral / by-marriage
 * routes) — those must not be labeled son/granddaughter.
 */
export function generationDeltaAlongPath(data: Data, pathIds: string[]): number | null {
  if (pathIds.length < 2) return 0
  const byId = new Map(data.map((d) => [d.id, d]))
  let delta = 0
  let ups = 0
  let downs = 0
  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromId = pathIds[i]
    const toId = pathIds[i + 1]
    if (fromId === undefined || toId === undefined) return null
    const from = byId.get(fromId)
    if (!from) return null
    if ((from.rels.children ?? []).includes(toId)) {
      delta += 1
      downs += 1
    } else if ((from.rels.parents ?? []).includes(toId)) {
      delta -= 1
      ups += 1
    } else if ((from.rels.spouses ?? []).includes(toId)) {
      // same generation
    } else {
      return null
    }
  }
  // e.g. son → DIL → her parent → her brother → his child: not a granddaughter
  if (ups > 0 && downs > 0) return null
  return delta
}

/** Kinship-style label from a monotone generation path when the library has no label. */
export function labelFromPathGenerations(
  data: Data,
  pathIds: string[],
  toGender?: string | null,
): string | null {
  const delta = generationDeltaAlongPath(data, pathIds)
  if (delta === null || delta === 0) return null
  const female = toGender === 'F'
  const male = toGender === 'M'

  if (delta > 0) {
    if (delta === 1) return female ? 'Daughter' : male ? 'Son' : 'Child'
    if (delta === 2) return female ? 'Granddaughter' : male ? 'Grandson' : 'Grandchild'
    const greats = 'Great-'.repeat(delta - 2)
    return female
      ? `${greats}Granddaughter`
      : male
        ? `${greats}Grandson`
        : `${greats}Grandchild`
  }

  const up = -delta
  if (up === 1) return female ? 'Mother' : male ? 'Father' : 'Parent'
  if (up === 2) return female ? 'Grandmother' : male ? 'Grandfather' : 'Grandparent'
  const greats = 'Great-'.repeat(up - 2)
  return female
    ? `${greats}Grandmother`
    : male
      ? `${greats}Grandfather`
      : `${greats}Grandparent`
}

export type CousinLineSide = 'paternal' | 'maternal'
export type GenerationRelative = 'older' | 'younger' | 'same'

/** All ancestors of personId, including personId. */
export function ancestorSet(data: Data, personId: string): Set<string> {
  const byId = new Map(data.map((d) => [d.id, d]))
  const out = new Set<string>()
  const stack = [personId]
  while (stack.length > 0) {
    const id = stack.pop()
    if (id === undefined || out.has(id)) continue
    out.add(id)
    const parents = byId.get(id)?.rels.parents ?? []
    for (const p of parents) stack.push(p)
  }
  return out
}

/** Lowest common ancestor of a and b (first ancestor of b that is also ancestor of a). */
export function findLowestCommonAncestor(
  data: Data,
  aId: string,
  bId: string,
): string | null {
  const ancestorsA = ancestorSet(data, aId)
  const byId = new Map(data.map((d) => [d.id, d]))
  const queue = [bId]
  const seen = new Set<string>([bId])
  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) break
    if (ancestorsA.has(cur)) return cur
    for (const p of byId.get(cur)?.rels.parents ?? []) {
      if (!seen.has(p)) {
        seen.add(p)
        queue.push(p)
      }
    }
  }
  return null
}

/**
 * Whether the link from ego (fromId) to relative is through ego’s father
 * (paternal) or mother (maternal). Used for cousin brother/sister labels.
 */
export function cousinLineSide(
  data: Data,
  fromId: string,
  toId: string,
): CousinLineSide | null {
  if (fromId === toId) return null
  const byId = new Map(data.map((d) => [d.id, d]))
  const lca = findLowestCommonAncestor(data, fromId, toId)
  if (!lca || lca === fromId) return null

  const parents = byId.get(fromId)?.rels.parents ?? []
  let paternalHit = false
  let maternalHit = false

  for (const pId of parents) {
    const parent = byId.get(pId)
    if (!parent) continue
    if (!ancestorSet(data, pId).has(lca)) continue
    if (parent.data.gender === 'M') paternalHit = true
    else if (parent.data.gender === 'F') maternalHit = true
  }

  if (paternalHit && !maternalHit) return 'paternal'
  if (maternalHit && !paternalHit) return 'maternal'
  return null
}

/** Generations from person up to ancestor (0 if same person). */
export function depthToAncestor(
  data: Data,
  personId: string,
  ancestorId: string,
): number | null {
  if (personId === ancestorId) return 0
  const byId = new Map(data.map((d) => [d.id, d]))
  const queue: Array<{ id: string; depth: number }> = [{ id: personId, depth: 0 }]
  const seen = new Set<string>([personId])
  while (queue.length > 0) {
    const cur = queue.shift()
    if (cur === undefined) break
    for (const p of byId.get(cur.id)?.rels.parents ?? []) {
      if (p === ancestorId) return cur.depth + 1
      if (!seen.has(p)) {
        seen.add(p)
        queue.push({ id: p, depth: cur.depth + 1 })
      }
    }
  }
  return null
}

/**
 * Whether `toId` is an older, younger, or same generation as `fromId`
 * relative to their lowest common ancestor.
 */
export function generationRelativeTo(
  data: Data,
  fromId: string,
  toId: string,
): GenerationRelative | null {
  if (fromId === toId) return 'same'
  const lca = findLowestCommonAncestor(data, fromId, toId)
  if (!lca) return null
  const fromDepth = depthToAncestor(data, fromId, lca)
  const toDepth = depthToAncestor(data, toId, lca)
  if (fromDepth === null || toDepth === null) return null
  if (toDepth < fromDepth) return 'older'
  if (toDepth > fromDepth) return 'younger'
  return 'same'
}

function sidePrefix(side?: CousinLineSide | null): string {
  if (side === 'paternal') return 'Paternal '
  if (side === 'maternal') return 'Maternal '
  return ''
}

function titleCasePhrase(phrase: string): string {
  if (!phrase) return phrase
  return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}

/**
 * Format kinship for display (Indian English):
 * - same-gen cousins → paternal/maternal cousin brother|sister
 * - parent’s cousin (cousin once removed, older) → paternal/maternal aunt|uncle
 * - cousin’s child (cousin once removed, younger) → paternal/maternal niece|nephew
 */
export function formatKinshipLabel(
  raw: string,
  gender?: string | null,
  side?: CousinLineSide | null,
  generation?: GenerationRelative | null,
): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const lower = trimmed.toLowerCase()
  if (lower === 'self') return 'Self'

  const g = gender === 'M' || gender === 'F' ? gender : null
  const prefix = sidePrefix(side)
  const inLaw = lower.includes('in-law')

  // Parent’s siblings (and similar) — add paternal/maternal when known.
  if (/^(great[- ]?)?(grand)?(aunt|uncle)(-in-law)?$/.test(lower)) {
    return titleCasePhrase(`${prefix}${lower}`)
  }

  if (lower.includes('cousin')) {
    const isRemoved = lower.includes('removed')

    // Parent’s cousin → aunt/uncle; cousin’s child → niece/nephew.
    if (isRemoved && !inLaw && (generation === 'older' || generation === 'younger')) {
      let role: string
      if (generation === 'older') {
        if (g === 'F') role = 'aunt'
        else if (g === 'M') role = 'uncle'
        else role = 'aunt/uncle'
      } else {
        if (g === 'F') role = 'niece'
        else if (g === 'M') role = 'nephew'
        else role = 'niece/nephew'
      }
      return titleCasePhrase(`${prefix}${role}`)
    }

    let role: string
    if (g === 'F') role = inLaw ? 'cousin sister-in-law' : 'cousin sister'
    else if (g === 'M') role = inLaw ? 'cousin brother-in-law' : 'cousin brother'
    else role = inLaw ? 'cousin-in-law' : 'cousin'

    const removedMatch = lower.match(/(\d+)\s*x\s*removed/)
    const removedSuffix =
      generation === 'same' || generation == null
        ? removedMatch
          ? ` (${removedMatch[1]}x removed)`
          : lower.includes('removed')
            ? ' (once removed)'
            : ''
        : ''

    return `${titleCasePhrase(`${prefix}${role}`)}${removedSuffix}`
  }

  return trimmed
    .split(/([\s-]+)/)
    .map((part) => {
      if (!part || /^[\s-]+$/.test(part)) return part
      if (/^\d/.test(part)) return part
      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join('')
}

export function relationSentence(
  fromName: string,
  toName: string,
  kinshipLabel: string | null,
): string {
  if (!kinshipLabel) {
    return `${toName} does not appear related to ${fromName} in the recorded tree.`
  }
  if (kinshipLabel.toLowerCase() === 'self') {
    return `${fromName} is the same person.`
  }
  return `${toName} is the ${kinshipLabel.toLowerCase()} of ${fromName}.`
}
