import { getScrambleType } from "./events";
import { V1Data } from "./legacyTypes";
import { DEFAULT_SETTINGS, DNF, OK, Penalty, PLUS2, Settings, Solve } from "./types";

function v1Penalty(p: string | undefined): Penalty {
  if (p === "dnf") return DNF;
  if (p === "+2") return PLUS2;
  return OK;
}

function parseDate(iso: string | undefined, fallback: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? t : fallback;
}

// v1 puzzle ids are already valid profile ids, anything unknown lands in 3x3
function profileOf(puzzleId: string | undefined): string {
  return puzzleId && getScrambleType(puzzleId).id === puzzleId ? puzzleId : "333";
}

// converts a v1 blob into solves and settings without dropping anything
export function migrateV1(data: V1Data): { solves: Solve[]; settings: Settings; profile: string } {
  const now = Date.now();
  const splitsBySolve = new Map((data.splits ?? []).map((c) => [c.solveId, c]));
  const sessionPuzzle = new Map((data.sessions ?? []).map((s) => [s.id, s.puzzleId]));

  const solves: Solve[] = [];
  for (const s of data.solves ?? []) {
    if (!s?.timing) continue;
    const solve: Solve = {
      id: s.id,
      scrambleType: profileOf(s.puzzleId ?? sessionPuzzle.get(s.sessionId)),
      time: Math.round(s.timing.rawDurationMs ?? 0),
      penalty: v1Penalty(s.timing.penalty),
      scramble: s.scramble?.notation ?? "",
      date: parseDate(s.createdAt, now),
    };
    if (s.timing.inspectionDurationMs) solve.inspection = Math.round(s.timing.inspectionDurationMs);
    // v1 stored phase marks, keep the ones strictly inside the solve as boundaries
    const capture = splitsBySolve.get(s.id);
    if (capture && capture.phases.length > 1) {
      const marks = capture.phases
        .map((p) => Math.round(p.timestampMs))
        .filter((t) => t > 0 && t < solve.time)
        .sort((a, b) => a - b);
      if (marks.length) solve.splits = marks;
    }
    solves.push(solve);
  }
  solves.sort((a, b) => a.date - b.date);

  const old = data.settings ?? {};
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    inspection: old.inspectionEnabled ?? DEFAULT_SETTINGS.inspection,
    timerUpdate: old.hideTimeDuringSolve ? "hidden" : DEFAULT_SETTINGS.timerUpdate,
    showMs: old.showMilliseconds ?? DEFAULT_SETTINGS.showMs,
  };
  if (old.trainingModeEnabled && old.splitPhases && old.splitPhases.length > 1) {
    const names = [...old.splitPhases].sort((a, b) => a.order - b.order).map((p) => p.name);
    settings.phases = names.length;
    settings.phaseNames = names;
  }

  return { solves, settings, profile: profileOf(data.activePuzzleId) };
}
