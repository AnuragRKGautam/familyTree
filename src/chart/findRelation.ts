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
      if (rawLabel) kinshipLabel = formatKinshipLabel(rawLabel)
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
    kinshipLabel = describePathFallback(pathIds.length)
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
 * Peak / common-ancestor index on a path: last node reached while still
 * moving to a parent (or across a spouse), before descending to children.
 */
export function findPeakOnPath(data: Data, pathIds: string[]): string {
  if (pathIds.length === 0) return ''
  const first = pathIds[0]
  if (pathIds.length === 1 || first === undefined) return first ?? ''

  const byId = new Map(data.map((d) => [d.id, d]))
  let peakIndex = 0

  for (let i = 0; i < pathIds.length - 1; i++) {
    const fromId = pathIds[i]
    const nextId = pathIds[i + 1]
    if (fromId === undefined || nextId === undefined) break
    const from = byId.get(fromId)
    if (!from) break

    const goingUp = (from.rels.parents ?? []).includes(nextId)
    const goingDown = (from.rels.children ?? []).includes(nextId)
    const viaSpouse = (from.rels.spouses ?? []).includes(nextId)

    if (goingUp || viaSpouse) {
      peakIndex = i + 1
      continue
    }
    if (goingDown) {
      // Started descending — peak is the current node.
      break
    }
    // Unknown edge type: keep advancing the peak.
    peakIndex = i + 1
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
    if (id === fromId) return 'Self'
    if (id === toId && toKinshipLabel) return toKinshipLabel
    if (id === peakId && id !== fromId && id !== toId) {
      const fromMap = kinshipMap[id]
      return fromMap ? formatKinshipLabel(fromMap) : 'Common ancestor'
    }
    const fromMap = kinshipMap[id]
    if (fromMap) return formatKinshipLabel(fromMap)
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

  /** Wire chain[i] → chain[i+1] using real edge direction when possible. */
  function wireChain(chain: string[]) {
    for (let i = 0; i < chain.length - 1; i++) {
      const aId = chain[i]
      const bId = chain[i + 1]
      if (aId === undefined || bId === undefined) continue
      const a = ensure(aId)
      const b = ensure(bId)
      const kind = edgeKind(aId, bId)
      const spousesA = a.rels.spouses ?? (a.rels.spouses = [])
      const spousesB = b.rels.spouses ?? (b.rels.spouses = [])
      const childrenA = a.rels.children ?? (a.rels.children = [])
      const childrenB = b.rels.children ?? (b.rels.children = [])
      const parentsA = a.rels.parents ?? (a.rels.parents = [])
      const parentsB = b.rels.parents ?? (b.rels.parents = [])

      if (kind === 'spouse' || (!kind && edgeKind(bId, aId) === 'spouse')) {
        if (!spousesA.includes(bId)) spousesA.push(bId)
        if (!spousesB.includes(aId)) spousesB.push(aId)
        continue
      }

      // Default: earlier in chain-from-peak is parent of later (descending).
      if (kind === 'parent') {
        // a's parent is b — invert for descending tree from peak
        if (!childrenB.includes(aId)) childrenB.push(aId)
        if (!parentsA.includes(bId)) parentsA.push(bId)
      } else {
        // child edge or unknown: a parent of b
        if (!childrenA.includes(bId)) childrenA.push(bId)
        if (!parentsB.includes(aId)) parentsB.push(aId)
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

export function formatKinshipLabel(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.toLowerCase() === 'self') return 'Self'
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
