import { expect, test } from 'vitest'
import { advanceDay, createDayState, DAY_PRESETS, DAY_STEP_COUNT, getDayPresetChoice, getDayReport } from './ntuDayDemoEngine'

test('all automatic presets finish, preserve evidence boundaries and produce distinct endings', () => {
  const endings: string[] = []
  for (const preset of DAY_PRESETS) {
    let state = createDayState()
    for (let i = 0; i < DAY_STEP_COUNT; i++) {
      const next = advanceDay(state, getDayPresetChoice(state, preset.id))
      expect(next.index).toBe(state.index + 1)
      state = next
    }
    const report = getDayReport(state)
    endings.push(report.ending)
    expect(state.status).toBe('complete')
    expect(state.trace.map(entry => entry.time)).toEqual(state.trace.map(entry => entry.time).sort())
    expect(state.policyVersion).toBe('fixed-demo-v1')
    if (preset.id === 'careful') {
      expect(state.receipts).toHaveLength(3)
      expect(report.channels).toHaveLength(5)
    }
    if (preset.id === 'quiet') {
      expect(state.memory.some(record => record.id === 'pickup')).toBe(false)
      expect(state.receipts.some(receipt => /BOOK|KIT/.test(receipt))).toBe(false)
    }
    if (preset.id === 'uncertain') expect(state.receipts).toHaveLength(0)
  }
  expect(endings).toEqual(['closed', 'quiet', 'unfinished'])
})
