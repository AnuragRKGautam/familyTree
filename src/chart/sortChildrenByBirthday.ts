import type { Data, Datum } from 'family-chart'

/**
 * Oldest first (earlier birthday), youngest last. Missing birthdays sort last.
 * ISO date strings (YYYY-MM-DD) compare lexicographically.
 */
export function compareBirthdays(
  aBirthday: string | null | undefined,
  bBirthday: string | null | undefined,
): number {
  const a = (aBirthday ?? '').trim()
  const b = (bBirthday ?? '').trim()
  if (!a && !b) return 0
  if (!a) return 1
  if (!b) return -1
  return a.localeCompare(b)
}

function birthdayOf(d: Datum): string {
  return typeof d.data.birthday === 'string' ? d.data.birthday : ''
}

/** Fallback when no parent list is available: birthday then id. */
export function sortChildrenByBirthday(a: Datum, b: Datum): number {
  const byDate = compareBirthdays(birthdayOf(a), birthdayOf(b))
  if (byDate !== 0) return byDate
  return a.id.localeCompare(b.id)
}

/**
 * Prefer each parent’s `rels.children` order (already sorted by sort_order then
 * birthday in mapToFamilyChartData). Tries every shared parent — the first
 * parent in `rels.parents` is often the co-parent without a manual order.
 */
export function createSortChildrenFromData(data: Data): (a: Datum, b: Datum) => number {
  const byId = new Map(data.map((d) => [d.id, d]))
  return (a: Datum, b: Datum) => {
    const sharedParents = (a.rels.parents ?? []).filter((p) =>
      (b.rels.parents ?? []).includes(p),
    )
    for (const shared of sharedParents) {
      const kids = byId.get(shared)?.rels.children ?? []
      const ai = kids.indexOf(a.id)
      const bi = kids.indexOf(b.id)
      if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi
    }
    return sortChildrenByBirthday(a, b)
  }
}

/**
 * Force each parent's hierarchy children into that parent's `rels.children`
 * order (manual sort_order, then birthday). This overrides family-chart's
 * spouse-index regrouping so drag-reorder on the edit form actually shows.
 */
export function orderHierarchyChildrenByBirth(
  // d3 hierarchy node — keep loosely typed to avoid depending on d3 hierarchy types
  root: { data: Datum; children?: Array<{ data: Datum; children?: unknown }> | null },
  _data: Data,
  isAncestry: boolean,
): void {
  if (isAncestry) return

  function walk(node: {
    data: Datum
    children?: Array<{ data: Datum; children?: unknown }> | null
  }) {
    const kids = node.children
    if (!kids || kids.length < 2) {
      kids?.forEach((c) => walk(c as typeof node))
      return
    }

    const order = node.data.rels.children ?? []
    kids.sort((ha, hb) => {
      const ai = order.indexOf(ha.data.id)
      const bi = order.indexOf(hb.data.id)
      if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi
      if (ai >= 0 && bi < 0) return -1
      if (ai < 0 && bi >= 0) return 1
      return sortChildrenByBirthday(ha.data, hb.data)
    })

    kids.forEach((c) => walk(c as typeof node))
  }

  walk(root)
}
