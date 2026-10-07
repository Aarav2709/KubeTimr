import { applyMove, CubeState, permutationParity, solvedState } from "./cube333";
import { crossStatesAtDistance, decodeCross } from "./cross";

// random state 3x3 training subsets, the caller solves and inverts them into scrambles

export type RandInt = (maxExclusive: number) => number;

export const cryptoRandInt: RandInt = (max) => {
  if (max <= 1) return 0;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  let x: number;
  do {
    crypto.getRandomValues(buf);
    x = buf[0]!;
  } while (x >= limit);
  return x % max;
};

interface SubsetSpec {
  // positions whose pieces get shuffled
  edgePerm: number[];
  cornerPerm: number[];
  // positions whose orientation is random
  edgeOri: number[];
  cornerOri: number[];
  // random u turn afterwards
  auf?: boolean;
  // rejects states like oll skips
  accept?: (s: CubeState) => boolean;
}

const U_EDGES = [0, 1, 2, 3];
const U_CORNERS = [0, 1, 2, 3];
const ALL_EDGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const ALL_CORNERS = [0, 1, 2, 3, 4, 5, 6, 7];
const L6E_EDGES = [0, 1, 2, 3, 4, 6];

const notSolvedLL = (s: CubeState) =>
  !(U_EDGES.every((i) => s.ep[i] === i && s.eo[i] === 0) && U_CORNERS.every((i) => s.cp[i] === i && s.co[i] === 0));

export const SUBSETS: Record<string, SubsetSpec> = {
  ll: { edgePerm: U_EDGES, cornerPerm: U_CORNERS, edgeOri: U_EDGES, cornerOri: U_CORNERS, accept: notSolvedLL },
  pll: { edgePerm: U_EDGES, cornerPerm: U_CORNERS, edgeOri: [], cornerOri: [], auf: true, accept: notSolvedLL },
  oll: {
    edgePerm: U_EDGES,
    cornerPerm: U_CORNERS,
    edgeOri: U_EDGES,
    cornerOri: U_CORNERS,
    accept: (s) => !(U_EDGES.every((i) => s.eo[i] === 0) && U_CORNERS.every((i) => s.co[i] === 0)),
  },
  zbll: {
    edgePerm: U_EDGES,
    cornerPerm: U_CORNERS,
    edgeOri: [],
    cornerOri: U_CORNERS,
    accept: (s) => U_CORNERS.some((i) => s.co[i] !== 0),
  },
  coll: {
    edgePerm: U_EDGES,
    cornerPerm: U_CORNERS,
    edgeOri: [],
    cornerOri: U_CORNERS,
    accept: (s) => U_CORNERS.some((i) => s.co[i] !== 0),
  },
  "2gll": { edgePerm: U_EDGES, cornerPerm: [], edgeOri: [], cornerOri: U_CORNERS, auf: true, accept: notSolvedLL },
  ell: { edgePerm: U_EDGES, cornerPerm: [], edgeOri: U_EDGES, cornerOri: [], auf: true, accept: notSolvedLL },
  cll: { edgePerm: [], cornerPerm: U_CORNERS, edgeOri: [], cornerOri: U_CORNERS, auf: true, accept: notSolvedLL },
  lsll: { edgePerm: [...U_EDGES, 8], cornerPerm: [...U_CORNERS, 4], edgeOri: [...U_EDGES, 8], cornerOri: [...U_CORNERS, 4] },
  f2l: {
    edgePerm: [0, 1, 2, 3, 8, 9, 10, 11],
    cornerPerm: ALL_CORNERS,
    edgeOri: [0, 1, 2, 3, 8, 9, 10, 11],
    cornerOri: ALL_CORNERS,
  },
  edges: { edgePerm: ALL_EDGES, cornerPerm: [], edgeOri: ALL_EDGES, cornerOri: [] },
  corners: { edgePerm: [], cornerPerm: ALL_CORNERS, edgeOri: [], cornerOri: ALL_CORNERS },
  cmll: { edgePerm: L6E_EDGES, cornerPerm: U_CORNERS, edgeOri: L6E_EDGES, cornerOri: U_CORNERS },
  lse: { edgePerm: L6E_EDGES, cornerPerm: [], edgeOri: L6E_EDGES, cornerOri: [] },
};

function shuffleInto(target: number[], positions: readonly number[], rand: RandInt): void {
  const pieces = positions.map((p) => target[p]!);
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [pieces[i], pieces[j]] = [pieces[j]!, pieces[i]!];
  }
  positions.forEach((p, i) => (target[p] = pieces[i]!));
}

function randomizeOrientation(ori: number[], positions: readonly number[], mod: number, rand: RandInt): void {
  if (positions.length === 0) return;
  for (const p of positions) ori[p] = rand(mod);
  const total = ori.reduce((a, b) => a + b, 0);
  const last = positions[positions.length - 1]!;
  ori[last] = (((ori[last]! - total) % mod) + mod) % mod;
}

// swaps two pieces to flip parity
function swapTwo(perm: number[], positions: readonly number[]): void {
  const a = positions[0]!;
  const b = positions[1]!;
  [perm[a], perm[b]] = [perm[b]!, perm[a]!];
}

export function randomSubsetState(name: string, rand: RandInt = cryptoRandInt): CubeState {
  if (name === "easycross") return randomEasyCrossState(rand);
  const spec = SUBSETS[name];
  if (!spec) throw new Error(`Unknown subset: ${name}`);

  for (let attempt = 0; attempt < 1000; attempt++) {
    let s = solvedState();
    shuffleInto(s.ep, spec.edgePerm, rand);
    shuffleInto(s.cp, spec.cornerPerm, rand);
    if (permutationParity(s.ep) !== permutationParity(s.cp)) {
      // fix parity in whichever orbit can move
      if (spec.edgePerm.length >= 2) swapTwo(s.ep, spec.edgePerm);
      else if (spec.cornerPerm.length >= 2) swapTwo(s.cp, spec.cornerPerm);
    }
    randomizeOrientation(s.eo, spec.edgeOri, 2, rand);
    randomizeOrientation(s.co, spec.cornerOri, 3, rand);
    if (spec.auf) {
      const k = rand(4);
      for (let i = 0; i < k; i++) s = applyMove(s, "U");
    }
    if (!spec.accept || spec.accept(s)) return s;
  }
  throw new Error(`Could not generate subset ${name}`);
}

// random cube whose cross takes 2 to 4 moves
function randomEasyCrossState(rand: RandInt): CubeState {
  const weights = [2, 3, 3, 4, 4, 4];
  const d = weights[rand(weights.length)]!;
  const candidates = crossStatesAtDistance(d);
  const cross = decodeCross(candidates[rand(candidates.length)]!);

  const s = solvedState();
  const ep = new Array<number>(12).fill(-1);
  const eo = new Array<number>(12).fill(0);
  cross.forEach(({ pos, ori }, k) => {
    ep[pos] = 4 + k;
    eo[pos] = ori;
  });
  const freePositions = ep.map((p, i) => (p === -1 ? i : -1)).filter((i) => i >= 0);
  const others = [0, 1, 2, 3, 8, 9, 10, 11];
  freePositions.forEach((pos, i) => (ep[pos] = others[i]!));
  shuffleInto(ep, freePositions, rand);
  // random flips with one free edge fixing the total
  for (const p of freePositions) eo[p] = rand(2);
  const total = eo.reduce((a, b) => a + b, 0);
  const lastFree = freePositions[freePositions.length - 1]!;
  if (total % 2 !== 0) eo[lastFree] = 1 - eo[lastFree]!;

  s.ep = ep;
  s.eo = eo;
  shuffleInto(s.cp, ALL_CORNERS, rand);
  if (permutationParity(s.ep) !== permutationParity(s.cp)) swapTwo(s.cp, ALL_CORNERS);
  randomizeOrientation(s.co, ALL_CORNERS, 3, rand);
  return s;
}
