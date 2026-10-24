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
  if (fromId === toId) {
    const self = data.find((d) => d.id === fromId)
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

  if (!data.some((d) => d.id === fromId) || !data.some((d) => d.id === toId)) {
    return { kinshipLabel: null, pathData: null }
  }

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText =
    'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'
  document.body.appendChild(host)

  try {
    const chart = f3.createChart(host, structuredClone(data) as Data)
    const kinships = chart.calculateKinships(fromId, { show_in_law: true })
    const rawLabel = kinships[toId] ?? null
    if (!rawLabel) {
      return { kinshipLabel: null, pathData: null }
    }

    const stash = chart.getKinshipsDataStash(fromId, toId) as KinshipDatum[] | void
    if (!stash || stash.length === 0) {
      return { kinshipLabel: formatKinshipLabel(rawLabel), pathData: null }
    }

    const pathData = stash.map((d) => ({
      id: d.id,
      data: {
        ...d.data,
        kinship: formatKinshipLabel(d.kinship ?? (d.id === fromId ? 'self' : '')),
      },
      rels: {
        parents: [...(d.rels.parents ?? [])],
        spouses: [...(d.rels.spouses ?? [])],
        children: [...(d.rels.children ?? [])],
      },
    })) as Data

    return {
      kinshipLabel: formatKinshipLabel(rawLabel),
      pathData,
    }
  } finally {
    host.remove()
  }
}

export function formatKinshipLabel(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (trimmed.toLowerCase() === 'self') return 'Self'
  // Preserve leading ordinals like "2nd Cousin" / "2x-great-grandparent"
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
