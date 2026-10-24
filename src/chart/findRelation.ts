import * as f3 from 'family-chart'
import type { Data, Datum } from 'family-chart'

export interface RelationFindResult {
  /** Kinship of person B relative to person A (e.g. "cousin", "father"). */
  kinshipLabel: string | null
  /** Subset of chart data connecting A and B for a small path chart. */
  pathData: Data | null
}

type KinshipDatum = Datum & { kinship?: string }

/**
 * Uses family-chart's documented kinship helpers to label B relative to A
 * and build a minimal tree showing how they connect.
 */
export function findRelationBetween(data: Data, fromId: string, toId: string): RelationFindResult {
  const clean = sanitizeChartData(data)

  if (fromId === toId) {
    const self = clean.find((d) => d.id === fromId)
    if (!self) return { kinshipLabel: null, pathData: null }
    return {
      kinshipLabel: 'self',
      pathData: [
        {
          ...self,
          data: { ...self.data, kinship: 'Self' },
        },
      ] as Data,
    }
  }

  if (!clean.some((d) => d.id === fromId) || !clean.some((d) => d.id === toId)) {
    return { kinshipLabel: null, pathData: null }
  }

  let kinshipLabel: string | null = null
  let pathData: Data | null = null

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'
  document.body.appendChild(host)

  try {
    const chart = f3.createChart(host, structuredClone(clean) as Data)
    try {
      const kinships = chart.calculateKinships(fromId, { show_in_law: true })
      const rawLabel = kinships[toId] ?? null
      if (rawLabel) kinshipLabel = formatKinshipLabel(rawLabel)
    } catch {
      kinshipLabel = null
    }

    if (kinshipLabel) {
      try {
        const stash = chart.getKinshipsDataStash(fromId, toId) as KinshipDatum[] | void
        if (stash && stash.length > 0) {
          pathData = normalizeKinshipStash(stash, fromId)
        }
      } catch {
        pathData = null
      }
    }
  } finally {
    host.remove()
  }

  // Fallback path chart (and label if the library kinship walk crashed).
  if (!pathData) {
    const pathIds = findShortestRelationPath(clean, fromId, toId)
    if (pathIds && pathIds.length > 0) {
      if (!kinshipLabel) {
        kinshipLabel = describePathFallback(pathIds.length)
      }
      pathData = buildPathChartData(clean, pathIds, fromId, kinshipLabel)
    }
  }

  return { kinshipLabel, pathData }
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

function normalizeKinshipStash(stash: KinshipDatum[], fromId: string): Data {
  const ids = new Set(stash.map((d) => d.id).filter(Boolean))
  return stash
    .filter((d) => d && d.id && d.data)
    .map((d) => ({
      id: d.id,
      data: {
        ...d.data,
        kinship: formatKinshipLabel(
          d.kinship ?? (d.id === fromId ? 'self' : ''),
        ),
      },
      rels: {
        parents: [...(d.rels?.parents ?? [])].filter((id) => ids.has(id)),
        spouses: [...(d.rels?.spouses ?? [])].filter((id) => ids.has(id)),
        children: [...(d.rels?.children ?? [])].filter((id) => ids.has(id)),
      },
    })) as Data
}

type EdgeKind = 'parent' | 'child' | 'spouse'

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
 * Build a small chart from a path of ids. Uses real parent/spouse links where
 * present so family-chart can lay out the connection.
 */
export function buildPathChartData(
  data: Data,
  pathIds: string[],
  fromId: string,
  toKinshipLabel: string | null,
): Data {
  const byId = new Map(data.map((d) => [d.id, d]))
  const pathSet = new Set(pathIds)
  const nodes: Data = []

  for (const id of pathIds) {
    const src = byId.get(id)
    if (!src) continue
    const kinship =
      id === fromId
        ? 'Self'
        : id === pathIds[pathIds.length - 1] && toKinshipLabel
          ? toKinshipLabel
          : pathRoleLabel(pathIds, id)

    nodes.push({
      id,
      data: {
        ...src.data,
        kinship,
      },
      rels: {
        parents: (src.rels.parents ?? []).filter((p) => pathSet.has(p)),
        spouses: (src.rels.spouses ?? []).filter((s) => pathSet.has(s)),
        children: (src.rels.children ?? []).filter((c) => pathSet.has(c)),
      },
    })
  }

  return nodes
}

function pathRoleLabel(pathIds: string[], id: string): string {
  const index = pathIds.indexOf(id)
  if (index <= 0) return 'Self'
  return `Step ${index}`
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
