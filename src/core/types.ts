// penalty codes match cstimer: 0 ok, 2000 plus two, -1 dnf
export type Penalty = 0 | 2000 | -1;
export const OK: Penalty = 0;
export const PLUS2: Penalty = 2000;
export const DNF: Penalty = -1;

export interface Solve {
  id: string;
  // the cube profile this solve belongs to, a scramble type id like "333" or "333-pll"
  scrambleType: string;
  // raw time in ms before penalties
  time: number;
  penalty: Penalty;
  scramble: string;
  // epoch ms
  date: number;
  // cumulative ms at the end of each phase except the last
  splits?: number[];
  inspection?: number;
}

export type TimerInput = "keyboard" | "typing";
export type TimerUpdate = "realtime" | "tenths" | "seconds" | "hidden";
export type InspectionAlert = "off" | "voice" | "beep";
export type TimerFont = "mono" | "sans" | "digital";

export interface Settings {
  inputMethod: TimerInput;
  inspection: boolean;
  inspectionAlert: InspectionAlert;
  // ms to hold before the timer turns green
  holdTime: number;
  timerUpdate: TimerUpdate;
  showMs: boolean;
  // 1 means multi phase is off
  phases: number;
  phaseNames: string[];
  timerFont: TimerFont;
  timerScale: number;
}

export interface AppData {
  solves: Solve[];
  settings: Settings;
  profile: string;
}

export const DEFAULT_SETTINGS: Settings = {
  inputMethod: "keyboard",
  inspection: false,
  inspectionAlert: "voice",
  holdTime: 300,
  timerUpdate: "realtime",
  showMs: false,
  phases: 1,
  phaseNames: [],
  timerFont: "sans",
  timerScale: 1,
};

// averages shown on the stats page, trimmed 5% per side like wca
export const STAT_KEYS = ["mo3", "ao5", "ao12", "ao50", "ao100"];
export const TRIM_PERCENT = 5;

// final time with penalty, null for dnf
export function finalTime(s: Pick<Solve, "time" | "penalty">): number | null {
  if (s.penalty === DNF) return null;
  return s.time + s.penalty;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}
