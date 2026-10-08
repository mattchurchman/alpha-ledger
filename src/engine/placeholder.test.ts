import Decimal from 'decimal.js'
import { describe, expect, it } from 'vitest'

describe('engine scaffold', () => {
  it('does exact decimal math instead of floating point', () => {
    expect(new Decimal('0.1').plus('0.2').toString()).toBe('0.3')
  })
})
