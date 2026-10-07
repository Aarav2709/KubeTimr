import { finalTime, Solve } from "./types";

// wca style stats: ao n trims ceil(n * trim%) per side, mo n is a plain mean, dnf is infinity, nan means not enough solves

export interface AvgSpec {
  key: string;
  kind: "ao" | "mo";
  n: number;
}

export function parseStatKey(key: string): AvgSpec | null {
  const m = key.trim().toLowerCase().match(/^(ao|mo)(\d+)$/);
  if (!m) return null;
  const n = parseInt(m[2]!, 10);
  if (n < 1 || n > 100_000) return null;
  if (m[1] === "ao" && n < 3) return null;
  return { key: `${m[1]}${n}`, kind: m[1] as "ao" | "mo", n };
}

export function trimCount(n: number, trimPercent: number): number {
  if (n < 3) return 0;
  // epsilon keeps 100 * 0.05 at 5 despite float error
  return Math.min(Math.floor((n - 1) / 2), Math.ceil(n * (trimPercent / 100) - 1e-9));
}

// final ms per solve, infinity for dnf
export function toValues(solves: readonly Solve[]): number[] {
  return solves.map((s) => finalTime(s) ?? Number.POSITIVE_INFINITY);
}

// one average over a window of values
export function windowAverage(window: readonly number[], spec: AvgSpec, trimPercent: number): number {
  if (window.length < spec.n) return Number.NaN;
  if (spec.kind === "mo") {
    let sum = 0;
    for (const v of window) {
      if (v === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
      sum += v;
    }
    return sum / window.length;
  }
  const sorted = [...window].sort((a, b) => a - b);
  return trimmedMeanOfSorted(sorted, trimCount(spec.n, trimPercent));
}

function trimmedMeanOfSorted(sorted: readonly number[], trim: number): number {
  const hi = sorted.length - trim;
  if (sorted[hi - 1] === Number.POSITIVE_INFINITY) return Number.POSITIVE_INFINITY;
  let sum = 0;
  for (let i = trim; i < hi; i++) sum += sorted[i]!;
  return sum / (hi - trim);
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (arr[mid]! < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// average for every window end, out[i] covers the n values ending at i
export function rollingSeries(values: readonly number[], spec: AvgSpec, trimPercent: number): Float64Array {
  const len = values.length;
  const out = new Float64Array(len).fill(Number.NaN);
  const n = spec.n;
  if (len < n) return out;

  if (spec.kind === "mo") {
    let sum = 0;
    let dnfs = 0;
    for (let i = 0; i < len; i++) {
      const v = values[i]!;
      if (v === Number.POSITIVE_INFINITY) dnfs++;
      else sum += v;
      if (i >= n) {
        const old = values[i - n]!;
        if (old === Number.POSITIVE_INFINITY) dnfs--;
        else sum -= old;
      }
      if (i >= n - 1) out[i] = dnfs > 0 ? Number.POSITIVE_INFINITY : sum / n;
    }
    return out;
  }

  const trim = trimCount(n, trimPercent);
  const sorted: number[] = [];
  for (let i = 0; i < len; i++) {
    const v = values[i]!;
    sorted.splice(lowerBound(sorted, v), 0, v);
    if (i >= n) {
      const old = values[i - n]!;
      sorted.splice(lowerBound(sorted, old), 1);
    }
    if (i >= n - 1) out[i] = trimmedMeanOfSorted(sorted, trim);
  }
  return out;
}

export interface AverageDetail {
  value: number;
  // solve indices dropped by trimming
  trimmed: Set<number>;
  start: number;
  end: number;
}

// which results in the window ending at end are trimmed
export function averageDetail(values: readonly number[], end: number, spec: AvgSpec, trimPercent: number): AverageDetail {
  const start = end - spec.n + 1;
  const window = values.slice(start, end + 1);
  const value = windowAverage(window, spec, trimPercent);
  const trimmed = new Set<number>();
  if (spec.kind === "ao") {
    const t = trimCount(spec.n, trimPercent);
    const order = window.map((v, i) => ({ v, i: start + i }));
    // earlier solve wins ties like cstimer
    order.sort((a, b) => a.v - b.v || a.i - b.i);
    for (let k = 0; k < t; k++) {
      trimmed.add(order[k]!.i);
      trimmed.add(order[order.length - 1 - k]!.i);
    }
  }
  return { value, trimmed, start, end };
}

export interface StatSummary {
  spec: AvgSpec;
  current: number;
  best: number;
  // end index of the best window or -1
  bestEnd: number;
}

export interface SessionStats {
  count: number;
  dnfCount: number;
  mean: number;
  stdev: number;
  best: number;
  bestIndex: number;
  worst: number;
  worstIndex: number;
  // sum of all non dnf final times
  totalTime: number;
  averages: StatSummary[];
  series: Map<string, Float64Array>;
  values: number[];
}

export function bestOf(series: Float64Array): { value: number; index: number } {
  let value = Number.NaN;
  let index = -1;
  for (let i = 0; i < series.length; i++) {
    const v = series[i]!;
    if (Number.isNaN(v)) continue;
    if (index === -1 || v < value) {
      value = v;
      index = i;
    }
  }
  return { value, index };
}

export function computeSessionStats(solves: readonly Solve[], statKeys: readonly string[], trimPercent: number): SessionStats {
  const values = toValues(solves);
  let sum = 0;
  let sumSq = 0;
  let valid = 0;
  let best = Number.NaN;
  let bestIndex = -1;
  let worst = Number.NaN;
  let worstIndex = -1;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]!;
    if (v === Number.POSITIVE_INFINITY) continue;
    valid++;
    sum += v;
    sumSq += v * v;
    if (bestIndex === -1 || v < best) {
      best = v;
      bestIndex = i;
    }
    if (worstIndex === -1 || v > worst) {
      worst = v;
      worstIndex = i;
    }
  }
  const mean = valid > 0 ? sum / valid : Number.NaN;
  const variance = valid > 1 ? (sumSq - (sum * sum) / valid) / (valid - 1) : Number.NaN;

  const series = new Map<string, Float64Array>();
  const averages: StatSummary[] = [];
  for (const key of statKeys) {
    const spec = parseStatKey(key);
    if (!spec || series.has(spec.key)) continue;
    const s = rollingSeries(values, spec, trimPercent);
    series.set(spec.key, s);
    const b = bestOf(s);
    averages.push({
      spec,
      current: s.length ? s[s.length - 1]! : Number.NaN,
      best: b.value,
      bestEnd: b.index,
    });
  }

  return {
    count: values.length,
    dnfCount: values.length - valid,
    mean,
    stdev: Number.isNaN(variance) ? Number.NaN : Math.sqrt(Math.max(0, variance)),
    best,
    bestIndex,
    worst,
    worstIndex,
    totalTime: sum,
    averages,
    series,
    values,
  };
}

// records the latest solve just set, only when there was something to beat
export function newRecords(stats: SessionStats): string[] {
  const last = stats.values.length - 1;
  if (last < 1) return [];
  const out: string[] = [];
  const v = stats.values[last]!;
  if (v !== Number.POSITIVE_INFINITY) {
    let prevBest = Number.POSITIVE_INFINITY;
    for (let i = 0; i < last; i++) prevBest = Math.min(prevBest, stats.values[i]!);
    if (v < prevBest && prevBest !== Number.POSITIVE_INFINITY) out.push("single");
  }
  for (const avg of stats.averages) {
    const s = stats.series.get(avg.spec.key)!;
    const cur = s[last]!;
    if (!Number.isFinite(cur)) continue;
    let prevBest = Number.POSITIVE_INFINITY;
    let hadPrev = false;
    for (let i = 0; i < last; i++) {
      const x = s[i]!;
      if (Number.isNaN(x)) continue;
      hadPrev = true;
      if (x < prevBest) prevBest = x;
    }
    if (hadPrev && cur < prevBest) out.push(avg.spec.key);
  }
  return out;
}

// null for dnf, undefined for not enough solves
export function statValue(v: number): number | null | undefined {
  if (Number.isNaN(v)) return undefined;
  if (v === Number.POSITIVE_INFINITY) return null;
  return v;
}

// phase durations from cumulative splits
export function phaseDurations(solve: Pick<Solve, "time" | "splits">): number[] {
  if (!solve.splits || solve.splits.length === 0) return [solve.time];
  const marks = [...solve.splits, solve.time];
  return marks.map((m, i) => m - (i === 0 ? 0 : marks[i - 1]!));
}
