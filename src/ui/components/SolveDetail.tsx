import { useEffect } from "react";
import { SCRAMBLE_GROUPS, SCRAMBLE_TYPES } from "../../core/events";
import { phaseDurations } from "../../core/stats";
import { formatMs, formatSolve } from "../../core/time";
import { DNF, OK, Penalty, PLUS2 } from "../../core/types";
import { closeModal, deleteSolves, moveSolves, openModal, selectSolve, setCustomScramble, setPenalty, setView, useProfileSolves, useStore } from "../../state/store";
import { copyText } from "../TimerScreen";
import { Icon, Modal } from "./Modal";

const PENALTIES: [Penalty, string, string][] = [
  [OK, "OK", ""],
  [PLUS2, "+2", "is-warn"],
  [DNF, "DNF", "is-bad"],
];

export function SolveDetail({ id }: { id: string }) {
  const solve = useStore((s) => s.solves.find((x) => x.id === id));
  const profileSolves = useProfileSolves();
  const phaseNames = useStore((s) => s.settings.phaseNames);

  const index = profileSolves.findIndex((s) => s.id === id);
  const go = (delta: number) => {
    const next = profileSolves[index + delta];
    if (!next) return;
    selectSolve(next.id);
    openModal({ kind: "solve", id: next.id });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!solve) {
    return (
      <Modal title="Solve" size="sm">
        <p className="muted">This solve no longer exists.</p>
      </Modal>
    );
  }

  const phases = phaseDurations(solve);

  return (
    <Modal
      title={
        <span className="nav-title">
          <button className="icon-btn" onClick={() => go(-1)} disabled={index <= 0} aria-label="Previous solve" title="Previous">
            <Icon name="prev" />
          </button>
          Solve {index + 1}
          <button className="icon-btn" onClick={() => go(1)} disabled={index < 0 || index >= profileSolves.length - 1} aria-label="Next solve" title="Next">
            <Icon name="next" />
          </button>
        </span>
      }
      footer={
        <>
          <button
            className="btn btn--ghost btn--danger-text"
            onClick={() => {
              deleteSolves([solve.id]);
              closeModal();
            }}
          >
            <Icon name="trash" size={14} /> Delete
          </button>
          <span className="spacer" />
          <button className="btn btn--ghost" onClick={() => copyText(`${formatSolve(solve.time, solve.penalty, { dnfRaw: true })}   ${solve.scramble}`, "Solve copied.")}>
            <Icon name="copy" size={14} /> Copy
          </button>
        </>
      }
    >
      <div className="detail">
        <div className="detail__top">
          <div className={`detail__time ${solve.penalty === DNF ? "is-dnf" : ""}`}>{formatSolve(solve.time, solve.penalty, { decimals: 3, dnfRaw: solve.time > 0 })}</div>
          <div className="segmented" role="radiogroup" aria-label="Penalty">
            {PENALTIES.map(([p, label, tone]) => (
              <button key={label} role="radio" aria-checked={solve.penalty === p} className={solve.penalty === p ? `is-on ${tone}` : ""} onClick={() => setPenalty(solve.id, p)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {phases.length > 1 && (
          <div className="phases">
            {phases.map((d, i) => (
              <div key={i} className="phase">
                <span className="phase__name">{phaseNames[i] ?? `Phase ${i + 1}`}</span>
                <span className="phase__bar">
                  <span style={{ width: `${(d / solve.time) * 100}%` }} />
                </span>
                <span className="phase__time">{formatMs(d)}</span>
              </div>
            ))}
          </div>
        )}

        {solve.scramble && (
          <div className="detail__scramble">
            <p className="mono small">{solve.scramble}</p>
            <button
              className="btn btn--ghost btn--small"
              onClick={() => {
                setCustomScramble(solve.scramble);
                setView("timer");
                closeModal();
              }}
            >
              Practice this scramble again
            </button>
          </div>
        )}

        <label className="field field--inline">
          <span className="label">Cube</span>
          <select
            className="input"
            value={solve.scrambleType}
            onChange={(e) => {
              moveSolves([solve.id], e.target.value);
              closeModal();
            }}
          >
            {SCRAMBLE_GROUPS.map((g) => (
              <optgroup key={g} label={g}>
                {SCRAMBLE_TYPES.filter((t) => t.group === g).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      </div>
    </Modal>
  );
}
