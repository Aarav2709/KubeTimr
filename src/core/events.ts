// every scramble type is also a cube profile, cstimer ids map imports and exports

export type ScrambleSource =
  // random state scramble from cubing.js
  | { kind: "cubing"; event: string }
  // 3x3 training subset solved with min2phase
  | { kind: "subset"; subset: string }
  // several scrambles back to back
  | { kind: "relay"; parts: string[] }
  | { kind: "none" };

export interface ScrambleType {
  id: string;
  name: string;
  short: string;
  group: string;
  source: ScrambleSource;
  // cubing.js puzzle id for the preview
  puzzle?: string;
  // cubing.js stickering for training cases
  stickering?: string;
  cstimer: string[];
  // wca rules give this event inspection
  wcaInspection?: boolean;
}

const cubing = (event: string) => ({ kind: "cubing", event }) as const;
const subset = (s: string) => ({ kind: "subset", subset: s }) as const;

export const SCRAMBLE_TYPES: ScrambleType[] = [
  // wca
  { id: "333", name: "3x3", short: "3x3", group: "WCA", source: cubing("333"), puzzle: "3x3x3", cstimer: ["333"], wcaInspection: true },
  { id: "222", name: "2x2", short: "2x2", group: "WCA", source: cubing("222"), puzzle: "2x2x2", cstimer: ["222so", "2223", "222o"], wcaInspection: true },
  { id: "444", name: "4x4", short: "4x4", group: "WCA", source: cubing("444"), puzzle: "4x4x4", cstimer: ["444wca", "444"], wcaInspection: true },
  { id: "555", name: "5x5", short: "5x5", group: "WCA", source: cubing("555"), puzzle: "5x5x5", cstimer: ["555wca", "555"], wcaInspection: true },
  { id: "666", name: "6x6", short: "6x6", group: "WCA", source: cubing("666"), puzzle: "6x6x6", cstimer: ["666wca", "666si", "666"], wcaInspection: true },
  { id: "777", name: "7x7", short: "7x7", group: "WCA", source: cubing("777"), puzzle: "7x7x7", cstimer: ["777wca", "777si", "777"], wcaInspection: true },
  { id: "333bf", name: "3x3 Blindfolded", short: "3BLD", group: "WCA", source: cubing("333bf"), puzzle: "3x3x3", cstimer: ["333ni"] },
  { id: "333fm", name: "3x3 Fewest Moves", short: "FMC", group: "WCA", source: cubing("333fm"), puzzle: "3x3x3", cstimer: ["333fm"] },
  { id: "333oh", name: "3x3 One Handed", short: "OH", group: "WCA", source: cubing("333oh"), puzzle: "3x3x3", cstimer: ["333oh"], wcaInspection: true },
  { id: "clock", name: "Clock", short: "Clock", group: "WCA", source: cubing("clock"), puzzle: "clock", cstimer: ["clkwca", "clk"], wcaInspection: true },
  { id: "minx", name: "Megaminx", short: "Mega", group: "WCA", source: cubing("minx"), puzzle: "megaminx", cstimer: ["mgmp", "minx"], wcaInspection: true },
  { id: "pyram", name: "Pyraminx", short: "Pyra", group: "WCA", source: cubing("pyram"), puzzle: "pyraminx", cstimer: ["pyrso", "pyrm"], wcaInspection: true },
  { id: "skewb", name: "Skewb", short: "Skewb", group: "WCA", source: cubing("skewb"), puzzle: "skewb", cstimer: ["skbso", "skb"], wcaInspection: true },
  { id: "sq1", name: "Square-1", short: "SQ1", group: "WCA", source: cubing("sq1"), puzzle: "square1", cstimer: ["sqrs", "sq1h"], wcaInspection: true },
  { id: "444bf", name: "4x4 Blindfolded", short: "4BLD", group: "WCA", source: cubing("444bf"), puzzle: "4x4x4", cstimer: ["444bld"] },
  { id: "555bf", name: "5x5 Blindfolded", short: "5BLD", group: "WCA", source: cubing("555bf"), puzzle: "5x5x5", cstimer: ["555bld"] },
  { id: "333mbf", name: "3x3 Multi Blind", short: "MBLD", group: "WCA", source: cubing("333bf"), puzzle: "3x3x3", cstimer: ["r3ni"] },

  // 3x3 training
  { id: "333-ll", name: "Last Layer", short: "LL", group: "Training", source: subset("ll"), puzzle: "3x3x3", stickering: "LL", cstimer: ["ll"] },
  { id: "333-pll", name: "PLL", short: "PLL", group: "Training", source: subset("pll"), puzzle: "3x3x3", stickering: "PLL", cstimer: ["pll"] },
  { id: "333-oll", name: "OLL", short: "OLL", group: "Training", source: subset("oll"), puzzle: "3x3x3", stickering: "OLL", cstimer: ["oll"] },
  { id: "333-zbll", name: "ZBLL", short: "ZBLL", group: "Training", source: subset("zbll"), puzzle: "3x3x3", stickering: "ZBLL", cstimer: ["zbll"] },
  { id: "333-coll", name: "COLL", short: "COLL", group: "Training", source: subset("coll"), puzzle: "3x3x3", stickering: "COLL", cstimer: ["coll"] },
  { id: "333-2gll", name: "2GLL", short: "2GLL", group: "Training", source: subset("2gll"), puzzle: "3x3x3", stickering: "ZBLL", cstimer: ["2gll"] },
  { id: "333-ell", name: "ELL", short: "ELL", group: "Training", source: subset("ell"), puzzle: "3x3x3", stickering: "ELL", cstimer: ["ell"] },
  { id: "333-cll", name: "CLL", short: "CLL", group: "Training", source: subset("cll"), puzzle: "3x3x3", stickering: "CLL", cstimer: ["cll"] },
  { id: "333-lsll", name: "Last Slot + LL", short: "LSLL", group: "Training", source: subset("lsll"), puzzle: "3x3x3", stickering: "LS", cstimer: ["lsll2", "lsll"] },
  { id: "333-f2l", name: "F2L", short: "F2L", group: "Training", source: subset("f2l"), puzzle: "3x3x3", stickering: "F2L", cstimer: ["f2l"] },
  { id: "333-easycross", name: "Easy Cross", short: "EzCross", group: "Training", source: subset("easycross"), puzzle: "3x3x3", stickering: "Cross", cstimer: ["easyc"] },
  { id: "333-edges", name: "Edges Only", short: "Edges", group: "Training", source: subset("edges"), puzzle: "3x3x3", cstimer: ["edges"] },
  { id: "333-corners", name: "Corners Only", short: "Corners", group: "Training", source: subset("corners"), puzzle: "3x3x3", cstimer: ["corners"] },
  { id: "333-cmll", name: "Roux CMLL", short: "CMLL", group: "Training", source: subset("cmll"), puzzle: "3x3x3", stickering: "CMLL", cstimer: ["cmll"] },
  { id: "333-lse", name: "Roux L6E", short: "L6E", group: "Training", source: subset("lse"), puzzle: "3x3x3", stickering: "L6E", cstimer: ["lse"] },

  // other puzzles
  { id: "fto", name: "FTO", short: "FTO", group: "Other", source: cubing("fto"), puzzle: "fto", cstimer: ["ftoso", "fto"] },
  { id: "master_tetraminx", name: "Master Tetraminx", short: "MTetra", group: "Other", source: cubing("master_tetraminx"), puzzle: "master_tetraminx", cstimer: ["mtetram"] },
  { id: "kilominx", name: "Kilominx", short: "Kilo", group: "Other", source: cubing("kilominx"), puzzle: "kilominx", cstimer: ["klmso", "klmp"] },
  { id: "redi_cube", name: "Redi Cube", short: "Redi", group: "Other", source: cubing("redi_cube"), puzzle: "redi_cube", cstimer: ["rediso", "redi"] },
  { id: "baby_fto", name: "Baby FTO", short: "BabyFTO", group: "Other", source: cubing("baby_fto"), puzzle: "baby_fto", cstimer: ["bfto"] },

  // relays
  { id: "relay-234", name: "2x2 to 4x4 Relay", short: "2-4", group: "Other", source: { kind: "relay", parts: ["222", "333", "444"] }, cstimer: ["r234w", "r234"] },
  { id: "relay-2345", name: "2x2 to 5x5 Relay", short: "2-5", group: "Other", source: { kind: "relay", parts: ["222", "333", "444", "555"] }, cstimer: ["r2345w", "r2345"] },
  { id: "relay-2to7", name: "2x2 to 7x7 Relay", short: "2-7", group: "Other", source: { kind: "relay", parts: ["222", "333", "444", "555", "666", "777"] }, cstimer: ["r234567w", "r234567"] },
  { id: "relay-333x3", name: "3x3 Relay of 3", short: "3x3 x3", group: "Other", source: { kind: "relay", parts: ["333", "333", "333"] }, cstimer: ["r3"] },

  { id: "none", name: "No Scramble", short: "None", group: "Other", source: { kind: "none" }, cstimer: ["blank"] },
];

const BY_ID = new Map(SCRAMBLE_TYPES.map((t) => [t.id, t]));
const BY_CSTIMER = new Map<string, ScrambleType>();
for (const t of SCRAMBLE_TYPES) {
  for (const c of t.cstimer) if (!BY_CSTIMER.has(c)) BY_CSTIMER.set(c, t);
}

export const SCRAMBLE_GROUPS = [...new Set(SCRAMBLE_TYPES.map((t) => t.group))];

export function getScrambleType(id: string): ScrambleType {
  return BY_ID.get(id) ?? BY_ID.get("333")!;
}

export function scrambleTypeFromCstimer(scrType: string | undefined): ScrambleType {
  if (!scrType) return BY_ID.get("333")!;
  return BY_CSTIMER.get(scrType) ?? BY_ID.get("333")!;
}

// rough guess of the puzzle from a scramble string
export function guessScrambleType(scramble: string): string {
  const s = scramble.trim();
  if (!s) return "333";
  if (/UR\d[+-]|ALL\d|y2/.test(s) && /\d[+-]/.test(s)) return "clock";
  if (/\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(s)) return "sq1";
  if (/(R|D)(\+\+|--)/.test(s)) return "minx";
  if (/\b[lrbu]'?\b/.test(s) && /^[RLUBrlub' \n]+$/.test(s)) return "pyram";
  if (/\b(3[RUFLDB]w|[RUFLDB]w)/.test(s)) {
    if (/\b3[RUFLDB]w/.test(s)) return s.split(/\s+/).length > 90 ? "777" : "666";
    const n = s.split(/\s+/).length;
    return n > 52 ? "555" : "444";
  }
  const moves = s.split(/\s+/);
  if (moves.every((m) => /^[RUF][2']?$/.test(m))) return "222";
  return "333";
}
