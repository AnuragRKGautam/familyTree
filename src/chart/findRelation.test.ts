import { describe, expect, it } from 'vitest'
import type { Data } from 'family-chart'
import {
  buildPathChartData,
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

describe('findShortestRelationPath', () => {
  it('finds parent–child path', () => {
    const data = [
      person('a', 'A', { children: ['b'] }),
      person('b', 'B', { parents: ['a'] }),
    ] as Data
    expect(findShortestRelationPath(data, 'a', 'b')).toEqual(['a', 'b'])
  })

  it('builds chart data for a path', () => {
    const data = [
      person('a', 'A', { children: ['b'] }),
      person('b', 'B', { parents: ['a'] }),
    ] as Data
    const path = findShortestRelationPath(data, 'a', 'b')!
    const chart = buildPathChartData(data, path, 'a', 'Son')
    expect(chart).toHaveLength(2)
    expect(chart.find((d) => d.id === 'b')?.data.kinship).toBe('Son')
  })
})
