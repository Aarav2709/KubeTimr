import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { getScrambleType } from "../core/events";
import { newRecords, statValue } from "../core/stats";
import { formatMs, formatSolve, parseTimeEntry } from "../core/time";
import { DNF, OK, PLUS2, Solve } from "../core/types";
import {
  addSolve,
  deleteSolves,
  newScramble,
  openModal,
  previousScramble,
  setCustomScramble,
  setPenalty,
  setView,
  toast,
  useProfileSolves,
  useStore,
} from "../state/store";
import { useStats } from "../state/useStats";
import { hasGuide } from "./twisty";
import { Icon } from "./components/Modal";
import { useTimerController } from "./hooks/useTimerController";

export async function copyText(text: string, label = "Copied."): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    toast("Clipboard unavailable.", { tone: "warning" });
  }
}

export function TimerScreen() {
  const settings = useStore((s) => s.settings);
  const modalOpen = useStore((s) => s.modal !== null);
  const typing = settings.inputMethod === "typing";
  const { state, displayRef, surfaceRef } = useTimerController(settings, !typing && !modalOpen);
  const solves = useProfileSolves();
  const stats = useStats();
  const last: Solve | undefined = solves[solves.length - 1];

  // records are only announced for a solve that was just added
  const [records, setRecords] = useState<string[]>([]);
  const seenId = useRef<string | undefined>(last?.id);
  useEffect(() => {
    if (!last || last.id === seenId.current) return;
    seenId.current = last.id;
    setRecords(Date.now() - last.date < 3000 ? newRecords(stats) : []);
  }, [last, stats]);
  useEffect(() => {
    if (state.phase === "holding" || state.phase === "inspection") setRecords([]);
  }, [state.phase]);

  const decimals = settings.showMs ? 3 : 2;
  const inspecting = state.phase === "inspection" || ((state.phase === "holding" || state.phase === "ready") && state.holdFrom === "inspection");
  let staticText = last ? formatSolve(last.time, last.penalty, { decimals }) : formatMs(0, decimals);
  if (state.phase === "ready" && state.holdFrom === "idle") staticText = formatMs(0, decimals);
  if (inspecting) staticText = "15";

  // the raf loop owns the text while running or inspecting, react never renders into this node
  const live = state.phase === "running" || inspecting;
  useLayoutEffect(() => {
    if (displayRef.current && !live) displayRef.current.textContent = staticText;
  });

  const timerCls = [
    "timer",
    `timer--${settings.timerFont}`,
    state.phase === "holding" && "timer--holding",
    state.phase === "ready" && "timer--ready",
    state.phase === "inspection" && "timer--inspection",
  ]
    .filter(Boolean)
    .join(" ");

  const justSolved = !typing && state.phase === "stopped" && last;
  const idle = state.phase === "idle" || state.phase === "stopped";

  return (
    <section className="timer-screen" ref={surfaceRef as React.RefObject<HTMLElement>} aria-label="Timer">
      <ScrambleBlock />

      <div className="timer-stage">
        {typing ? (
          <TypingEntry />
        ) : (
          <div className={timerCls} style={{ fontSize: `calc(var(--timer-size) * ${settings.timerScale})` }} role="timer">
            <span ref={displayRef} />
          </div>
        )}

        <div className="timer-below">
          {inspecting && <span className="hint">Hold to start</span>}
          {state.phase === "running" && settings.phases > 1 && (
            <span className="hint">
              {settings.phaseNames[state.splits.length] ?? `Phase ${state.splits.length + 1}`} · {state.splits.length + 1}/{settings.phases}
            </span>
          )}
          {state.phase === "idle" && !last && !typing && <span className="hint">Hold space or touch, release to start</span>}
          {records.length > 0 && idle && <span className="record">New best {records.join(" · ")}</span>}
          {justSolved && <SolveActions solve={last} />}
        </div>
      </div>

      <footer className="timer-footer" data-no-timer>
        <StatLine stats={stats} count={solves.length} />
      </footer>
    </section>
  );
}

function ScrambleBlock() {
  const scramble = useStore((s) => s.scramble);
  const hasHistory = useStore((s) => s.scrambleHistory.length > 0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const type = getScrambleType(scramble.type);
  const long = scramble.text.length > 160;

  const commit = () => {
    setCustomScramble(draft);
    setEditing(false);
  };

  return (
    <div className="scramble" data-no-timer>
      {editing ? (
        <form
          className="scramble__edit"
          onSubmit={(e) => {
            e.preventDefault();
            commit();
          }}
        >
          <textarea
            className="input mono"
            value={draft}
            autoFocus
            rows={2}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                e.stopPropagation();
                setEditing(false);
              }
            }}
            aria-label="Your scramble"
          />
          <div className="row">
            <button className="btn btn--primary btn--small" type="submit">
              Use scramble
            </button>
            <button className="btn btn--ghost btn--small" type="button" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className={`scramble__text ${scramble.loading ? "is-loading" : ""} ${long ? "is-long" : ""}`} aria-live="polite">
            {scramble.error ??
              (scramble.loading && !scramble.text ? `Generating ${type.name} scramble…` : scramble.text || (type.source.kind === "none" ? "No scramble" : ""))}
          </p>
          <div className="scramble__actions">
            <button className="icon-btn" onClick={previousScramble} disabled={!hasHistory} title="Previous scramble (Shift+R)" aria-label="Previous scramble">
              <Icon name="back" />
            </button>
            <button className="icon-btn" onClick={newScramble} title="Next scramble (R)" aria-label="Next scramble">
              <Icon name="refresh" />
            </button>
            <button className="icon-btn" onClick={() => copyText(scramble.text, "Scramble copied.")} disabled={!scramble.text} title="Copy" aria-label="Copy scramble">
              <Icon name="copy" />
            </button>
            <button
              className="icon-btn"
              onClick={() => {
                setDraft(scramble.text);
                setEditing(true);
              }}
              title="Type your own scramble"
              aria-label="Edit scramble"
            >
              <Icon name="edit" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// tiny cube that opens into a solve label on hover and launches the guide
function GuideButton() {
  const scramble = useStore((s) => s.scramble);
  if (!hasGuide(scramble.type)) return null;
  return (
    <button className="guide-btn" onClick={() => openModal({ kind: "guide" })} disabled={!scramble.text} title="Scramble and solve guide (G)" aria-label="Open scramble and solve guide">
      <Icon name="cube" size={15} />
      <span className="guide-btn__label">Solve</span>
    </button>
  );
}

function StatLine({ stats, count }: { stats: ReturnType<typeof useStats>; count: number }) {
  if (count === 0)
    return (
      <div className="statline">
        <GuideButton />
      </div>
    );
  const end = stats.values.length - 1;
  const item = (key: string) => {
    const s = stats.series.get(key);
    const v = s ? statValue(s[end]!) : undefined;
    return (
      <button className="statline__item" disabled={v === undefined} onClick={() => openModal({ kind: "average", key, end })}>
        <span>{key}</span>
        <strong>{v === undefined ? "–" : formatMs(v)}</strong>
      </button>
    );
  };
  return (
    <div className="statline">
      {item("ao5")}
      {item("ao12")}
      <GuideButton />
      <button className="statline__item" onClick={() => setView("stats")} title="All stats (S)">
        <span>best</span>
        <strong>{stats.bestIndex >= 0 ? formatMs(stats.best) : "–"}</strong>
      </button>
      <button className="statline__item" onClick={() => setView("stats")} title="All stats (S)">
        <span>solves</span>
        <strong>{count.toLocaleString()}</strong>
      </button>
    </div>
  );
}

function SolveActions({ solve }: { solve: Solve }) {
  return (
    <div className="solve-actions" data-no-timer>
      <button className={solve.penalty === PLUS2 ? "is-on is-warn" : ""} onClick={() => setPenalty(solve.id, solve.penalty === PLUS2 ? OK : PLUS2)} title="Alt+2">
        +2
      </button>
      <button className={solve.penalty === DNF ? "is-on is-bad" : ""} onClick={() => setPenalty(solve.id, solve.penalty === DNF ? OK : DNF)} title="Alt+3">
        DNF
      </button>
      <button onClick={() => deleteSolves([solve.id])} title="Alt+Z">
        Delete
      </button>
    </div>
  );
}

function TypingEntry() {
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);
  const preview = useMemo(() => parseTimeEntry(value), [value]);

  const submit = () => {
    const parsed = parseTimeEntry(value);
    if (!parsed) return setError(true);
    addSolve({ time: parsed.time, penalty: parsed.penalty });
    setValue("");
    setError(false);
  };

  return (
    <form
      className="typing"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      data-no-timer
    >
      <input
        autoFocus
        className={`typing__input ${error ? "is-error" : ""}`}
        value={value}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        placeholder="0.00"
        aria-label="Enter time"
        onChange={(e) => {
          setValue(e.target.value);
          setError(false);
        }}
      />
      <span className="hint">
        {value && preview ? (
          <>
            {formatSolve(preview.time, preview.penalty, { dnfRaw: preview.time > 0 })} · Enter to save
          </>
        ) : (
          "Type 1234 for 12.34, add + for a +2, or DNF"
        )}
      </span>
    </form>
  );
}
