import { bench, describe } from 'vitest'

// Minimal Survey mock for benchmarking
interface MockSurvey {
  id: string
  geoConsent: boolean
  geoLat?: number | null
  geoLng?: number | null
  geoAccuracyM?: number | null
  geoCapturedAt?: string | null
}

const generateSurveys = (count: number): MockSurvey[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `survey-${i}`,
    geoConsent: i % 2 === 0, // 50% consent
    geoLat: i % 3 === 0 ? null : 4.60971, // ~66% have lat
    geoLng: i % 3 === 0 ? null : -74.08175,
    geoAccuracyM: i % 4 === 0 ? 10 : null,
    geoCapturedAt: '2023-01-01T00:00:00Z',
  }))
}

const testData = generateSurveys(10000)

describe('pushSurveyGeo data preparation', () => {
  bench('current: filter + map', () => {
    void testData
      .filter(s => s.geoConsent && s.geoLat != null && s.geoLng != null)
      .map(s => ({
        survey_id: s.id,
        geo_lat: s.geoLat,
        geo_lng: s.geoLng,
        geo_accuracy_m: s.geoAccuracyM ?? null,
        geo_captured_at: s.geoCapturedAt || null,
      }))
  })

  bench('optimized: single-pass for loop with pre-allocation', () => {
    const len = testData.length
    // Pre-allocate to max possible size to avoid dynamic resizing
    const rows = new Array(len)
    let count = 0

    for (let i = 0; i < len; i++) {
      const s = testData[i]
      if (s.geoConsent && s.geoLat != null && s.geoLng != null) {
        rows[count++] = {
          survey_id: s.id,
          geo_lat: s.geoLat,
          geo_lng: s.geoLng,
          geo_accuracy_m: s.geoAccuracyM ?? null,
          geo_captured_at: s.geoCapturedAt || null,
        }
      }
    }
    // Trim the array
    rows.length = count
    void rows
  })
})
