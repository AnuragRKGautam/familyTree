import { describe, expect, it } from 'vitest'
import type { Data } from 'family-chart'
import {
  buildPathChartData,
  findPeakOnPath,
  findShortestRelationPath,
  formatKinshipLabel,
  relationSentence,
  sanitizeChartData,
} from './findRelation'

function person(
  id: string,
  first: string,
  rels: { parents?: string[]; spouses?: string[]; children?: string[] },
): Data[number] {
  return {
    id,
    data: { gender: 'M', 'first name': first, 'last name': 'Test', birthday: '' },
    rels: {
      parents: rels.parents ?? [],
      spouses: rels.spouses ?? [],
      children: rels.children ?? [],
    },
  }
}

describe('formatKinshipLabel', () => {
  it('capitalizes kinship words', () => {
    expect(formatKinshipLabel('great-grandfather')).toBe('Great-Grandfather')
    expect(formatKinshipLabel('2nd cousin')).toBe('2nd Cousin')
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
      person('a', 'A', { children: ['b', 'missing'], spouses: ['ghost'] }),
      person('b', 'B', { parents: ['a'] }),
    ] as Data
    const clean = sanitizeChartData(data)
    expect(clean.find((d) => d.id === 'a')?.rels.children).toEqual(['b'])
    expect(clean.find((d) => d.id === 'a')?.rels.spouses).toEqual([])
  })
})

describe('cousin path chart', () => {
  // A and B share grandparent G:
  //   G → P1 → A
  //   G → P2 → B
  const data = [
    person('g', 'G', { children: ['p1', 'p2'] }),
    person('p1', 'P1', { parents: ['g'], children: ['a'] }),
    person('p2', 'P2', { parents: ['g'], children: ['b'] }),
    person('a', 'A', { parents: ['p1'] }),
    person('b', 'B', { parents: ['p2'] }),
  ] as Data

  it('finds path through the common ancestor', () => {
    const path = findShortestRelationPath(data, 'a', 'b')
    expect(path).toEqual(['a', 'p1', 'g', 'p2', 'b'])
  })

  it('peaks at the common ancestor', () => {
    const path = findShortestRelationPath(data, 'a', 'b')!
    expect(findPeakOnPath(data, path)).toBe('g')
  })

  it('builds a chart rooted at the ancestor with both branches', () => {
    const path = findShortestRelationPath(data, 'a', 'b')!
    const chart = buildPathChartData(data, path, 'a', '1st Cousin')
    const root = chart.find((d) => d.id === 'g')
    expect(root?.rels.children?.sort()).toEqual(['p1', 'p2'])
    expect(chart.find((d) => d.id === 'a')?.data.kinship).toBe('Self')
    expect(chart.find((d) => d.id === 'b')?.data.kinship).toBe('1st Cousin')
    expect(chart.map((d) => d.id).sort()).toEqual(['a', 'b', 'g', 'p1', 'p2'])
  })
})
