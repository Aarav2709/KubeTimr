// 3x3 cubie model in cubing.js piece order, edges uf ur ub ul df dr db dl fr fl br bl, corners ufr urb ubl ulf dfr dlf dlb drb

export interface CubeState {
  ep: number[];
  eo: number[];
  cp: number[];
  co: number[];
}

interface MoveDef {
  ep: number[];
  eo: number[];
  cp: number[];
  co: number[];
}

// quarter turn tables taken from cubing.js
const FACE_MOVES: Record<string, MoveDef> = {
  U: { ep: [1, 2, 3, 0, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cp: [1, 2, 3, 0, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0] },
  D: { ep: [0, 1, 2, 3, 7, 4, 5, 6, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0] },
  L: { ep: [0, 1, 2, 11, 4, 5, 6, 9, 8, 3, 10, 7], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cp: [0, 1, 6, 2, 4, 3, 5, 7], co: [0, 0, 2, 1, 0, 2, 1, 0] },
  R: { ep: [0, 8, 2, 3, 4, 10, 6, 7, 5, 9, 1, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], cp: [4, 0, 2, 3, 7, 5, 6, 1], co: [2, 1, 0, 0, 1, 0, 0, 2] },
  F: { ep: [9, 1, 2, 3, 8, 5, 6, 7, 0, 4, 10, 11], eo: [1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0], cp: [3, 1, 2, 5, 0, 4, 6, 7], co: [1, 0, 0, 2, 2, 1, 0, 0] },
  B: { ep: [0, 1, 10, 3, 4, 5, 11, 7, 8, 9, 6, 2], eo: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1], cp: [0, 7, 1, 3, 4, 5, 2, 6], co: [0, 2, 1, 0, 0, 0, 2, 1] },
};

export const FACES = ["U", "D", "L", "R", "F", "B"] as const;
export type Face = (typeof FACES)[number];

export function solvedState(): CubeState {
  return {
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    eo: new Array(12).fill(0),
    cp: [0, 1, 2, 3, 4, 5, 6, 7],
    co: new Array(8).fill(0),
  };
}

function applyQuarter(s: CubeState, m: MoveDef): CubeState {
  return {
    ep: m.ep.map((p) => s.ep[p]!),
    eo: m.ep.map((p, i) => (s.eo[p]! + m.eo[i]!) % 2),
    cp: m.cp.map((p) => s.cp[p]!),
    co: m.cp.map((p, i) => (s.co[p]! + m.co[i]!) % 3),
  };
}

// applies a face move like r, u2 or f prime
export function applyMove(s: CubeState, move: string): CubeState {
  const face = move[0]!;
  const def = FACE_MOVES[face];
  if (!def) throw new Error(`Unsupported move: ${move}`);
  const suffix = move.slice(1);
  const turns = suffix === "2" ? 2 : suffix === "'" || suffix === "3" ? 3 : 1;
  let out = s;
  for (let i = 0; i < turns; i++) out = applyQuarter(out, def);
  return out;
}

export function applyAlg(s: CubeState, alg: string): CubeState {
  return alg
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc, m) => applyMove(acc, m), s);
}

export function isSolved(s: CubeState): boolean {
  return (
    s.ep.every((p, i) => p === i) &&
    s.cp.every((p, i) => p === i) &&
    s.eo.every((o) => o === 0) &&
    s.co.every((o) => o === 0)
  );
}

export function permutationParity(perm: readonly number[]): number {
  const seen = new Array(perm.length).fill(false);
  let parity = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    let len = 0;
    for (let j = i; !seen[j]; j = perm[j]!) {
      seen[j] = true;
      len++;
    }
    parity ^= (len - 1) & 1;
  }
  return parity;
}

// reachable from solved by face turns
export function isValidState(s: CubeState): boolean {
  const isPerm = (p: number[], n: number) => p.length === n && new Set(p).size === n && p.every((x) => x >= 0 && x < n);
  if (!isPerm(s.ep, 12) || !isPerm(s.cp, 8)) return false;
  if (s.eo.reduce((a, b) => a + b, 0) % 2 !== 0) return false;
  if (s.co.reduce((a, b) => a + b, 0) % 3 !== 0) return false;
  return permutationParity(s.ep) === permutationParity(s.cp);
}

// cubing.js pattern data with solved centers
export function toPatternData(s: CubeState) {
  return {
    EDGES: { pieces: [...s.ep], orientation: [...s.eo] },
    CORNERS: { pieces: [...s.cp], orientation: [...s.co] },
    CENTERS: { pieces: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0], orientationMod: [1, 1, 1, 1, 1, 1] },
  };
}

// inverts a face turn algorithm
export function invertAlg(alg: string): string {
  return alg
    .split(/\s+/)
    .filter(Boolean)
    .reverse()
    .map((m) => (m.endsWith("2") ? m : m.endsWith("'") ? m.slice(0, -1) : `${m}'`))
    .join(" ");
}
