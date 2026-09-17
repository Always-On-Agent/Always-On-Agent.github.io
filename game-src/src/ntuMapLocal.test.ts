import { describe, expect, it } from 'vitest'
import { isNtuMapRebuild } from './ntuMapLocal'

describe('published campus selection', () => {
  it('uses the reconstructed world on public hosts and old shared campus links', () => {
    for (const scene of ['singapore', 'ntu', 'village']) {
      expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: `?scene=${scene}` })).toBe(true)
    }
  })
  it('keeps ECCV independent and only permits the legacy hall preview locally', () => {
    expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: '?scene=eccv' })).toBe(false)
    expect(isNtuMapRebuild({ hostname: 'localhost', search: '?scene=singapore&campusPrototype=hall3-16' })).toBe(false)
    expect(isNtuMapRebuild({ hostname: 'always-on-agent.github.io', search: '?scene=singapore&campusPrototype=hall3-16' })).toBe(true)
  })
})
