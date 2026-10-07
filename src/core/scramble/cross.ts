import { applyAlg, CubeState, solvedState } from "./cube333";

// bfs distance table over the four cross edges, used by easy cross

const MOVES: string[] = [];
for (const f of ["U", "D", "L", "R", "F", "B"]) for (const s of ["", "2", "'"]) MOVES.push(f + s);

const CROSS_PIECES = [4, 5, 6, 7];
const SIZE = 24 ** 4;

// where a single edge goes under each move
let edgeMove: Uint8Array[] | null = null;
let distTable: Uint8Array | null = null;

function buildEdgeMoves(): Uint8Array[] {
  const tables: Uint8Array[] = [];
  for (const m of MOVES) {
    const t = new Uint8Array(24);
    for (let pos = 0; pos < 12; pos++) {
      for (let ori = 0; ori < 2; ori++) {
        // track one marked edge through the move
        const s = solvedState();
        s.ep = s.ep.map(() => -1);
        s.ep[pos] = 99;
        s.eo = s.eo.map(() => 0);
        s.eo[pos] = ori;
        const after = applyAlg({ ...s, cp: [0, 1, 2, 3, 4, 5, 6, 7], co: new Array(8).fill(0) }, m);
        const np = after.ep.indexOf(99);
        t[pos * 2 + ori] = np * 2 + after.eo[np]!;
      }
    }
    tables.push(t);
  }
  return tables;
}

function encode(v: readonly number[]): number {
  return ((v[0]! * 24 + v[1]!) * 24 + v[2]!) * 24 + v[3]!;
}

function decode(idx: number, out: number[]): void {
  out[3] = idx % 24;
  idx = (idx / 24) | 0;
  out[2] = idx % 24;
  idx = (idx / 24) | 0;
  out[1] = idx % 24;
  out[0] = (idx / 24) | 0;
}

function ensureTables(): { em: Uint8Array[]; dist: Uint8Array } {
  if (edgeMove && distTable) return { em: edgeMove, dist: distTable };
  const em = buildEdgeMoves();
  const dist = new Uint8Array(SIZE).fill(255);
  const queue = new Int32Array(190_080);
  const start = encode(CROSS_PIECES.map((p) => p * 2));
  dist[start] = 0;
  queue[0] = start;
  let head = 0;
  let tail = 1;
  const cur = [0, 0, 0, 0];
  const next = [0, 0, 0, 0];
  while (head < tail) {
    const idx = queue[head++]!;
    const d = dist[idx]!;
    decode(idx, cur);
    for (let m = 0; m < em.length; m++) {
      const t = em[m]!;
      for (let k = 0; k < 4; k++) next[k] = t[cur[k]!]!;
      const ni = encode(next);
      if (dist[ni] === 255) {
        dist[ni] = d + 1;
        queue[tail++] = ni;
      }
    }
  }
  edgeMove = em;
  distTable = dist;
  return { em, dist };
}

function crossIndex(s: CubeState): number {
  const v = CROSS_PIECES.map((piece) => {
    const pos = s.ep.indexOf(piece);
    return pos * 2 + s.eo[pos]!;
  });
  return encode(v);
}

// optimal d cross for a state
export function solveCrossState(s: CubeState): string {
  const { em, dist } = ensureTables();
  let idx = crossIndex(s);
  const cur = [0, 0, 0, 0];
  const next = [0, 0, 0, 0];
  const out: string[] = [];
  let lastFace = "";
  while (dist[idx]! > 0) {
    decode(idx, cur);
    const d = dist[idx]!;
    let advanced = false;
    for (let m = 0; m < MOVES.length; m++) {
      const face = MOVES[m]![0]!;
      if (face === lastFace) continue;
      const t = em[m]!;
      for (let k = 0; k < 4; k++) next[k] = t[cur[k]!]!;
      const ni = encode(next);
      if (dist[ni] === d - 1) {
        out.push(MOVES[m]!);
        idx = ni;
        lastFace = face;
        advanced = true;
        break;
      }
    }
    if (!advanced) throw new Error("Cross table inconsistent");
  }
  return out.join(" ");
}

export function crossDistance(s: CubeState): number {
  return ensureTables().dist[crossIndex(s)]!;
}

// cross states at exactly distance d, used by easy cross
const byDistance = new Map<number, Int32Array>();
export function crossStatesAtDistance(d: number): Int32Array {
  const cached = byDistance.get(d);
  if (cached) return cached;
  const { dist } = ensureTables();
  const list: number[] = [];
  for (let i = 0; i < SIZE; i++) if (dist[i] === d) list.push(i);
  const arr = Int32Array.from(list);
  byDistance.set(d, arr);
  return arr;
}

export function decodeCross(idx: number): { pos: number; ori: number }[] {
  const v = [0, 0, 0, 0];
  decode(idx, v);
  return v.map((x) => ({ pos: x >> 1, ori: x & 1 }));
}
