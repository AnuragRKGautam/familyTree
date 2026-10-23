import { describe, expect, it } from 'vitest'
import { assignSpouseSides } from './balanceMultipleSpouses'

describe('assignSpouseSides', () => {
  it('puts a male’s two wives on left and right', () => {
    const xs = assignSpouseSides(0, 2, 250, 'M')
    expect(xs[0]).toBe(-250)
    expect(xs[1]).toBe(250)
  })

  it('puts a female’s two husbands on right then left (matches child sort)', () => {
    const xs = assignSpouseSides(0, 2, 250, 'F')
    expect(xs[0]).toBe(250)
    expect(xs[1]).toBe(-250)
  })

  it('alternates further spouses outward', () => {
    const xs = assignSpouseSides(0, 3, 100, 'M')
    expect(xs).toEqual([-100, 100, -200])
  })
})
