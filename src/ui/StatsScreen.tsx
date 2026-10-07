import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { exportCsv } from "../core/cstimer";
import { getScrambleType } from "../core/events";
import { statValue } from "../core/stats";
import { formatDuration, formatMs, formatSolve } from "../core/time";
import { DNF, PLUS2, STAT_KEYS } from "../core/types";
import { clearProfile, openModal, selectSolve, useProfileSolves, useStore } from "../state/store";
import { useStats } from "../state/useStats";
import { Charts } from "./components/Charts";
import { Icon } from "./components/Modal";

export function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StatsScreen() {
  const profile = useStore((s) => s.profile);
  const solves = useProfileSolves();
  const stats = useStats();
  const decimals = useStore((s) => (s.settings.showMs ? 3 : 2));
  const [confirmClear, setConfirmClear] = useState(false);
  const type = getScrambleType(profile);
  const last = solves.length - 1;

  useEffect(() => setConfirmClear(false), [profile]);

  if (solves.length === 0) {
    return (
      <div className="stats-screen">
        <div className="stats-empty">
          <h1>{type.name}</h1>
          <p>No solves yet. Do a few on the timer and your stats show up here.</p>
        </div>
      </div>
    );
  }

  const tiles = stats.averages.filter((a) => STAT_KEYS.includes(a.spec.key));
  const fmt = (v: number | null | undefined) => (v === undefined ? "–" : formatMs(v, decimals));

  return (
    <div className="stats-screen">
      <header className="stats-head">
        <div>
          <h1>{type.name}</h1>
          <p className="muted">
            {solves.length.toLocaleString()} solves · {stats.dnfCount} DNF · {formatDuration(stats.totalTime)} solving
          </p>
        </div>
        <div className="row">
          <button className="btn btn--ghost btn--small" onClick={() => download(`${type.short}-${new Date().toISOString().slice(0, 10)}.csv`, exportCsv(solves), "text/csv")}>
            <Icon name="download" size={14} /> CSV
          </button>
          {confirmClear ? (
            <button className="btn btn--danger btn--small" onClick={() => clearProfile(profile)}>
              Delete all {solves.length.toLocaleString()} solves?
            </button>
          ) : (
            <button className="btn btn--ghost btn--small" onClick={() => setConfirmClear(true)}>
              Clear profile
            </button>
          )}
        </div>
      </header>

      <section className="tiles">
        <Tile
          label="single"
          best={fmt(stats.best)}
          now={fmt(statValue(stats.values[last]!))}
          onBest={() => openModal({ kind: "solve", id: solves[stats.bestIndex]!.id })}
          onNow={() => openModal({ kind: "solve", id: solves[last]!.id })}
        />
        {tiles.map((a) => (
          <Tile
            key={a.spec.key}
            label={a.spec.key}
            best={fmt(statValue(a.best))}
            now={fmt(statValue(a.current))}
            onBest={a.bestEnd >= 0 ? () => openModal({ kind: "average", key: a.spec.key, end: a.bestEnd }) : undefined}
            onNow={!Number.isNaN(a.current) ? () => openModal({ kind: "average", key: a.spec.key, end: last }) : undefined}
          />
        ))}
        <div className="tile tile--plain">
          <span className="tile__label">mean</span>
          <span className="tile__best">{fmt(statValue(stats.mean))}</span>
          <span className="tile__now">σ {fmt(statValue(stats.stdev))}</span>
        </div>
      </section>

      <section className="card">
        <Charts />
      </section>

      <section className="card card--flush">
        <SolveTable decimals={decimals} />
      </section>
    </div>
  );
}

function Tile({ label, best, now, onBest, onNow }: { label: string; best: string; now: string; onBest?: () => void; onNow?: () => void }) {
  return (
    <div className="tile">
      <span className="tile__label">{label}</span>
      <button className="tile__best" disabled={!onBest} onClick={onBest} title="Best">
        {best}
      </button>
      <button className="tile__now" disabled={!onNow} onClick={onNow} title="Current">
        now {now}
      </button>
    </div>
  );
}

const ROW = 34;
const OVERSCAN = 10;

// virtualized table, newest first
function SolveTable({ decimals }: { decimals: 2 | 3 }) {
  const solves = useProfileSolves();
  const stats = useStats();
  const selectedId = useStore((s) => s.selectedSolveId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [height, setHeight] = useState(480);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = solves.length;
  const selectedRow = selectedId ? n - 1 - solves.findIndex((s) => s.id === selectedId) : -1;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || selectedRow < 0 || selectedRow >= n) return;
    const top = selectedRow * ROW;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW - el.clientHeight;
  }, [selectedRow, n]);

  const first = Math.max(0, Math.floor(scrollTop / ROW) - OVERSCAN);
  const lastRow = Math.min(n - 1, Math.ceil((scrollTop + height) / ROW) + OVERSCAN);
  const ao5 = stats.series.get("ao5");
  const ao12 = stats.series.get("ao12");

  const rows = [];
  for (let r = first; r <= lastRow; r++) {
    const i = n - 1 - r;
    const s = solves[i]!;
    const cls = s.penalty === DNF ? "is-dnf" : s.penalty === PLUS2 ? "is-plus2" : i === stats.bestIndex ? "is-best" : "";
    rows.push(
      <div
        key={s.id}
        role="row"
        aria-selected={s.id === selectedId}
        className={`trow ${s.id === selectedId ? "is-selected" : ""}`}
        style={{ transform: `translateY(${r * ROW}px)` }}
        onClick={() => {
          selectSolve(s.id);
          openModal({ kind: "solve", id: s.id });
        }}
      >
        <span className="trow__idx">{i + 1}</span>
        <span className={`trow__time ${cls}`}>{formatSolve(s.time, s.penalty, { decimals })}</span>
        <AvgCell series={ao5} i={i} />
        <AvgCell series={ao12} i={i} />
      </div>,
    );
  }

  return (
    <div className="table">
      <div className="thead" role="row">
        <span>#</span>
        <span>time</span>
        <span>ao5</span>
        <span>ao12</span>
      </div>
      <div className="tbody" ref={scrollRef} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} role="grid" aria-rowcount={n}>
        <div style={{ height: n * ROW, position: "relative" }}>{rows}</div>
      </div>
    </div>
  );
}

function AvgCell({ series, i }: { series?: Float64Array; i: number }) {
  const v = series ? statValue(series[i] ?? Number.NaN) : undefined;
  return <span className="trow__avg">{v === undefined ? "" : formatMs(v)}</span>;
}
