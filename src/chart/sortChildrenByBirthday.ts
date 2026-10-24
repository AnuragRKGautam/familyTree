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
 * birthday in mapToFamilyChartData). Falls back to birthday.
 */
export function createSortChildrenFromData(data: Data): (a: Datum, b: Datum) => number {
  const byId = new Map(data.map((d) => [d.id, d]))
  return (a: Datum, b: Datum) => {
    const aParents = a.rels.parents ?? []
    const shared = aParents.find((p) => (b.rels.parents ?? []).includes(p))
    if (shared) {
      const kids = byId.get(shared)?.rels.children ?? []
      const ai = kids.indexOf(a.id)
      const bi = kids.indexOf(b.id)
      if (ai >= 0 && bi >= 0 && ai !== bi) return ai - bi
    }
    return sortChildrenByBirthday(a, b)
  }
}

/**
 * After family-chart groups children by spouse, re-apply birth/manual order
 * within (and across) groups. Missing co-parent is treated as spouse index 0
 * so kids only linked to one parent are not pushed to the far left incorrectly.
 */
export function orderHierarchyChildrenByBirth(
  // d3 hierarchy node — keep loosely typed to avoid depending on d3 hierarchy types
  root: { data: Datum; children?: Array<{ data: Datum; children?: unknown }> | null },
  data: Data,
  isAncestry: boolean,
): void {
  if (isAncestry) return
  const baseSort = createSortChildrenFromData(data)

  function walk(node: {
    data: Datum
    children?: Array<{ data: Datum; children?: unknown }> | null
  }) {
    const kids = node.children
    if (!kids || kids.length < 2) {
      kids?.forEach((c) => walk(c as typeof node))
      return
    }

    const parent = node.data
    const spouses = parent.rels.spouses ?? []

    function coParentIndex(child: Datum): number {
      const otherId = (child.rels.parents ?? []).find((p) => p !== parent.id)
      if (!otherId) return 0
      const idx = spouses.indexOf(otherId)
      return idx < 0 ? 0 : idx
    }

    const maleParent = parent.data.gender === 'M'
    kids.sort((ha, hb) => {
      const a = ha.data
      const b = hb.data
      const ai = coParentIndex(a)
      const bi = coParentIndex(b)
      // Same rule as family-chart: males keep spouse-0 on the left.
      const bySpouse = maleParent ? ai - bi : bi - ai
      if (bySpouse !== 0) return bySpouse
      return baseSort(a, b)
    })

    kids.forEach((c) => walk(c as typeof node))
  }

  walk(root)
}
