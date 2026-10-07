import { useEffect } from "react";
import { getScrambleType } from "../core/events";
import { DNF, OK, PLUS2 } from "../core/types";
import {
  cycleProfile,
  deleteSolves,
  getState,
  init,
  newScramble,
  openModal,
  previousScramble,
  selectProfileSolves,
  selectSolve,
  setPenalty,
  setView,
  toast,
  updateSettings,
  useStore,
} from "../state/store";
import { AverageDetail } from "./components/AverageDetail";
import { Icon } from "./components/Modal";
import { CubeMenu } from "./components/CubeMenu";
import { hasGuide } from "./twisty";
import { Guide } from "./components/Guide";
import { ShortcutsHelp, Toasts } from "./components/Overlays";
import { SettingsModal } from "./components/SettingsModal";
import { SolveDetail } from "./components/SolveDetail";
import { toggleFullscreen } from "./fullscreen";
import { isEditableTarget } from "./hooks/useTimerController";
import { StatsScreen } from "./StatsScreen";
import { TimerScreen } from "./TimerScreen";

function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // the key that stops the timer is already consumed and must not double as a shortcut
      if (e.defaultPrevented) return;
      const st = getState();
      if (st.modal || isEditableTarget(e.target)) return;
      if (st.timerPhase !== "idle" && st.timerPhase !== "stopped") return;

      const solves = selectProfileSolves(st);
      const last = solves[solves.length - 1];

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const penalty = e.code === "Digit1" ? OK : e.code === "Digit2" ? PLUS2 : e.code === "Digit3" ? DNF : null;
        if (penalty !== null && last) {
          e.preventDefault();
          setPenalty(last.id, penalty);
        } else if (e.code === "KeyZ" && last) {
          e.preventDefault();
          deleteSolves([last.id]);
        } else if (e.code === "ArrowUp" || e.code === "ArrowDown") {
          e.preventDefault();
          cycleProfile(e.code === "ArrowUp" ? -1 : 1);
        }
        return;
      }
      if (e.ctrlKey || e.metaKey) return;

      const selIndex = st.selectedSolveId ? solves.findIndex((s) => s.id === st.selectedSolveId) : -1;
      const selected = selIndex >= 0 ? solves[selIndex] : undefined;
      const onStats = st.view === "stats";

      switch (e.code) {
        case "KeyR":
          e.preventDefault();
          if (e.shiftKey) previousScramble();
          else newScramble();
          return;
        case "KeyI": {
          e.preventDefault();
          const next = !st.settings.inspection;
          updateSettings({ inspection: next });
          toast(`Inspection ${next ? "on" : "off"}.`);
          return;
        }
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          return;
        case "KeyE":
          e.preventDefault();
          openModal({ kind: "profiles" });
          return;
        case "KeyG":
          e.preventDefault();
          if (hasGuide(st.scramble.type) && st.scramble.text) openModal({ kind: "guide" });
          return;
        case "KeyS":
          e.preventDefault();
          setView(onStats ? "timer" : "stats");
          return;
        case "Slash":
          if (e.shiftKey) {
            e.preventDefault();
            openModal({ kind: "shortcuts" });
          }
          return;
        case "Escape":
          if (onStats) setView("timer");
          return;
      }

      if (!onStats) return;
      switch (e.code) {
        case "ArrowUp":
        case "KeyK":
        case "ArrowDown":
        case "KeyJ": {
          if (!solves.length) return;
          e.preventDefault();
          // newest is on top so up means a newer solve
          const up = e.code === "ArrowUp" || e.code === "KeyK";
          const next = selIndex < 0 ? solves.length - 1 : Math.min(solves.length - 1, Math.max(0, selIndex + (up ? 1 : -1)));
          selectSolve(solves[next]!.id);
          return;
        }
        case "Enter":
          if (selected) {
            e.preventDefault();
            openModal({ kind: "solve", id: selected.id });
          }
          return;
        case "KeyP":
          if (selected) setPenalty(selected.id, selected.penalty === PLUS2 ? OK : PLUS2);
          return;
        case "KeyN":
          if (selected) setPenalty(selected.id, selected.penalty === DNF ? OK : DNF);
          return;
        case "Delete":
        case "Backspace":
          if (selected) {
            e.preventDefault();
            deleteSolves([selected.id]);
          }
          return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function ModalHost() {
  const modal = useStore((s) => s.modal);
  if (!modal) return null;
  switch (modal.kind) {
    case "solve":
      return <SolveDetail id={modal.id} />;
    case "average":
      return <AverageDetail statKey={modal.key} end={modal.end} />;
    case "settings":
      return <SettingsModal />;
    case "shortcuts":
      return <ShortcutsHelp />;
    case "profiles":
      return <CubeMenu />;
    case "guide":
      return <Guide />;
  }
}

export function App() {
  const ready = useStore((s) => s.ready);
  const view = useStore((s) => s.view);
  const phase = useStore((s) => s.timerPhase);
  const profile = useStore((s) => s.profile);

  useEffect(() => {
    void init();
  }, []);
  useShortcuts();

  if (!ready) return <div className="boot">KubeTimr</div>;

  const solving = phase === "running" || phase === "inspection";
  const type = getScrambleType(profile);

  return (
    <div className={`app ${solving ? "is-solving" : ""}`}>
      <header className="bar">
        <button className="cube-switch" onClick={() => openModal({ kind: "profiles" })} title="Switch cube (E)">
          <span>{type.name}</span>
          <Icon name="chevron" size={14} />
        </button>
        <nav className="views" aria-label="View">
          <button className={view === "timer" ? "is-on" : ""} onClick={() => setView("timer")}>
            Timer
          </button>
          <button className={view === "stats" ? "is-on" : ""} onClick={() => setView("stats")}>
            Stats
          </button>
        </nav>
        <div className="bar__end">
          <button className="icon-btn" onClick={() => openModal({ kind: "settings" })} title="Settings" aria-label="Settings">
            <Icon name="settings" />
          </button>
        </div>
      </header>
      <main className="screen">{view === "timer" ? <TimerScreen /> : <StatsScreen />}</main>
      <ModalHost />
      <Toasts />
    </div>
  );
}
