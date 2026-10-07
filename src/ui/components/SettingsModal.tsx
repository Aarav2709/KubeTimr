import { ReactNode, useMemo, useRef, useState } from "react";
import { exportBackup, exportCstimer, ImportResult, importAny } from "../../core/cstimer";
import { getScrambleType } from "../../core/events";
import { InspectionAlert, Settings, TimerFont, TimerUpdate } from "../../core/types";
import { getState, importData, resetAllData, toast, updateSettings, useStore } from "../../state/store";
import { download } from "../StatsScreen";
import { inspectionAlert } from "../sound";
import { Modal } from "./Modal";

export function SettingsModal() {
  return (
    <Modal title="Settings" size="md">
      <TimerSection />
      <DisplaySection />
      <DataSection />
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h3>{title}</h3>
      <div className="settings-card">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="setting">
      <div>
        <div className="setting__label">{label}</div>
        {hint && <div className="setting__hint">{hint}</div>}
      </div>
      <div className="setting__control">{children}</div>
    </div>
  );
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={value} aria-label={label} className={`switch ${value ? "is-on" : ""}`} onClick={() => onChange(!value)} />;
}

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? "is-on" : ""} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

const PHASE_PRESETS: Record<string, string[]> = {
  Off: [],
  CFOP: ["Cross", "F2L", "OLL", "PLL"],
  Roux: ["FB", "SB", "CMLL", "LSE"],
  ZZ: ["EOLine", "F2L", "LL"],
  BLD: ["Memo", "Exec"],
};

function TimerSection() {
  const s = useStore((st) => st.settings);
  const set = (p: Partial<Settings>) => updateSettings(p);
  const preset = Object.entries(PHASE_PRESETS).find(([, names]) => (names.length || 1) === s.phases && names.join() === s.phaseNames.join())?.[0] ?? "Off";
  return (
    <Section title="Timer">
      <Row label="Input">
        <Segmented value={s.inputMethod} options={[["keyboard", "Space or touch"], ["typing", "Typing"]]} onChange={(v) => set({ inputMethod: v })} />
      </Row>
      <Row label="Hold time" hint={`${(s.holdTime / 1000).toFixed(2)}s before the timer turns green`}>
        <input type="range" min={0} max={1000} step={50} value={s.holdTime} onChange={(e) => set({ holdTime: Number(e.target.value) })} aria-label="Hold time" />
      </Row>
      <Row label="WCA inspection" hint="15 seconds, +2 after 15, DNF after 17">
        <Toggle label="WCA inspection" value={s.inspection} onChange={(v) => set({ inspection: v })} />
      </Row>
      {s.inspection && (
        <Row label="8 and 12 second calls">
          <div className="row">
            <Segmented<InspectionAlert> value={s.inspectionAlert} options={[["voice", "Voice"], ["beep", "Beep"], ["off", "Off"]]} onChange={(v) => set({ inspectionAlert: v })} />
            <button className="btn btn--ghost btn--small" onClick={() => inspectionAlert(s.inspectionAlert, 8)} disabled={s.inspectionAlert === "off"}>
              Test
            </button>
          </div>
        </Row>
      )}
      <Row label="While solving">
        <Segmented<TimerUpdate> value={s.timerUpdate} options={[["realtime", "0.01"], ["tenths", "0.1"], ["seconds", "1s"], ["hidden", "Hide"]]} onChange={(v) => set({ timerUpdate: v })} />
      </Row>
      <Row label="Split phases" hint="Press any key mid solve to mark a phase">
        <Segmented
          value={preset}
          options={Object.keys(PHASE_PRESETS).map((k) => [k, k] as [string, string])}
          onChange={(k) => {
            const names = PHASE_PRESETS[k] ?? [];
            set({ phases: Math.max(1, names.length), phaseNames: names });
          }}
        />
      </Row>
    </Section>
  );
}

function DisplaySection() {
  const s = useStore((st) => st.settings);
  const set = (p: Partial<Settings>) => updateSettings(p);
  return (
    <Section title="Display">
      <Row label="Timer font">
        <Segmented<TimerFont> value={s.timerFont} options={[["sans", "Clean"], ["mono", "Mono"], ["digital", "Digital"]]} onChange={(v) => set({ timerFont: v })} />
      </Row>
      <Row label="Timer size">
        <input type="range" min={0.6} max={1.5} step={0.05} value={s.timerScale} onChange={(e) => set({ timerScale: Number(e.target.value) })} aria-label="Timer size" />
      </Row>
      <Row label="Three decimals">
        <Toggle label="Three decimals" value={s.showMs} onChange={(v) => set({ showMs: v })} />
      </Row>
    </Section>
  );
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function DataSection() {
  const count = useStore((s) => s.solves.length);
  const persistent = useStore((s) => s.persistent);
  const [pending, setPending] = useState<ImportResult | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const byProfile = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of pending?.solves ?? []) m.set(s.scrambleType, (m.get(s.scrambleType) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [pending]);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      setPending(importAny(await file.text()));
    } catch (e) {
      setPending(null);
      toast(e instanceof Error ? e.message : "Couldn't read that file.", { tone: "warning" });
    }
  };

  return (
    <Section title="Data">
      <Row label="Import" hint="A csTimer or KubeTimr export">
        <button className="btn btn--small" onClick={() => fileRef.current?.click()}>
          Choose file
        </button>
        <input ref={fileRef} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
      </Row>
      {pending && (
        <div className="import">
          <ul className="import__list">
            {byProfile.map(([type, n]) => (
              <li key={type}>
                <span>{getScrambleType(type).name}</span>
                <span className="muted">{n.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <button
              className="btn btn--primary btn--small"
              onClick={() => {
                const { added, skipped } = importData(pending);
                toast(skipped ? `Imported ${added.toLocaleString()} solves, ${skipped.toLocaleString()} were already here.` : `Imported ${added.toLocaleString()} solves.`);
                setPending(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              Import {pending.solves.length.toLocaleString()} solves
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      <Row label="Export" hint={`${count.toLocaleString()} solves${persistent ? ", saved in this browser" : ", storage unavailable here"}`}>
        <div className="row">
          <button className="btn btn--small" onClick={() => download(`kubetimr-${stamp()}.json`, exportBackup(getState()))}>
            Backup
          </button>
          <button className="btn btn--small" onClick={() => download(`cstimer-${stamp()}.txt`, exportCstimer(getState()), "text/plain")}>
            csTimer
          </button>
        </div>
      </Row>
      <Row label="Delete everything" hint="Every solve on every cube">
        {confirmReset ? (
          <div className="row">
            <button
              className="btn btn--danger btn--small"
              onClick={async () => {
                await resetAllData();
                setConfirmReset(false);
                toast("All solves deleted.", { tone: "warning" });
              }}
            >
              Yes, delete
            </button>
            <button className="btn btn--ghost btn--small" onClick={() => setConfirmReset(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn--ghost btn--small btn--danger-text" onClick={() => setConfirmReset(true)}>
            Delete
          </button>
        )}
      </Row>
    </Section>
  );
}
