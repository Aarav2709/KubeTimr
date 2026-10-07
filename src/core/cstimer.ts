import { getScrambleType, guessScrambleType, scrambleTypeFromCstimer } from "./events";
import { V1Data } from "./legacyTypes";
import { migrateV1 } from "./migrate";
import { parseClock } from "./time";
import { AppData, DNF, finalTime, newId, OK, Penalty, PLUS2, Settings, Solve } from "./types";

// cstimer json stores a solve as [[pen, time, splits newest first], scramble, comment, unix seconds]

export interface ImportResult {
  format: "cstimer-json" | "cstimer-txt" | "kubetimr" | "kubetimr-v1" | "plain";
  solves: Solve[];
  settings?: Settings;
}

type CsEntry = [unknown, unknown?, unknown?, unknown?, ...unknown[]];

function toPenalty(v: unknown): Penalty {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  if (n === -1) return DNF;
  if (n === 2000) return PLUS2;
  return OK;
}

function parseCsSessionData(raw: unknown): Record<string, { opt?: { scrType?: string } }> {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return typeof raw === "object" ? (raw as Record<string, never>) : {};
}

// every cstimer session lands in the profile of its scramble type
export function importCstimerJson(data: Record<string, unknown>): ImportResult {
  const props = (data.properties ?? {}) as Record<string, unknown>;
  const meta = parseCsSessionData(props.sessionData);
  const now = Date.now();
  const solves: Solve[] = [];

  for (const key of Object.keys(data)) {
    if (!/^session\d+$/.test(key)) continue;
    const entries = data[key];
    if (!Array.isArray(entries)) continue;
    const type = scrambleTypeFromCstimer(meta[key.slice(7)]?.opt?.scrType);
    for (const e of entries as CsEntry[]) {
      if (!Array.isArray(e) || !Array.isArray(e[0])) continue;
      const times = e[0] as unknown[];
      const time = Number(times[1]);
      if (!Number.isFinite(time) || time < 0) continue;
      const solve: Solve = {
        id: newId(),
        scrambleType: type.id,
        time: Math.round(time),
        penalty: toPenalty(times[0]),
        scramble: typeof e[1] === "string" ? e[1] : "",
        date: typeof e[3] === "number" && e[3] > 0 ? e[3] * 1000 : now,
      };
      if (times.length > 2) {
        const splits = times
          .slice(2)
          .map(Number)
          .filter((t) => Number.isFinite(t) && t > 0 && t < time)
          .sort((a, b) => a - b);
        if (splits.length) solve.splits = splits.map(Math.round);
      }
      solves.push(solve);
    }
  }
  solves.sort((a, b) => a.date - b.date);
  return { format: "cstimer-json", solves };
}

const TXT_LINE =
  /^\s*\d+\.\s+(DNF\(([^)]*)\)|DNF|(\d[\d:.]*)(\+)?)\s*(?:\[([^\]]*)\])?\s*(.*?)\s*(?:@(\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}))?\s*$/i;

// parses the cstimer time list text, or plain one time per line
export function importCstimerTxt(text: string): ImportResult {
  const now = Date.now();
  const solves: Solve[] = [];
  let plain = true;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let time: number | null = null;
    let penalty: Penalty = OK;
    let scramble = "";
    let date = now;

    const m = line.match(TXT_LINE);
    if (m) {
      plain = false;
      if (m[1]!.toUpperCase().startsWith("DNF")) {
        penalty = DNF;
        time = m[2] ? (parseClock(m[2]) ?? 0) : 0;
      } else {
        time = parseClock(m[3]!);
        if (m[4] && time != null) {
          penalty = PLUS2;
          // cstimer shows plus two times with the penalty already added
          time -= 2000;
        }
      }
      scramble = m[6] ?? "";
      if (m[7]) {
        const d = Date.parse(m[7].replace(" ", "T"));
        if (Number.isFinite(d)) date = d;
      }
    } else if (/^(DNF|\d[\d:.]*\+?)$/i.test(line)) {
      if (/^DNF$/i.test(line)) {
        penalty = DNF;
        time = 0;
      } else {
        time = parseClock(line.replace("+", ""));
        if (line.endsWith("+") && time != null) {
          penalty = PLUS2;
          time -= 2000;
        }
      }
    } else {
      continue;
    }
    if (time == null || time < 0) continue;
    solves.push({ id: newId(), scrambleType: "333", time: Math.round(time), penalty, scramble, date });
  }

  const type = guessScrambleType(solves.find((s) => s.scramble)?.scramble ?? "");
  for (const s of solves) s.scrambleType = type;
  return { format: plain ? "plain" : "cstimer-txt", solves };
}

// detects the file format and parses it
export function importAny(text: string): ImportResult {
  const trimmed = text.trim().replace(/^﻿/, "");
  if (trimmed.startsWith("{")) {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(trimmed);
    } catch {
      throw new Error("File looks like JSON but could not be parsed.");
    }
    if (data.app === "kubetimr" && Array.isArray(data.solves)) return importKubeTimrBackup(data);
    if (typeof data.schemaVersion === "number" && Array.isArray(data.solves)) {
      const m = migrateV1(data as unknown as V1Data);
      return { format: "kubetimr-v1", solves: m.solves, settings: m.settings };
    }
    if (Object.keys(data).some((k) => /^session\d+$/.test(k))) return importCstimerJson(data);
    throw new Error("Unrecognised JSON file. Expected a csTimer or KubeTimr export.");
  }
  const result = importCstimerTxt(trimmed);
  if (result.solves.length === 0) throw new Error("No solves found in this file.");
  return result;
}

function importKubeTimrBackup(data: Record<string, unknown>): ImportResult {
  const solves = (data.solves as Solve[])
    .filter((s) => s && Number.isFinite(s.time))
    .map((s) => ({ ...s, id: newId(), scrambleType: getScrambleType(s.scrambleType).id }));
  return { format: "kubetimr", solves, settings: data.settings as Settings | undefined };
}

export function exportBackup(data: AppData): string {
  return JSON.stringify({ app: "kubetimr", version: 3, exportedAt: new Date().toISOString(), solves: data.solves, settings: data.settings });
}

// one cstimer session per profile, readable by cstimer's import
export function exportCstimer(data: AppData): string {
  const out: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};
  const byType = new Map<string, Solve[]>();
  for (const s of data.solves) {
    const list = byType.get(s.scrambleType);
    if (list) list.push(s);
    else byType.set(s.scrambleType, [s]);
  }
  let idx = 0;
  let active = 1;
  for (const [typeId, list] of byType) {
    idx++;
    if (typeId === data.profile) active = idx;
    list.sort((a, b) => a.date - b.date);
    const type = getScrambleType(typeId);
    out[`session${idx}`] = list.map((s) => {
      const times: number[] = [s.penalty, s.time];
      if (s.splits?.length) times.push(...[...s.splits].reverse());
      return [times, s.scramble, "", Math.floor(s.date / 1000)];
    });
    const valid = list.map(finalTime).filter((t): t is number => t != null);
    sessionData[String(idx)] = {
      name: type.name,
      opt: type.id === "333" ? {} : { scrType: type.cstimer[0] },
      rank: idx,
      stat: [list.length, list.length - valid.length, valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : -1],
      date: [Math.floor(list[0]!.date / 1000), Math.floor(list[list.length - 1]!.date / 1000)],
    };
  }
  out.properties = { sessionData: JSON.stringify(sessionData), session: active, sessionN: idx };
  return JSON.stringify(out);
}

export function exportCsv(solves: readonly Solve[]): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const rows = ["No.,Time (ms),Penalty,Final (ms),Scramble,Date"];
  solves.forEach((s, i) => {
    const pen = s.penalty === DNF ? "DNF" : s.penalty === PLUS2 ? "+2" : "";
    const fin = finalTime(s);
    rows.push([i + 1, s.time, pen, fin ?? "", esc(s.scramble), new Date(s.date).toISOString()].join(","));
  });
  return rows.join("\n");
}

// key used to skip solves that are already stored when importing the same file twice
export function solveKey(s: Pick<Solve, "scrambleType" | "time" | "date">): string {
  return `${s.scrambleType}|${s.time}|${Math.floor(s.date / 1000)}`;
}
