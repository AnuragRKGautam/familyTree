import { describe, expect, it } from 'vitest'
import { fictionalFamily } from './fictionalFamily'
import { toFamilyChartData } from './toFamilyChartData'
import { searchPeople } from './graphQueries'

describe('toFamilyChartData', () => {
  it('maps partnerships bidirectionally and keeps library format out of domain', () => {
    const data = toFamilyChartData(fictionalFamily)
    const byId = Object.fromEntries(data.map((d) => [d.id, d]))

    expect(byId['g0-margaret']?.rels.spouses).toContain('g0-harold')
    expect(byId['g0-harold']?.rels.spouses).toContain('g0-margaret')
    // Chart payload caps at 2 parents; Maya’s adoptive pair is preferred.
    expect(byId['g2-maya']?.rels.parents).toHaveLength(2)
    expect(byId['g2-maya']?.rels.parents).toEqual(
      expect.arrayContaining(['g2-adoptive-dad', 'g2-adoptive-mom']),
    )
    expect(byId['g2-maya']?.rels.parents).not.toContain('g2-lena')
    expect(byId['g2-noah']?.rels.parents).toEqual(
      expect.arrayContaining(['g1-robert', 'g1-susan']),
    )
    expect(byId['g2-lena']?.rels.parents).toEqual(['g1-robert'])
  })

  it('includes disconnected Ash branch people in the dataset', () => {
    const data = toFamilyChartData(fictionalFamily)
    expect(data.some((d) => d.id === 'x2-sam')).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(25)
    expect(data.length).toBeLessThanOrEqual(40)
  })
})

describe('searchPeople', () => {
  it('finds repeated James Hale names', () => {
    const hits = searchPeople(fictionalFamily, 'James Hale')
    expect(hits.length).toBeGreaterThanOrEqual(2)
  })
})
