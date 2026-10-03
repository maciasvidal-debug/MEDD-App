import { bench, describe } from 'vitest'
import { dayDiff } from './date'

describe('dayDiff performance', () => {
  // Generate some dummy date strings
  const dates = []
  for (let i = 0; i < 1000; i++) {
    const y = 2020 + Math.floor(Math.random() * 10)
    const m = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')
    const d = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')
    dates.push(`${y}-${m}-${d}`)
  }

  bench('dayDiff with random dates', () => {
    for (let i = 0; i < dates.length - 1; i++) {
      dayDiff(dates[i], dates[i + 1])
    }
  })
})
