import { describe, expect, it } from "vitest";
import {
  averageDetail,
  computeSessionStats,
  newRecords,
  parseStatKey,
  phaseDurations,
  rollingSeries,
  trimCount,
  windowAverage,
} from "../stats";
import { Penalty, Solve } from "../types";

const INF = Number.POSITIVE_INFINITY;
const ao = (n: number) => parseStatKey(`ao${n}`)!;
const mo = (n: number) => parseStatKey(`mo${n}`)!;

function mk(times: (number | "DNF" | `${number}+`)[]): Solve[] {
  return times.map((t, i) => {
    let time: number;
    let penalty: Penalty = 0;
    if (t === "DNF") {
      time = 10000;
      penalty = -1;
    } else if (typeof t === "string") {
      time = parseFloat(t);
      penalty = 2000;
    } else time = t;
    return { id: String(i), scrambleType: "333", time, penalty, scramble: "", date: i };
  });
}

describe("trimCount", () => {
  it("uses ceil(5%) per side like csTimer/WCA", () => {
    expect(trimCount(5, 5)).toBe(1);
    expect(trimCount(12, 5)).toBe(1);
    expect(trimCount(50, 5)).toBe(3);
    expect(trimCount(100, 5)).toBe(5);
    expect(trimCount(1000, 5)).toBe(50);
    expect(trimCount(3, 5)).toBe(1);
  });
});

describe("windowAverage", () => {
  it("computes a WCA ao5", () => {
    expect(windowAverage([10, 12, 11, 15, 9], ao(5), 5)).toBeCloseTo(11, 9);
  });
  it("one DNF in ao5 is trimmed, two is DNF", () => {
    expect(windowAverage([10, INF, 11, 12, 9], ao(5), 5)).toBeCloseTo(11, 9);
    expect(windowAverage([10, INF, 11, INF, 9], ao(5), 5)).toBe(INF);
  });
  it("mo3 is DNF with any DNF", () => {
    expect(windowAverage([10, 11, 12], mo(3), 5)).toBe(11);
    expect(windowAverage([10, INF, 12], mo(3), 5)).toBe(INF);
  });
  it("ao100 tolerates 5 DNFs but not 6", () => {
    const base = Array.from({ length: 100 }, (_, i) => 1000 + i);
    const five = [...base];
    for (let i = 0; i < 5; i++) five[i * 10] = INF;
    expect(Number.isFinite(windowAverage(five, ao(100), 5))).toBe(true);
    const six = [...five];
    six[95] = INF;
    expect(windowAverage(six, ao(100), 5)).toBe(INF);
  });
});

describe("rollingSeries", () => {
  it("matches brute force for random data", () => {
    const vals = Array.from({ length: 300 }, (_, i) => (i % 17 === 0 ? INF : 5000 + ((i * 7919) % 3000)));
    for (const spec of [ao(5), ao(12), ao(50), ao(100), mo(3)]) {
      const s = rollingSeries(vals, spec, 5);
      for (let i = 0; i < vals.length; i++) {
        if (i < spec.n - 1) {
          expect(Number.isNaN(s[i]!)).toBe(true);
          continue;
        }
        const brute = windowAverage(vals.slice(i - spec.n + 1, i + 1), spec, 5);
        if (brute === INF) expect(s[i]).toBe(INF);
        else expect(s[i]).toBeCloseTo(brute, 6);
      }
    }
  });
});

describe("averageDetail", () => {
  it("marks best and worst as trimmed", () => {
    const vals = [10, 12, 11, 15, 9];
    const d = averageDetail(vals, 4, ao(5), 5);
    expect([...d.trimmed].sort()).toEqual([3, 4]);
    expect(d.value).toBeCloseTo(11, 9);
  });
});

describe("computeSessionStats", () => {
  it("computes summary values", () => {
    const st = computeSessionStats(mk([10000, 12000, "DNF", "9000+", 8000, 15000]), ["mo3", "ao5"], 5);
    expect(st.count).toBe(6);
    expect(st.dnfCount).toBe(1);
    expect(st.best).toBe(8000);
    expect(st.worst).toBe(15000);
    expect(st.mean).toBeCloseTo((10000 + 12000 + 11000 + 8000 + 15000) / 5, 6);
    const ao5 = st.averages.find((a) => a.spec.key === "ao5")!;
    // windows give 11 and 12.667
    expect(ao5.best).toBeCloseTo(11000, 6);
    expect(ao5.current).toBeCloseTo((12000 + 11000 + 15000) / 3, 6);
    expect(st.averages.find((a) => a.spec.key === "mo3")!.current).toBeCloseTo((11000 + 8000 + 15000) / 3, 6);
  });
});

describe("newRecords", () => {
  it("detects a new single and ao5", () => {
    // last ao5 is 11.33 which beats 12.00
    const st = computeSessionStats(mk([12000, 12000, 12000, 12000, 12000, 10000, 9000]), ["ao5"], 5);
    expect(newRecords(st)).toEqual(["single", "ao5"]);
  });
  it("does not flag the very first average", () => {
    const st = computeSessionStats(mk([10000, 10000, 10000, 10000, 9000]), ["ao5"], 5);
    expect(newRecords(st)).toEqual(["single"]);
  });
});

describe("phaseDurations", () => {
  it("splits cumulative marks", () => {
    expect(phaseDurations({ time: 10000, splits: [2000, 7000, 8500] })).toEqual([2000, 5000, 1500, 1500]);
    expect(phaseDurations({ time: 10000 })).toEqual([10000]);
  });
});
