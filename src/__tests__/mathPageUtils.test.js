import { describe, it, expect } from 'vitest'
import { parseRational } from '../MathPage.jsx'

// ───────────────────────────────────────────────────
//  parseRational – decimal input handling
// ───────────────────────────────────────────────────

describe('parseRational', () => {
  // Existing integer behavior
  it('parses integers', () => {
    expect(parseRational('3')).toEqual([3, 1])
    expect(parseRational('-3')).toEqual([-3, 1])
    expect(parseRational('0')).toEqual([0, 1])
  })

  // Existing fraction behavior
  it('parses fractions', () => {
    expect(parseRational('1/2')).toEqual([1, 2])
    expect(parseRational('-3/4')).toEqual([-3, 4])
    expect(parseRational('0/1')).toEqual([0, 1])
  })

  // NEW: decimal input handling (the bug fix)
  it('parses decimals like "0.3" into exact rationals', () => {
    expect(parseRational('0.3')).toEqual([3, 10])
  })

  it('parses ".5" into 1/2', () => {
    expect(parseRational('.5')).toEqual([1, 2])
  })

  it('parses "0.25" into 1/4', () => {
    expect(parseRational('0.25')).toEqual([1, 4])
  })

  it('parses negative decimals', () => {
    expect(parseRational('-0.3')).toEqual([-3, 10])
    expect(parseRational('-1.5')).toEqual([-3, 2])
  })

  it('parses trailing dot as integer', () => {
    expect(parseRational('3.')).toEqual([3, 1])
  })

  it('parses "0.0" as zero', () => {
    expect(parseRational('0.0')).toEqual([0, 1])
  })

  it('normalizes decimals to lowest terms', () => {
    // 0.5 = 5/10 → 1/2
    expect(parseRational('0.5')).toEqual([1, 2])
    // 0.75 = 75/100 → 3/4
    expect(parseRational('0.75')).toEqual([3, 4])
  })

  it('parses negative trailing dot as integer', () => {
    expect(parseRational('-3.')).toEqual([-3, 1])
  })

  it('parses leading-dot negative decimal', () => {
    expect(parseRational('-.5')).toEqual([-1, 2])
  })

  // Invalid inputs
  it('rejects empty string', () => {
    expect(parseRational('')).toBeNull()
  })

  it('rejects non-numeric strings', () => {
    expect(parseRational('abc')).toBeNull()
  })

  it('rejects division by zero', () => {
    expect(parseRational('1/0')).toBeNull()
  })

  // Whitespace handling
  it('trims whitespace', () => {
    expect(parseRational('  3  ')).toEqual([3, 1])
    expect(parseRational(' 1/2 ')).toEqual([1, 2])
    expect(parseRational(' 0.3 ')).toEqual([3, 10])
  })
})
