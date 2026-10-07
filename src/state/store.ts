import { useSyncExternalStore } from "react";
import { ImportResult, solveKey } from "../core/cstimer";
import { getScrambleType } from "../core/events";
import { openStorage, Storage } from "../core/persistence";
import { nextScramble } from "../core/scramble";
import { TimerPhase, TimerResult } from "../core/timer";
import { DEFAULT_SETTINGS, newId, Penalty, Settings, Solve } from "../core/types";

// tiny external store so the running timer never re renders the rest of the app

export interface Toast {
  id: number;
  message: string;
  // green tick for done, yellow sign for anything to watch out for
  tone: "success" | "warning";
  action?: { label: string; run: () => void };
}

export interface ScrambleState {
  text: string;
  type: string;
  loading: boolean;
  error: string | null;
}

export type Modal =
  | { kind: "solve"; id: string }
  | { kind: "average"; key: string; end: number }
  | { kind: "settings" }
  | { kind: "shortcuts" }
  | { kind: "profiles" }
  | { kind: "guide" };

export type View = "timer" | "stats";

export interface State {
  ready: boolean;
  persistent: boolean;
  // every solve across all profiles, oldest first
  solves: Solve[];
  settings: Settings;
  // active cube profile, a scramble type id
  profile: string;
  view: View;
  scramble: ScrambleState;
  scrambleHistory: string[];
  timerPhase: TimerPhase;
  toasts: Toast[];
  selectedSolveId: string | null;
  modal: Modal | null;
}

let state: State = {
  ready: false,
  persistent: true,
  solves: [],
  settings: DEFAULT_SETTINGS,
  profile: "333",
  view: "timer",
  scramble: { text: "", type: "333", loading: true, error: null },
  scrambleHistory: [],
  timerPhase: "idle",
  toasts: [],
  selectedSolveId: null,
  modal: null,
};

const listeners = new Set<() => void>();
let storage: Storage | null = null;

export function getState(): State {
  return state;
}

function setState(patch: Partial<State> | ((s: State) => Partial<State>)): void {
  const p = typeof patch === "function" ? patch(state) : patch;
  state = { ...state, ...p };
  for (const l of listeners) l();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

function persist(op: (s: Storage) => Promise<void>): void {
  if (!storage) return;
  op(storage).catch((err) => {
    console.error("save failed", err);
    toast("Couldn't save to browser storage.", { tone: "warning" });
  });
}

// derived data, memoized so selectors keep a stable identity

let memoSolves: Solve[] | null = null;
let memoProfile = "";
let memoProfileSolves: Solve[] = [];

export function selectProfileSolves(s: State): Solve[] {
  if (s.solves !== memoSolves || s.profile !== memoProfile) {
    memoSolves = s.solves;
    memoProfile = s.profile;
    memoProfileSolves = s.solves.filter((x) => x.scrambleType === s.profile);
  }
  return memoProfileSolves;
}

export function useProfileSolves(): Solve[] {
  return useStore(selectProfileSolves);
}

export interface ProfileSummary {
  count: number;
  last: number;
}

let summarySolves: Solve[] | null = null;
let summaryResult = new Map<string, ProfileSummary>();

// solve count and last use for every profile that has solves
export function selectProfileSummaries(s: State): Map<string, ProfileSummary> {
  if (s.solves === summarySolves) return summaryResult;
  const m = new Map<string, ProfileSummary>();
  for (const x of s.solves) {
    const cur = m.get(x.scrambleType) ?? { count: 0, last: 0 };
    cur.count++;
    if (x.date > cur.last) cur.last = x.date;
    m.set(x.scrambleType, cur);
  }
  summarySolves = s.solves;
  summaryResult = m;
  return m;
}

// toasts

let toastSeq = 0;
export function toast(message: string, opts: Partial<Omit<Toast, "id" | "message">> & { duration?: number } = {}): void {
  const id = ++toastSeq;
  const { duration = 3000, tone = "success", action } = opts;
  setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, message, tone, action }] }));
  setTimeout(() => dismissToast(id), duration);
}

export function dismissToast(id: number): void {
  setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
}

// init

export async function init(): Promise<void> {
  storage = await openStorage();
  const data = await storage.load();
  const profile = getScrambleType(data.profile).id;
  setState({ ready: true, persistent: storage.persistent, solves: data.solves, settings: data.settings, profile });
  void loadScramble(profile);
}

// scrambles

let scrambleToken = 0;

async function loadScramble(type: string): Promise<void> {
  const token = ++scrambleToken;
  // switching profiles clears the old scramble at once so nobody scrambles with it
  setState((s) => ({ scramble: { ...s.scramble, text: s.scramble.type === type ? s.scramble.text : "", type, loading: true, error: null } }));
  try {
    const text = await nextScramble(type);
    if (token !== scrambleToken) return;
    setState((s) => ({
      scramble: { text, type, loading: false, error: null },
      scrambleHistory: s.scramble.text && s.scramble.type === type ? [...s.scrambleHistory.slice(-49), s.scramble.text] : [],
    }));
  } catch (err) {
    if (token !== scrambleToken) return;
    console.error("scramble generation failed", err);
    setState((s) => ({ scramble: { ...s.scramble, loading: false, error: "Couldn't generate a scramble. Press R to retry." } }));
  }
}

export function newScramble(): void {
  void loadScramble(state.profile);
}

export function previousScramble(): void {
  const hist = state.scrambleHistory;
  if (!hist.length) return;
  scrambleToken++;
  setState((s) => ({ scramble: { ...s.scramble, text: hist[hist.length - 1]!, loading: false, error: null }, scrambleHistory: hist.slice(0, -1) }));
}

export function setCustomScramble(text: string): void {
  scrambleToken++;
  setState((s) => ({
    scramble: { ...s.scramble, text: text.trim(), loading: false, error: null },
    scrambleHistory: s.scramble.text ? [...s.scrambleHistory.slice(-49), s.scramble.text] : s.scrambleHistory,
  }));
}

// solves

export function setTimerPhase(phase: TimerPhase): void {
  if (state.timerPhase !== phase) setState({ timerPhase: phase });
}

export function addSolve(result: TimerResult): Solve {
  const solve: Solve = {
    id: newId(),
    scrambleType: state.profile,
    time: result.time,
    penalty: result.penalty,
    scramble: state.scramble.text,
    date: Date.now(),
  };
  if (result.splits?.length) solve.splits = result.splits;
  if (result.inspection != null) solve.inspection = result.inspection;
  setState((s) => ({ solves: [...s.solves, solve], selectedSolveId: null }));
  persist((st) => st.putSolves([solve]));
  newScramble();
  return solve;
}

function updateSolve(id: string, patch: Partial<Solve>): void {
  let updated: Solve | undefined;
  setState((s) => ({
    solves: s.solves.map((x) => {
      if (x.id !== id) return x;
      updated = { ...x, ...patch };
      return updated;
    }),
  }));
  if (updated) {
    const u = updated;
    persist((st) => st.putSolves([u]));
  }
}

export function setPenalty(id: string, penalty: Penalty): void {
  updateSolve(id, { penalty });
}

export function deleteSolves(ids: string[], label?: string): void {
  if (!ids.length) return;
  const set = new Set(ids);
  const removed = state.solves.filter((s) => set.has(s.id));
  setState((s) => ({
    solves: s.solves.filter((x) => !set.has(x.id)),
    selectedSolveId: s.selectedSolveId && set.has(s.selectedSolveId) ? null : s.selectedSolveId,
  }));
  persist((st) => st.deleteSolves(ids));
  toast(label ?? (removed.length === 1 ? "Solve deleted." : `${removed.length} solves deleted.`), {
    tone: "warning",
    action: { label: "Undo", run: () => restoreSolves(removed) },
    duration: 6000,
  });
}

function restoreSolves(solves: Solve[]): void {
  setState((s) => ({ solves: [...s.solves, ...solves].sort((a, b) => a.date - b.date) }));
  persist((st) => st.putSolves(solves));
}

export function moveSolves(ids: string[], profile: string): void {
  const set = new Set(ids);
  const moved: Solve[] = [];
  setState((s) => ({
    solves: s.solves.map((x) => {
      if (!set.has(x.id)) return x;
      const m = { ...x, scrambleType: profile };
      moved.push(m);
      return m;
    }),
  }));
  persist((st) => st.putSolves(moved));
}

export function selectSolve(id: string | null): void {
  setState({ selectedSolveId: id });
}

// profiles and navigation

export function switchProfile(id: string): void {
  const profile = getScrambleType(id).id;
  if (profile === state.profile) return;
  setState({ profile, selectedSolveId: null });
  persist((st) => st.setProfile(profile));
  void loadScramble(profile);
}

// steps through profiles that have solves, most recently used first
export function cycleProfile(delta: number): void {
  const list = [...selectProfileSummaries(state).entries()].sort((a, b) => b[1].last - a[1].last).map(([id]) => id);
  if (!list.includes(state.profile)) list.unshift(state.profile);
  if (list.length < 2) return;
  const i = list.indexOf(state.profile);
  switchProfile(list[(i + delta + list.length) % list.length]!);
}

export function clearProfile(id: string): void {
  const ids = state.solves.filter((s) => s.scrambleType === id).map((s) => s.id);
  deleteSolves(ids, `Cleared ${getScrambleType(id).name}.`);
}

export function setView(view: View): void {
  if (state.view !== view) setState({ view, selectedSolveId: null });
}

export function openModal(modal: Modal): void {
  setState({ modal });
}

export function closeModal(): void {
  if (state.modal) setState({ modal: null });
}

// settings

export function updateSettings(patch: Partial<Settings>): void {
  setState((s) => ({ settings: { ...s.settings, ...patch } }));
  const settings = state.settings;
  persist((st) => st.putSettings(settings));
}

// import and reset

// adds imported solves, skipping ones already stored
export function importData(result: ImportResult): { added: number; skipped: number } {
  const existing = new Set(state.solves.map(solveKey));
  const fresh = result.solves.filter((s) => !existing.has(solveKey(s)));
  setState({ solves: [...state.solves, ...fresh].sort((a, b) => a.date - b.date) });
  persist((st) => st.putSolves(fresh));
  const counts = new Map<string, number>();
  for (const s of fresh) counts.set(s.scrambleType, (counts.get(s.scrambleType) ?? 0) + 1);
  const biggest = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (biggest) switchProfile(biggest[0]);
  return { added: fresh.length, skipped: result.solves.length - fresh.length };
}

export async function resetAllData(): Promise<void> {
  if (storage) await storage.clearAll();
  setState({ solves: [], settings: DEFAULT_SETTINGS, selectedSolveId: null });
  switchProfile("333");
}
