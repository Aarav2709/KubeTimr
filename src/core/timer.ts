import { DNF, OK, Penalty, PLUS2 } from "./types";

// pure timer state machine: hold until ready, release to start, press to split or stop

export const INSPECTION_MS = 15_000;
export const INSPECTION_DNF_MS = 17_000;

export type TimerPhase = "idle" | "holding" | "ready" | "inspection" | "running" | "stopped";

export interface TimerConfig {
  holdTime: number;
  inspection: boolean;
  phases: number;
}

export interface TimerResult {
  time: number;
  penalty: Penalty;
  splits?: number[];
  inspection?: number;
}

export interface TimerState {
  phase: TimerPhase;
  // where the hold began, inspection keeps counting while holding
  holdFrom: "idle" | "inspection";
  holdStart: number;
  inspectionStart: number;
  runStart: number;
  splits: number[];
  result: TimerResult | null;
}

export type TimerEvent =
  | { type: "press"; now: number }
  | { type: "release"; now: number }
  | { type: "tick"; now: number }
  | { type: "cancel" };

export const initialTimerState: TimerState = {
  phase: "idle",
  holdFrom: "idle",
  holdStart: 0,
  inspectionStart: 0,
  runStart: 0,
  splits: [],
  result: null,
};

export function inspectionPenalty(elapsed: number): Penalty {
  if (elapsed > INSPECTION_DNF_MS) return DNF;
  if (elapsed > INSPECTION_MS) return PLUS2;
  return OK;
}

function startRun(state: TimerState, now: number): TimerState {
  return { ...state, phase: "running", runStart: now, splits: [], result: null };
}

export function timerReducer(state: TimerState, event: TimerEvent, config: TimerConfig): TimerState {
  switch (event.type) {
    case "cancel":
      if (state.phase === "running" || state.phase === "inspection" || state.holdFrom === "inspection") {
        return { ...initialTimerState };
      }
      if (state.phase === "holding" || state.phase === "ready") {
        return { ...state, phase: state.result ? "stopped" : "idle" };
      }
      return state;

    case "press": {
      const { now } = event;
      switch (state.phase) {
        case "idle":
        case "stopped":
          return {
            ...state,
            phase: config.holdTime <= 0 ? "ready" : "holding",
            holdFrom: "idle",
            holdStart: now,
          };
        case "inspection":
          return {
            ...state,
            phase: config.holdTime <= 0 ? "ready" : "holding",
            holdFrom: "inspection",
            holdStart: now,
          };
        case "running": {
          const elapsed = Math.max(0, Math.round(now - state.runStart));
          if (state.splits.length < config.phases - 1) {
            return { ...state, splits: [...state.splits, elapsed] };
          }
          const inspectionUsed = state.inspectionStart ? state.runStart - state.inspectionStart : 0;
          const penalty = state.inspectionStart ? inspectionPenalty(inspectionUsed) : OK;
          const result: TimerResult = { time: elapsed, penalty };
          if (state.splits.length > 0) result.splits = state.splits;
          if (state.inspectionStart) result.inspection = Math.round(inspectionUsed);
          return { ...state, phase: "stopped", result };
        }
        default:
          return state;
      }
    }

    case "release": {
      const { now } = event;
      if (state.phase === "holding") {
        if (state.holdFrom === "inspection") return { ...state, phase: "inspection" };
        return { ...state, phase: state.result ? "stopped" : "idle" };
      }
      if (state.phase === "ready") {
        if (state.holdFrom === "idle" && config.inspection) {
          return { ...state, phase: "inspection", inspectionStart: now, splits: [], result: null };
        }
        const next = startRun(state, now);
        if (state.holdFrom === "idle") next.inspectionStart = 0;
        return next;
      }
      return state;
    }

    case "tick": {
      const { now } = event;
      if (state.phase === "holding" && now - state.holdStart >= config.holdTime) {
        return { ...state, phase: "ready" };
      }
      const inspecting =
        state.phase === "inspection" ||
        ((state.phase === "holding" || state.phase === "ready") && state.holdFrom === "inspection");
      if (inspecting && now - state.inspectionStart > INSPECTION_DNF_MS) {
        return {
          ...initialTimerState,
          phase: "stopped",
          result: { time: 0, penalty: DNF, inspection: Math.round(now - state.inspectionStart) },
        };
      }
      return state;
    }
  }
}

export function isTimingActive(state: TimerState): boolean {
  return (
    state.phase === "running" ||
    state.phase === "inspection" ||
    ((state.phase === "holding" || state.phase === "ready") && state.holdFrom === "inspection")
  );
}
