import { computeSessionStats, SessionStats } from "../core/stats";
import { Solve, STAT_KEYS, TRIM_PERCENT } from "../core/types";
import { selectProfileSolves, State, useStore } from "./store";

let cacheSolves: Solve[] | null = null;
let cacheStats: SessionStats | null = null;

export function selectStats(s: State): SessionStats {
  const solves = selectProfileSolves(s);
  if (cacheStats && solves === cacheSolves) return cacheStats;
  cacheSolves = solves;
  cacheStats = computeSessionStats(solves, STAT_KEYS, TRIM_PERCENT);
  return cacheStats;
}

export function useStats(): SessionStats {
  return useStore(selectStats);
}
