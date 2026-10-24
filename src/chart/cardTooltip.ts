/** Build native/custom tooltip text for a chart card. */
export function formatCardHoverText(
  aliases: string | string[] | null | undefined,
  biography: string | null | undefined,
): string | null {
  const aliasList = Array.isArray(aliases)
    ? aliases.map((a) => a.trim()).filter(Boolean)
    : typeof aliases === 'string'
      ? aliases
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean)
      : []
  const bio = (biography ?? '').trim()
  const parts: string[] = []
  if (aliasList.length === 1) parts.push(`Also known as: ${aliasList[0]}`)
  else if (aliasList.length > 1) parts.push(`Also known as: ${aliasList.join(', ')}`)
  if (bio) parts.push(bio)
  return parts.length > 0 ? parts.join('\n\n') : null
}

export function isDeceasedFlag(data: {
  deceased?: unknown
  death?: unknown
  death_date?: unknown
}): boolean {
  if (data.deceased === true || data.deceased === 'true' || data.deceased === 1) return true
  const death = data.death ?? data.death_date
  return typeof death === 'string' && death.trim().length > 0
}
