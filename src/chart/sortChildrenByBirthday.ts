import type { Datum } from 'family-chart'

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

/** family-chart setSortChildrenFunction: left = older, right = younger. */
export function sortChildrenByBirthday(a: Datum, b: Datum): number {
  const byDate = compareBirthdays(
    typeof a.data.birthday === 'string' ? a.data.birthday : '',
    typeof b.data.birthday === 'string' ? b.data.birthday : '',
  )
  if (byDate !== 0) return byDate
  return a.id.localeCompare(b.id)
}
