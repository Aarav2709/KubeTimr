// shape of the v1 blob in db "kubetimr", store "state", key "data", kept only for migration

export interface V1Solve {
  id: string;
  sessionId: string;
  puzzleId: string;
  scramble: { puzzleId: string; notation: string };
  timing: {
    rawDurationMs: number;
    inspectionDurationMs: number;
    penalty: "none" | "+2" | "dnf";
    finalDurationMs: number | null;
  };
  createdAt: string;
}

export interface V1Session {
  id: string;
  name: string;
  puzzleId: string;
  createdAt: string;
}

export interface V1SplitCapture {
  solveId: string;
  phases: { phase: string; timestampMs: number }[];
}

export interface V1Settings {
  inspectionEnabled?: boolean;
  hideTimeDuringSolve?: boolean;
  showMilliseconds?: boolean;
  splitPhases?: { name: string; order: number }[];
  trainingModeEnabled?: boolean;
}

export interface V1Data {
  schemaVersion: number;
  sessions: V1Session[];
  solves: V1Solve[];
  splits: V1SplitCapture[];
  settings?: V1Settings;
  activePuzzleId?: string;
}
