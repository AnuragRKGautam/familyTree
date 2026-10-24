import { describe, expect, it } from 'vitest'
import type { Data } from 'family-chart'
import {
  buildPathChartData,
  cousinLineSide,
  findPeakOnPath,
  findShortestRelationPath,
  formatKinshipLabel,
  generationRelativeTo,
  relationSentence,
  sanitizeChartData,
} from './findRelation'

function person(
  id: string,
  first: string,
  gender: 'M' | 'F',
  rels: { parents?: string[]; spouses?: string[]; children?: string[] },
): Data[number] {
  return {
    id,
    data: { gender, 'first name': first, 'last name': 'Test', birthday: '' },
    rels: {
      parents: rels.parents ?? [],
      spouses: rels.spouses ?? [],
      children: rels.children ?? [],
    },
  }
}

describe('formatKinshipLabel', () => {
  it('capitalizes non-cousin kinship words', () => {
    expect(formatKinshipLabel('great-grandfather')).toBe('Great-Grandfather')
  })

  it('uses paternal/maternal cousin brother / sister labels', () => {
    expect(formatKinshipLabel('1st Cousin', 'F', 'paternal', 'same')).toBe(
      'Paternal cousin sister',
    )
    expect(formatKinshipLabel('1st Cousin', 'M', 'maternal', 'same')).toBe(
      'Maternal cousin brother',
    )
    expect(formatKinshipLabel('2nd Cousin', 'M')).toBe('Cousin brother')
  })

  it('maps parent’s cousin (once removed, older) to aunt/uncle', () => {
    expect(formatKinshipLabel('1st Cousin 1x removed', 'F', 'paternal', 'older')).toBe(
      'Paternal aunt',
    )
    expect(formatKinshipLabel('1st Cousin 1x removed', 'M', 'maternal', 'older')).toBe(
      'Maternal uncle',
    )
  })

  it('maps cousin’s child (once removed, younger) to niece/nephew', () => {
    expect(formatKinshipLabel('1st Cousin 1x removed', 'F', 'paternal', 'younger')).toBe(
      'Paternal niece',
    )
    expect(formatKinshipLabel('1st Cousin 1x removed', 'M', 'maternal', 'younger')).toBe(
      'Maternal nephew',
    )
  })

  it('adds side to aunt/uncle from the kinship engine', () => {
    expect(formatKinshipLabel('aunt', 'F', 'paternal')).toBe('Paternal aunt')
    expect(formatKinshipLabel('uncle', 'M', 'maternal')).toBe('Maternal uncle')
  })
})

describe('relationSentence', () => {
  it('describes kinship', () => {
    expect(relationSentence('Ram', 'Sita', 'Spouse')).toBe('Sita is the spouse of Ram.')
  })

  it('handles unrelated', () => {
    expect(relationSentence('Ram', 'Ash', null)).toContain('does not appear related')
  })
})

describe('sanitizeChartData', () => {
  it('drops dangling relationship ids', () => {
    const data = [
      person('a', 'A', 'M', { children: ['b', 'missing'], spouses: ['ghost'] }),
      person('b', 'B', 'M', { parents: ['a'] }),
    ] as Data
    const clean = sanitizeChartData(data)
    expect(clean.find((d) => d.id === 'a')?.rels.children).toEqual(['b'])
    expect(clean.find((d) => d.id === 'a')?.rels.spouses).toEqual([])
  })
})

describe('cousin path chart', () => {
  // Father's side: G(M) → P1(M) → A(M)
  //                G(M) → P2(M) → B(F)
  const data = [
    person('g', 'G', 'M', { children: ['p1', 'p2'] }),
    person('p1', 'P1', 'M', { parents: ['g'], children: ['a'] }),
    person('p2', 'P2', 'M', { parents: ['g'], children: ['b'] }),
    person('mom', 'Mom', 'F', { children: ['a'] }),
    person('a', 'A', 'M', { parents: ['p1', 'mom'] }),
    person('b', 'B', 'F', { parents: ['p2'] }),
  ] as Data

  it('finds path through the common ancestor', () => {
    const path = findShortestRelationPath(data, 'a', 'b')
    expect(path?.[0]).toBe('a')
    expect(path?.[path.length - 1]).toBe('b')
    expect(path).toContain('g')
  })

  it('peaks at the common ancestor', () => {
    const path = findShortestRelationPath(data, 'a', 'b')!
    expect(findPeakOnPath(data, path)).toBe('g')
  })

  it('detects paternal cousin line via father', () => {
    expect(cousinLineSide(data, 'a', 'b')).toBe('paternal')
  })

  it('builds a chart rooted at the ancestor with both branches', () => {
    const path = findShortestRelationPath(data, 'a', 'b')!
    const chart = buildPathChartData(data, path, 'a', 'Paternal cousin sister')
    const root = chart.find((d) => d.id === 'g')
    expect(root?.rels.children?.sort()).toEqual(['p1', 'p2'])
    expect(chart.find((d) => d.id === 'a')?.data.kinship).toBe('Self')
    expect(chart.find((d) => d.id === 'b')?.data.kinship).toBe('Paternal cousin sister')
  })
})

describe('maternal cousin line', () => {
  const data = [
    person('mg', 'MG', 'F', { children: ['mom', 'maunt'] }),
    person('mom', 'Mom', 'F', { parents: ['mg'], children: ['a'] }),
    person('maunt', 'MAunt', 'F', { parents: ['mg'], children: ['c'] }),
    person('dad', 'Dad', 'M', { children: ['a'] }),
    person('a', 'A', 'F', { parents: ['mom', 'dad'] }),
    person('c', 'C', 'M', { parents: ['maunt'] }),
  ] as Data

  it('detects maternal side', () => {
    expect(cousinLineSide(data, 'a', 'c')).toBe('maternal')
    expect(formatKinshipLabel('1st Cousin', 'M', 'maternal', 'same')).toBe(
      'Maternal cousin brother',
    )
  })
})

describe('parent’s cousin is paternal aunt (Riddhi ← Toshan via Anurag)', () => {
  // Grand: G → Anurag’s parent P1, Toshan’s parent P2
  // Anurag and Toshan are cousins; Riddhi is Anurag’s daughter.
  const data = [
    person('g', 'G', 'M', { children: ['p1', 'p2'] }),
    person('p1', 'P1', 'M', { parents: ['g'], children: ['anurag'] }),
    person('p2', 'P2', 'M', { parents: ['g'], children: ['toshan'] }),
    person('anurag', 'Anurag', 'M', { parents: ['p1'], children: ['riddhi'] }),
    person('toshan', 'Toshan', 'F', { parents: ['p2'] }),
    person('riddhi', 'Riddhi', 'F', { parents: ['anurag'] }),
  ] as Data

  it('places Toshan a generation above Riddhi on the paternal line', () => {
    expect(cousinLineSide(data, 'riddhi', 'toshan')).toBe('paternal')
    expect(generationRelativeTo(data, 'riddhi', 'toshan')).toBe('older')
    expect(
      formatKinshipLabel('1st Cousin 1x removed', 'F', 'paternal', 'older'),
    ).toBe('Paternal aunt')
  })

  it('places Riddhi as Toshan’s paternal niece', () => {
    expect(cousinLineSide(data, 'toshan', 'riddhi')).toBe('paternal')
    expect(generationRelativeTo(data, 'toshan', 'riddhi')).toBe('younger')
    expect(
      formatKinshipLabel('1st Cousin 1x removed', 'F', 'paternal', 'younger'),
    ).toBe('Paternal niece')
  })
})
