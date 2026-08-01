// Statistical analysis: inferential tests (proportions, risk ratios, stratified
// Mantel–Haenszel / Breslow–Day, chi-square, trend), the shared chi-square/gamma
// internals they depend on, multiple-comparison control, and data-quality /
// fraud signals. Grouped together because the inferential and fraud tests all
// share the private chi-square tail below.

// ─── Inferential statistics ─────────────────────────────────────────────────

export interface Proportion {
  n:     number  // successes
  total: number  // base (denominator)
  p:     number  // point estimate, 0..1
  lo:    number  // 95% CI lower bound, 0..1
  hi:    number  // 95% CI upper bound, 0..1
}

/**
 * Wilson score confidence interval for a binomial proportion (default 95%).
 * Preferred over the naive Wald interval because it stays inside [0,1] and
 * remains reliable for small samples and proportions near 0 or 1 — the typical
 * case for per-city / per-stratum cells in this survey. Returns a zero-width
 * interval when there is no base to avoid division by zero.
 */
export function wilsonCI(successes: number, total: number, z = 1.96): Proportion {
  if (total <= 0) return { n: successes, total: 0, p: 0, lo: 0, hi: 0 }
  const p      = successes / total
  const z2     = z * z
  const denom  = 1 + z2 / total
  const centre = p + z2 / (2 * total)
  const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total)
  return {
    n: successes,
    total,
    p,
    lo: Math.max(0, (centre - margin) / denom),
    hi: Math.min(1, (centre + margin) / denom),
  }
}

/**
 * Sample quantile with linear interpolation (R type-7 / NumPy default). Returns
 * NaN for an empty input. Sorts a copy, so the caller's array is untouched,
 * unless isSorted is true, in which case it uses the array directly.
 */
export function quantile(values: number[], q: number, isSorted = false): number {
  if (values.length === 0) return NaN
  const sorted = isSorted ? values : [...values].sort((a, b) => a - b)
  if (sorted.length === 1) return sorted[0]
  const pos = (sorted.length - 1) * q
  const lo  = Math.floor(pos)
  const hi  = Math.ceil(pos)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo])
}

export interface RiskRatio {
  rr:  number   // prevalence/risk ratio vs reference
  lo:  number   // 95% CI lower
  hi:  number   // 95% CI upper
  ref: boolean  // true for the reference group itself
}

/**
 * Prevalence ratio (a/n1 ÷ c/n0) of an outcome in an exposed group vs a
 * reference group, with a 95% CI from the log-ratio (Katz) method. When any
 * cell is empty the Haldane–Anscombe 0.5 correction keeps the estimate finite.
 * A CI that excludes 1 indicates a statistically significant association.
 */
export function prevalenceRatio(a: number, n1: number, c: number, n0: number): RiskRatio {
  if (n1 <= 0 || n0 <= 0) return { rr: NaN, lo: NaN, hi: NaN, ref: false }
  let A = a, C = c, N1 = n1, N0 = n0
  const b = n1 - a, d = n0 - c
  if (a === 0 || c === 0 || b === 0 || d === 0) {
    A = a + 0.5; C = c + 0.5; N1 = n1 + 1; N0 = n0 + 1
  }
  const rr = (A / N1) / (C / N0)
  const se = Math.sqrt(1 / A + 1 / C - 1 / N1 - 1 / N0)
  return { rr, lo: rr * Math.exp(-1.96 * se), hi: rr * Math.exp(1.96 * se), ref: false }
}

/** A 2×2 stratum: a=exposed&case, b=exposed&non-case, c=unexposed&case, d=unexposed&non-case. */
export interface Stratum2x2 { a: number; b: number; c: number; d: number }

export interface MHResult {
  rr:   number  // Mantel–Haenszel adjusted prevalence/risk ratio
  lo:   number  // 95% CI lower (Greenland–Robins)
  hi:   number  // 95% CI upper
  chi2: number  // Cochran–Mantel–Haenszel statistic (1 df)
  p:    number  // CMH p-value
  strata: number          // strata that contributed (had both exposure levels)
  exposedCases:   number
  unexposedCases: number
}

/**
 * Mantel–Haenszel adjusted prevalence ratio across strata of a confounder, with
 * the Greenland–Robins variance for its 95% CI and the Cochran–Mantel–Haenszel
 * test of conditional association. Pooling within strata removes confounding by
 * the stratifying variable (here: comparing a crude vs adjusted RR reveals
 * whether e.g. the surveyor profile confounds an exposure→outcome association).
 * Strata with no exposure contrast (all exposed or all unexposed) contribute
 * nothing. Returns null when fewer than one informative stratum remains.
 */
export function mantelHaenszelRR(strata: Stratum2x2[]): MHResult | null {
  let num = 0, den = 0, varNum = 0       // RR numerator/denominator + GR variance numerator
  let cmhO = 0, cmhE = 0, cmhV = 0       // CMH observed/expected/variance
  let used = 0, exposedCases = 0, unexposedCases = 0

  for (const { a, b, c, d } of strata) {
    const n1 = a + b, n0 = c + d, m1 = a + c, n = a + b + c + d
    if (n === 0 || n1 === 0 || n0 === 0) continue
    used++
    exposedCases += a
    unexposedCases += c
    num += (a * n0) / n
    den += (c * n1) / n
    varNum += (n1 * n0 * m1 - a * c * n) / (n * n)
    cmhO += a
    cmhE += (n1 * m1) / n
    if (n > 1) cmhV += (n1 * n0 * m1 * (n - m1)) / (n * n * (n - 1))
  }

  if (used === 0 || num === 0 || den === 0) return null
  const rr = num / den
  const se = Math.sqrt(varNum / (num * den))
  const chi2 = cmhV > 0 ? ((cmhO - cmhE) ** 2) / cmhV : 0
  return {
    rr,
    lo: rr * Math.exp(-1.96 * se),
    hi: rr * Math.exp(1.96 * se),
    chi2,
    p: chiSquareP(chi2, 1),
    strata: used,
    exposedCases,
    unexposedCases,
  }
}

export interface ICCResult {
  icc:          number  // intraclass correlation, 0..1
  clusters:     number  // number of clusters (e.g. surveyors)
  n:            number  // total observations
  designEffect: number  // 1 + (m̄−1)·ICC — variance inflation from clustering
}

/**
 * One-way random-effects intraclass correlation for a BINARY outcome clustered
 * by group (e.g. by surveyor). It is the canonical measure of the interviewer
 * effect: the share of outcome variance attributable to which surveyor collected
 * the record. Uses ANOVA mean squares with the unequal-cluster-size correction
 * (n₀). Returns null with fewer than 2 informative clusters; ICC is clamped to
 * [0,1]. Each group is summarised by its size and case count.
 */
export function iccBinary(groups: { n: number; cases: number }[]): ICCResult | null {
  const g = groups.filter(x => x.n > 0)
  const k = g.length
  const N = g.reduce((s, x) => s + x.n, 0)
  if (k < 2 || N <= k) return null

  const pbar = g.reduce((s, x) => s + x.cases, 0) / N
  let ssb = 0, ssw = 0, sumSq = 0
  for (const { n, cases } of g) {
    const p = cases / n
    ssb += n * (p - pbar) ** 2          // between-cluster
    ssw += n * p * (1 - p)              // within-cluster (binary identity)
    sumSq += n * n
  }
  const msb = ssb / (k - 1)
  const msw = ssw / (N - k)
  const n0 = (N - sumSq / N) / (k - 1)
  const denom = msb + (n0 - 1) * msw
  let icc = denom > 0 ? (msb - msw) / denom : 0
  if (!Number.isFinite(icc) || icc < 0) icc = 0
  if (icc > 1) icc = 1
  return { icc, clusters: k, n: N, designEffect: 1 + (n0 - 1) * icc }
}

/**
 * Breslow–Day test for homogeneity of the odds ratio across strata — i.e. whether
 * a single common association is reasonable, or the effect is MODIFIED by the
 * stratifying variable. Complements the Mantel–Haenszel pooled estimate (which
 * assumes homogeneity). Fits each stratum's expected exposed-case count under the
 * MH common OR and sums standardized squared residuals (χ², k−1 df). Returns null
 * with fewer than 2 fully-informative strata.
 */
export function breslowDay(strata: Stratum2x2[]): { chi2: number; df: number; p: number } | null {
  const len = strata.length
  let usableCount = 0
  let orNum = 0, orDen = 0

  // Pass 1: find usable strata and compute Mantel-Haenszel common OR
  // Avoids intermediate array allocations from .filter() and object destructuring overhead
  for (let i = 0; i < len; i++) {
    const s = strata[i]
    const a = s.a, b = s.b, c = s.c, d = s.d
    if ((a + b) > 0 && (c + d) > 0 && (a + c) > 0 && (b + d) > 0) {
      usableCount++
      const n = a + b + c + d
      orNum += (a * d) / n
      orDen += (b * c) / n
    }
  }

  if (usableCount < 2 || orDen === 0) return null

  // Note: we cannot completely fuse the two loops because 'psi' (the pooled OR estimate)
  // must be fully computed across ALL strata before we can calculate expected counts in pass 2.
  const psi = orNum / orDen
  if (!Number.isFinite(psi) || psi <= 0) return null

  let bd = 0

  // Pass 2: compute Breslow-Day statistic
  for (let i = 0; i < len; i++) {
    const s = strata[i]
    const a = s.a, b = s.b, c = s.c, d = s.d
    if ((a + b) > 0 && (c + d) > 0 && (a + c) > 0 && (b + d) > 0) {
      const n1 = a + b, m1 = a + c, N = a + b + c + d
      // Expected exposed-case count A under the common OR ψ (root of a quadratic).
      let A: number
      const alpha = psi - 1
      if (Math.abs(alpha) < 1e-9) {
        A = (m1 * n1) / N
      } else {
        const bcoef = -(psi * (m1 + n1) + (N - n1 - m1))
        const disc = Math.sqrt(Math.max(0, bcoef * bcoef - 4 * alpha * psi * m1 * n1))
        const lo = Math.max(0, n1 + m1 - N), hi = Math.min(n1, m1)
        const r1 = (-bcoef - disc) / (2 * alpha)
        const r2 = (-bcoef + disc) / (2 * alpha)
        A = (r1 >= lo - 1e-6 && r1 <= hi + 1e-6) ? r1 : r2
      }
      const va = 1 / (1 / A + 1 / (n1 - A) + 1 / (m1 - A) + 1 / (N - n1 - m1 + A))
      if (Number.isFinite(va) && va > 0) bd += (a - A) ** 2 / va
    }
  }

  const df = usableCount - 1
  return { chi2: bd, df, p: chiSquareP(bd, df) }
}

export interface ChiSquare {
  chi2:        number  // Pearson statistic
  df:          number  // degrees of freedom
  p:           number  // upper-tail p-value
  minExpected: number  // smallest expected cell (chi² unreliable if < 5)
}

/** Pearson chi-square test of independence for an R×C contingency table. */
export function chiSquareTest(table: number[][]): ChiSquare {
  const rows = table.length
  const cols = rows ? table[0].length : 0

  // Single pass calculation of sums using typed arrays to avoid object allocation overhead
  const rowSums = new Float64Array(rows)
  const colSums = new Float64Array(cols)
  let total = 0

  for (let i = 0; i < rows; i++) {
    const row = table[i]
    let rowSum = 0
    for (let j = 0; j < cols; j++) {
      const val = row[j]
      rowSum += val
      colSums[j] += val
    }
    rowSums[i] = rowSum
    total += rowSum
  }

  if (total === 0 || rows < 2 || cols < 2) return { chi2: 0, df: 0, p: 1, minExpected: 0 }

  let chi2 = 0
  let minExpected = Infinity
  for (let i = 0; i < rows; i++) {
    const rowSum = rowSums[i]
    if (rowSum === 0) continue

    const row = table[i]
    for (let j = 0; j < cols; j++) {
      const expected = (rowSum * colSums[j]) / total
      // Avoid Math.min function call overhead
      if (expected < minExpected) minExpected = expected
      if (expected > 0) chi2 += (row[j] - expected) ** 2 / expected
    }
  }

  const df = (rows - 1) * (cols - 1)
  return { chi2, df, p: chiSquareP(chi2, df), minExpected }
}

export interface TrendTest {
  z:         number  // standardized trend statistic
  chi2:      number  // z² ~ chi-square with 1 df
  p:         number  // two-sided p-value
  direction: 'creciente' | 'decreciente' | 'plano'
}

/**
 * Cochran–Armitage test for trend in a binomial proportion across an ORDERED
 * exposure. Unlike a plain chi-square (which treats the groups as unordered and
 * loses power), this tests for a monotone dose-response with the exposure score,
 * the relevant question for a socioeconomic gradient. Each group carries a score
 * (e.g. 1,2,3 for low/mid/high), its size n and its case count. Two-sided
 * p-value via z² ~ χ²₁. Returns null when there is no informative table.
 */
export function cochranArmitage(groups: { score: number; n: number; cases: number }[]): TrendTest | null {
  const N = groups.reduce((s, g) => s + g.n, 0)
  const R = groups.reduce((s, g) => s + g.cases, 0)
  if (groups.length < 2 || N === 0 || R === 0 || R === N) return null

  const pBar  = R / N
  const u     = groups.reduce((s, g) => s + g.score * (g.cases - g.n * pBar), 0)
  const sumNS  = groups.reduce((s, g) => s + g.n * g.score, 0)
  const sumNS2 = groups.reduce((s, g) => s + g.n * g.score * g.score, 0)
  const v = pBar * (1 - pBar) * (sumNS2 - (sumNS * sumNS) / N)
  if (v <= 0) return null

  const z = u / Math.sqrt(v)
  return {
    z,
    chi2: z * z,
    p: chiSquareP(z * z, 1),
    direction: z > 0 ? 'creciente' : z < 0 ? 'decreciente' : 'plano',
  }
}

// Upper-tail p-value of the chi-square distribution: P(X > chi2) with df.
function chiSquareP(chi2: number, df: number): number {
  if (chi2 <= 0 || df <= 0) return 1
  return 1 - regLowerGamma(df / 2, chi2 / 2)
}

// Lanczos approximation of ln Γ(x).
function lnGamma(x: number): number {
  /* eslint-disable no-loss-of-precision -- canonical full-precision Lanczos coefficients */
  const g = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
  ]
  /* eslint-enable no-loss-of-precision */
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) { y++; ser += g[j] / y }
  return -tmp + Math.log(Math.sqrt(2 * Math.PI) * ser / x)
}

// Regularized lower incomplete gamma P(a,x) (series + continued fraction).
function regLowerGamma(a: number, x: number): number {
  if (x < 0 || a <= 0) return NaN
  if (x === 0) return 0
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum
    for (let n = 0; n < 300; n++) {
      ap++; del *= x / ap; sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-13) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  const FPMIN = 1e-300
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-13) break
  }
  const q = Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
  return 1 - q
}

// ─── Multiple-comparisons control ─────────────────────────────────────────

export interface HolmResult<K = string> {
  key:    K
  p:      number
  pAdj:   number   // Holm-adjusted p-value (monotone, capped at 1)
  reject: boolean  // reject H0 at the family-wise alpha
}

/**
 * Holm–Bonferroni step-down adjustment. Controls the family-wise error rate at
 * `alpha` across a family of simultaneous tests and is uniformly more powerful
 * than plain Bonferroni. Sorts by ascending p, scales the k-th smallest by the
 * number of remaining tests (m−k), enforces monotonicity, and rejects down to
 * the first non-significant test. Returned in ascending-p order.
 */
export function holmAdjust<K = string>(
  tests: { key: K; p: number }[],
  alpha = 0.05,
): HolmResult<K>[] {
  const m = tests.length
  if (m === 0) return []
  const ordered = [...tests].sort((a, b) => a.p - b.p)
  let running = 0
  let stillRejecting = true
  return ordered.map((t, i) => {
    const pAdj = Math.max(running, Math.min(1, t.p * (m - i)))
    running = pAdj
    if (pAdj > alpha) stillRejecting = false
    return { key: t.key, p: t.p, pAdj, reject: stillRejecting }
  })
}

// ─── Data-quality / fraud signals ─────────────────────────────────────────

export interface DigitTest { chi2: number; df: number; p: number; n: number }

/**
 * Terminal-digit (last-digit) uniformity test: chi-square goodness-of-fit of the
 * final digit of a set of measured numbers against a uniform 0–9 distribution.
 * Genuinely measured quantities have ~uniform last digits; fabricated or heavily
 * rounded data show digit preference (excess 0/5), which this flags (small p).
 * Returns null with too few values to assess (n < 20).
 */
export function terminalDigitTest(values: number[]): DigitTest | null {
  const digits = values
    .filter(v => Number.isFinite(v))
    .map(v => Math.abs(Math.trunc(v)) % 10)
  const n = digits.length
  if (n < 20) return null
  const counts = new Array(10).fill(0)
  for (const d of digits) counts[d]++
  const expected = n / 10
  let chi2 = 0
  for (const c of counts) chi2 += (c - expected) ** 2 / expected
  return { chi2, df: 9, p: chiSquareP(chi2, 9), n }
}

export interface KappaResult { kappa: number; agree: number; n: number }

/**
 * Unweighted Cohen's κ for two raters over paired categorical labels — the
 * standard inter-observer agreement measure, correcting observed agreement for
 * agreement expected by chance from the marginals. Used to compare a back-check
 * re-interview against the original. Returns `agree` (raw proportion) and `n`
 * (pairs). κ = (po − pe)/(1 − pe); perfect observed agreement → 1. Null with no
 * pairs.
 */
export function cohenKappa(pairs: [string, string][]): KappaResult | null {
  const n = pairs.length
  if (n === 0) return null
  const cats = new Set<string>()
  const rowA: Record<string, number> = {}
  const rowB: Record<string, number> = {}
  let agreeCount = 0
  for (const [a, b] of pairs) {
    cats.add(a); cats.add(b)
    rowA[a] = (rowA[a] ?? 0) + 1
    rowB[b] = (rowB[b] ?? 0) + 1
    if (a === b) agreeCount++
  }
  const po = agreeCount / n
  if (po === 1) return { kappa: 1, agree: 1, n }
  let pe = 0
  for (const c of cats) pe += ((rowA[c] ?? 0) / n) * ((rowB[c] ?? 0) / n)
  return { kappa: pe >= 1 ? 0 : (po - pe) / (1 - pe), agree: po, n }
}
