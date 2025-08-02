import { describe, it, expect } from 'vitest'

describe('Basic Tests', () => {
  it('should pass basic test', () => {
    expect(true).toBe(true)
  })

  it('should perform basic math', () => {
    expect(2 + 2).toBe(4)
  })
})