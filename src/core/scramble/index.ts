import { getScrambleType } from "../events";
import { invertAlg, toPatternData } from "./cube333";
import { randomSubsetState } from "./subsets";

// scramble service, cubing.js loads lazily and one scramble per type is prefetched

async function cubingScramble(event: string): Promise<string> {
  const { randomScrambleForEvent } = await import("cubing/scramble");
  const alg = await randomScrambleForEvent(event);
  return alg.toString();
}

async function subsetScramble(subset: string): Promise<string> {
  const [{ cube3x3x3 }, { KPattern }, { experimentalSolve3x3x3IgnoringCenters }] = await Promise.all([
    import("cubing/puzzles"),
    import("cubing/kpuzzle"),
    import("cubing/search"),
  ]);
  const kpuzzle = await cube3x3x3.kpuzzle();
  const state = randomSubsetState(subset);
  const pattern = new KPattern(kpuzzle, toPatternData(state));
  const solution = await experimentalSolve3x3x3IgnoringCenters(pattern);
  return invertAlg(solution.toString());
}

const RELAY_LABELS: Record<string, string> = {
  "222": "2x2",
  "333": "3x3",
  "444": "4x4",
  "555": "5x5",
  "666": "6x6",
  "777": "7x7",
};

async function generate(typeId: string): Promise<string> {
  const type = getScrambleType(typeId);
  const src = type.source;
  switch (src.kind) {
    case "cubing":
      return cubingScramble(src.event);
    case "subset":
      return subsetScramble(src.subset);
    case "relay": {
      const parts = await Promise.all(src.parts.map((p) => cubingScramble(p)));
      return parts.map((s, i) => `${RELAY_LABELS[src.parts[i]!] ?? src.parts[i]}: ${s}`).join("\n");
    }
    case "none":
      return "";
  }
}

const prefetched = new Map<string, Promise<string>>();

function prefetch(typeId: string): void {
  if (prefetched.has(typeId)) return;
  const p = generate(typeId);
  // a failed prefetch is simply retried on demand
  p.catch(() => prefetched.delete(typeId));
  prefetched.set(typeId, p);
}

// returns the prefetched scramble if ready and queues the next one
export async function nextScramble(typeId: string): Promise<string> {
  const ready = prefetched.get(typeId);
  prefetched.delete(typeId);
  let scramble: string;
  try {
    scramble = await (ready ?? generate(typeId));
  } catch {
    scramble = await generate(typeId);
  }
  prefetch(typeId);
  return scramble;
}

export interface Solution {
  moves: string;
  // false means the solution is just the scramble played backwards
  solved: boolean;
}

const SOLVERS: Record<string, "333" | "222" | "pyraminx"> = { "3x3x3": "333", "2x2x2": "222", pyraminx: "pyraminx" };

// a move by move solution, from a real solver when cubing.js has one for the puzzle
export async function solutionFor(typeId: string, scramble: string): Promise<Solution> {
  const type = getScrambleType(typeId);
  const kind = type.puzzle ? SOLVERS[type.puzzle] : undefined;
  const clean = scramble.replace(/\s+/g, " ").trim();
  // wide moves and rotations shift centers, which the 3x3 solver ignores
  const faceTurnsOnly = !/[a-z]|[xyz]/.test(clean.replace(/[RLUDFB]/g, ""));
  if (kind && type.source.kind !== "relay" && (kind !== "333" || faceTurnsOnly)) {
    try {
      const [{ puzzles }, search] = await Promise.all([import("cubing/puzzles"), import("cubing/search")]);
      const kpuzzle = await puzzles[type.puzzle!]!.kpuzzle();
      const pattern = kpuzzle.defaultPattern().applyAlg(clean);
      const solve =
        kind === "333" ? search.experimentalSolve3x3x3IgnoringCenters : kind === "222" ? search.experimentalSolve2x2x2 : search.solvePyraminx;
      const alg = await solve(pattern);
      if (pattern.applyAlg(alg).isIdentical(kpuzzle.defaultPattern())) return { moves: alg.toString(), solved: true };
    } catch (err) {
      console.warn("solver failed, using the reversed scramble", err);
    }
  }
  const { Alg } = await import("cubing/alg");
  return { moves: Alg.fromString(clean).invert().toString(), solved: false };
}
