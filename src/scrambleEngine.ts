import { randomScrambleForEvent } from "cubing/scramble";
import {
  PuzzleId,
  Scramble,
  ScrambleRequest,
  Scrambler,
  WcaEventId,
} from "./types";

const WCA_EVENT_MAP: Record<WcaEventId, string> = {
  "222": "222",
  "333": "333",
  "444": "444",
  "555": "555",
  "666": "666",
  "777": "777",
  pyram: "pyram",
  skewb: "skewb",
  sq1: "sq1",
  clock: "clock",
  minx: "minx",
};

const scrambleCache = new Map<PuzzleId, Promise<string>>();

async function fetchWCAScramble(puzzleId: WcaEventId): Promise<string> {
  const eventId = WCA_EVENT_MAP[puzzleId];
  if (!eventId) {
    throw new Error(`Unknown puzzle: ${puzzleId}`);
  }
  const scramble = await randomScrambleForEvent(eventId);
  return scramble.toString();
}

function prefetchScramble(puzzleId: WcaEventId): void {
  if (scrambleCache.has(puzzleId)) return;
  scrambleCache.set(puzzleId, fetchWCAScramble(puzzleId));
}

async function getScrambleAsync(puzzleId: WcaEventId): Promise<string> {
  const cached = scrambleCache.get(puzzleId);
  if (cached) {
    scrambleCache.delete(puzzleId);
    prefetchScramble(puzzleId);
    return cached;
  }
  prefetchScramble(puzzleId);
  const result = await scrambleCache.get(puzzleId)!;
  scrambleCache.delete(puzzleId);
  prefetchScramble(puzzleId);
  return result;
}

let currentScramblePromise: Promise<Scramble> | null = null;
let lastPuzzleId: PuzzleId | null = null;

function createScrambler(puzzleId: WcaEventId): Scrambler {
  return {
    puzzleId,
    generate: (request: ScrambleRequest): Scramble => {
      return {
        puzzleId: request.puzzleId,
        notation: "",
        state: { kind: "wca-random-state", pending: true },
      };
    },
  };
}

const scramblers = new Map<PuzzleId, Scrambler>();

for (const puzzleId of Object.keys(WCA_EVENT_MAP) as WcaEventId[]) {
  scramblers.set(puzzleId, createScrambler(puzzleId));
}

export function registerScrambler(scrambler: Scrambler): void {
  scramblers.set(scrambler.puzzleId, scrambler);
}

export function getScrambler(puzzleId: PuzzleId): Scrambler | undefined {
  return scramblers.get(puzzleId);
}

export function generateScramble(request: ScrambleRequest): Scramble {
  const puzzleId = request.puzzleId as WcaEventId;

  if (WCA_EVENT_MAP[puzzleId]) {
    return {
      puzzleId,
      notation: "",
      state: { kind: "wca-random-state", pending: true },
    };
  }

  const scrambler = scramblers.get(puzzleId);
  if (scrambler) {
    return scrambler.generate(request);
  }

  return {
    puzzleId,
    notation: "",
    state: { kind: "unknown" },
  };
}

export async function generateScrambleAsync(
  puzzleId: PuzzleId,
  forceNew: boolean = true,
): Promise<Scramble> {
  const wcaEventId = puzzleId as WcaEventId;

  if (!WCA_EVENT_MAP[wcaEventId]) {
    return generateScramble({ puzzleId });
  }

  // Always generate a new scramble when forceNew is true (default)
  // or when the puzzle changed
  if (!forceNew && currentScramblePromise && lastPuzzleId === puzzleId) {
    return currentScramblePromise;
  }

  lastPuzzleId = puzzleId;

  currentScramblePromise = (async () => {
    const notation = await getScrambleAsync(wcaEventId);
    return {
      puzzleId,
      notation,
      state: { kind: "wca-random-state" },
    };
  })();

  return currentScramblePromise;
}

export function initScrambleEngine(): void {
  for (const puzzleId of Object.keys(WCA_EVENT_MAP) as WcaEventId[]) {
    prefetchScramble(puzzleId);
  }
}

initScrambleEngine();
