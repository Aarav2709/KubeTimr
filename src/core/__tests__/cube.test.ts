import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { KPattern, KPuzzle } from "cubing/kpuzzle";
import { applyAlg, invertAlg, isSolved, isValidState, solvedState, toPatternData } from "../scramble/cube333";
import { crossDistance, solveCrossState } from "../scramble/cross";
import { randomSubsetState, SUBSETS } from "../scramble/subsets";

let kpuzzle: KPuzzle;
beforeAll(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
});

const RANDOM_ALG = "R U2 F' L D B2 R' U' F2 L2 D' B U R2 F D2 L' B' U2 R";

describe("cube333 model", () => {
  it("matches cubing.js for an arbitrary algorithm", () => {
    const mine = applyAlg(solvedState(), RANDOM_ALG);
    const theirs = kpuzzle.defaultPattern().applyAlg(RANDOM_ALG).patternData;
    expect(mine.ep).toEqual(theirs.EDGES!.pieces);
    expect(mine.eo).toEqual(theirs.EDGES!.orientation);
    expect(mine.cp).toEqual(theirs.CORNERS!.pieces);
    expect(mine.co).toEqual(theirs.CORNERS!.orientation);
  });

  it("inverts algorithms", () => {
    const s = applyAlg(applyAlg(solvedState(), RANDOM_ALG), invertAlg(RANDOM_ALG));
    expect(isSolved(s)).toBe(true);
  });
});

describe("cross solver", () => {
  it("solves the D cross optimally for a known case", () => {
    const s = applyAlg(solvedState(), "F R D");
    const sol = solveCrossState(s);
    expect(sol.split(" ").length).toBeLessThanOrEqual(3);
    const after = applyAlg(s, sol);
    for (const p of [4, 5, 6, 7]) {
      expect(after.ep[p]).toBe(p);
      expect(after.eo[p]).toBe(0);
    }
  });

  it("returns empty for a solved cross", () => {
    // u layer moves never touch the d cross
    expect(solveCrossState(applyAlg(solvedState(), "U2 U' U2"))).toBe("");
    expect(crossDistance(applyAlg(solvedState(), "U F2 U' L2"))).toBeGreaterThan(0);
    expect(crossDistance(solvedState())).toBe(0);
  });
});

describe("subset states", () => {
  const seededRand = (seed: number) => {
    let a = seed >>> 0;
    return (max: number) => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * max);
    };
  };

  for (const name of [...Object.keys(SUBSETS), "easycross"]) {
    it(`${name}: generates only valid states`, () => {
      const rand = seededRand(name.length * 7919);
      for (let i = 0; i < 200; i++) {
        const s = randomSubsetState(name, rand);
        expect(isValidState(s)).toBe(true);
      }
    });
  }

  it("respects subset constraints", () => {
    const rand = seededRand(42);
    for (let i = 0; i < 100; i++) {
      const pll = randomSubsetState("pll", rand);
      expect(pll.eo.every((o) => o === 0) && pll.co.every((o) => o === 0)).toBe(true);
      expect(pll.ep.slice(4)).toEqual([4, 5, 6, 7, 8, 9, 10, 11]);

      const zbll = randomSubsetState("zbll", rand);
      expect(zbll.eo.every((o) => o === 0)).toBe(true);

      const f2l = randomSubsetState("f2l", rand);
      expect(f2l.ep.slice(4, 8)).toEqual([4, 5, 6, 7]);

      const ez = randomSubsetState("easycross", rand);
      const d = crossDistance(ez);
      expect(d).toBeGreaterThanOrEqual(2);
      expect(d).toBeLessThanOrEqual(4);
    }
  });
});

// end to end with the real min2phase solver loaded straight from cubing.js
describe("subset scrambles via min2phase", () => {
  let solve333: ((p: KPattern) => Promise<{ toString(): string }>) | null = null;

  beforeAll(async () => {
    const chunks = resolve(__dirname, "../../../node_modules/cubing/dist/lib/cubing/chunks");
    const file = readdirSync(chunks).find(
      (f) => f.endsWith(".js") && readFileSync(join(chunks, f), "utf8").includes("async function solve333("),
    );
    if (!file) return;
    const mod = await import(pathToFileURL(join(chunks, file)).href);
    mod.setIsInsideWorker(true);
    solve333 = mod.solve333;
  });

  for (const name of ["pll", "zbll", "lsll", "easycross"]) {
    it(`${name}: scramble reproduces the generated state`, async () => {
      // skip if cubing.js moved its solver chunk
      if (!solve333) return;
      const state = randomSubsetState(name);
      const solution = (await solve333(new KPattern(kpuzzle, toPatternData(state)))).toString();
      const scramble = invertAlg(solution);
      const result = applyAlg(solvedState(), scramble);
      expect(result).toEqual(state);
    }, 30_000);
  }
});
