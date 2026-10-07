import { useCallback, useEffect, useRef, useState } from "react";
import { INSPECTION_MS, initialTimerState, TimerEvent, timerReducer, TimerState } from "../../core/timer";
import { formatMs } from "../../core/time";
import { Settings } from "../../core/types";
import { addSolve, getState, setTimerPhase } from "../../state/store";
import { inspectionAlert, primeAudio } from "../sound";

// wires keys and touch into the timer machine, the live time is written straight to the dom

export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

export function runningText(ms: number, settings: Settings): string {
  switch (settings.timerUpdate) {
    case "hidden":
      return "solve";
    case "seconds":
      return formatMs(ms, 0);
    case "tenths":
      return formatMs(ms, 1);
    default:
      return formatMs(ms, settings.showMs ? 3 : 2);
  }
}

export function inspectionText(elapsed: number): string {
  if (elapsed > INSPECTION_MS) return elapsed > 17_000 ? "DNF" : "+2";
  return String(Math.ceil((INSPECTION_MS - elapsed) / 1000));
}

export interface TimerController {
  state: TimerState;
  displayRef: React.RefObject<HTMLSpanElement>;
  // element that acts as the touch stackmat
  surfaceRef: React.MutableRefObject<HTMLElement | null>;
  dispatch: (e: TimerEvent) => void;
}

export function useTimerController(settings: Settings, enabled: boolean): TimerController {
  const [state, setState] = useState<TimerState>(initialTimerState);
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const displayRef = useRef<HTMLSpanElement>(null);
  const alertsRef = useRef({ eight: false, twelve: false });
  const spaceDownRef = useRef(false);

  const dispatch = useCallback((event: TimerEvent) => {
    const s = settingsRef.current;
    const prev = stateRef.current;
    const next = timerReducer(prev, event, {
      holdTime: s.holdTime,
      inspection: s.inspection,
      phases: Math.max(1, s.phases),
    });
    if (next === prev) return;
    stateRef.current = next;
    if (next.phase === "inspection" && prev.phase !== "inspection" && prev.holdFrom === "idle") {
      alertsRef.current = { eight: false, twelve: false };
    }
    if (next.phase === "stopped" && next.result && next.result !== prev.result) {
      addSolve(next.result);
    }
    setState(next);
    setTimerPhase(next.phase === "holding" || next.phase === "ready" ? (next.holdFrom === "inspection" ? "inspection" : next.phase) : next.phase);
  }, []);

  // frame loop for the display, hold to ready, inspection calls and auto dnf
  useEffect(() => {
    const active =
      state.phase === "running" ||
      state.phase === "holding" ||
      state.phase === "inspection" ||
      (state.phase === "ready" && state.holdFrom === "inspection");
    if (!active) return;
    let raf = 0;
    const loop = () => {
      const now = performance.now();
      const st = stateRef.current;
      const el = displayRef.current;
      if (st.phase === "running") {
        if (el) el.textContent = runningText(now - st.runStart, settingsRef.current);
      } else {
        const inspecting = st.phase === "inspection" || st.holdFrom === "inspection";
        if (inspecting) {
          const elapsed = now - st.inspectionStart;
          if (el) el.textContent = inspectionText(elapsed);
          const a = alertsRef.current;
          const kind = settingsRef.current.inspectionAlert;
          if (!a.eight && elapsed >= 8000) {
            a.eight = true;
            inspectionAlert(kind, 8);
          }
          if (!a.twelve && elapsed >= 12000) {
            a.twelve = true;
            inspectionAlert(kind, 12);
          }
        }
        dispatch({ type: "tick", now });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [state.phase, state.holdFrom, dispatch]);

  // keyboard
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (getState().modal || isEditableTarget(e.target)) return;
      const phase = stateRef.current.phase;
      if (phase === "running") {
        // any key stops the timer like cstimer
        if (e.repeat) return;
        e.preventDefault();
        if (e.code === "Space") spaceDownRef.current = true;
        dispatch({ type: "press", now: performance.now() });
        return;
      }
      if (e.code === "Escape") {
        const st = stateRef.current;
        if (st.phase === "inspection" || st.holdFrom === "inspection" || st.phase === "holding" || st.phase === "ready") {
          e.preventDefault();
          dispatch({ type: "cancel" });
        }
        return;
      }
      if (e.code !== "Space" || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (e.repeat || spaceDownRef.current) return;
      spaceDownRef.current = true;
      primeAudio();
      dispatch({ type: "press", now: performance.now() });
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (!spaceDownRef.current) return;
      spaceDownRef.current = false;
      e.preventDefault();
      dispatch({ type: "release", now: performance.now() });
    };
    const onBlur = () => {
      // losing focus mid hold must not leave the timer armed
      if (spaceDownRef.current) {
        spaceDownRef.current = false;
        const st = stateRef.current;
        if (st.phase === "holding" || st.phase === "ready") dispatch({ type: "cancel" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled, dispatch]);

  // while running a touch anywhere stops the timer
  useEffect(() => {
    if (state.phase !== "running") return;
    const onTouch = (e: TouchEvent) => {
      e.preventDefault();
      dispatch({ type: "press", now: performance.now() });
    };
    document.addEventListener("touchstart", onTouch, { passive: false });
    return () => document.removeEventListener("touchstart", onTouch);
  }, [state.phase, dispatch]);

  // native listeners because react makes touchstart passive
  const surfaceRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el || !enabled) return;
    let active = false;
    const onStart = (e: TouchEvent) => {
      if (getState().modal) return;
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [data-no-timer]")) return;
      // the document listener handles stopping
      if (stateRef.current.phase === "running") return;
      e.preventDefault();
      active = true;
      primeAudio();
      dispatch({ type: "press", now: performance.now() });
    };
    const onEnd = (e: TouchEvent) => {
      if (!active) return;
      e.preventDefault();
      active = false;
      dispatch({ type: "release", now: performance.now() });
    };
    const onCancel = () => {
      if (!active) return;
      active = false;
      const st = stateRef.current;
      if (st.phase === "holding" || st.phase === "ready") dispatch({ type: "cancel" });
    };
    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onCancel);
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [enabled, dispatch]);

  // cancel a hold when the timer gets disabled
  useEffect(() => {
    if (!enabled && stateRef.current.phase !== "idle" && stateRef.current.phase !== "stopped") {
      dispatch({ type: "cancel" });
    }
  }, [enabled, dispatch]);

  return { state, displayRef, surfaceRef, dispatch };
}
