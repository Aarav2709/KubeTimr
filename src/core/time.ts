import { DNF, Penalty, PLUS2 } from "./types";

// formats ms like cstimer and truncates like a stackmat
export function formatMs(ms: number | null, decimals: 2 | 3 | 1 | 0 = 2): string {
  if (ms == null) return "DNF";
  if (!Number.isFinite(ms)) return "DNF";
  const neg = ms < 0;
  let v = Math.abs(Math.floor(ms));
  const hours = Math.floor(v / 3_600_000);
  v -= hours * 3_600_000;
  const minutes = Math.floor(v / 60_000);
  v -= minutes * 60_000;
  const seconds = Math.floor(v / 1000);
  const millis = v - seconds * 1000;

  let frac = "";
  if (decimals === 3) frac = "." + String(millis).padStart(3, "0");
  else if (decimals === 2) frac = "." + String(Math.floor(millis / 10)).padStart(2, "0");
  else if (decimals === 1) frac = "." + String(Math.floor(millis / 100));

  let out: string;
  if (hours > 0) {
    out = `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${frac}`;
  } else if (minutes > 0) {
    out = `${minutes}:${String(seconds).padStart(2, "0")}${frac}`;
  } else {
    out = `${seconds}${frac}`;
  }
  return neg ? `-${out}` : out;
}

// solve result with its penalty
export function formatSolve(
  time: number,
  penalty: Penalty,
  opts: { decimals?: 2 | 3; dnfRaw?: boolean } = {},
): string {
  const d = opts.decimals ?? 2;
  if (penalty === DNF) return opts.dnfRaw ? `DNF(${formatMs(time, d)})` : "DNF";
  if (penalty === PLUS2) return `${formatMs(time + 2000, d)}+`;
  return formatMs(time, d);
}

// parses typed times like cstimer, 1234 is 12.34, a trailing plus is plus two
export function parseTimeEntry(input: string): { time: number; penalty: Penalty } | null {
  let s = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!s) return null;

  if (s.startsWith("DNF")) {
    const inner = s.match(/^DNF\((.+)\)$/);
    const t = inner ? parseClock(inner[1]!) : 0;
    return { time: t ?? 0, penalty: DNF };
  }

  let penalty: Penalty = 0;
  if (s.endsWith("+2")) {
    penalty = PLUS2;
    s = s.slice(0, -2);
  } else if (s.endsWith("+")) {
    penalty = PLUS2;
    s = s.slice(0, -1);
  }

  let time: number | null;
  if (/^\d+$/.test(s)) {
    // bare digits fill h:mm:ss.cc from the right
    const padded = s.padStart(3, "0");
    const cs = parseInt(padded.slice(-2), 10);
    const rest = padded.slice(0, -2);
    const secs = parseInt(rest.slice(-2), 10);
    const mins = rest.length > 2 ? parseInt(rest.slice(-4, -2), 10) : 0;
    const hrs = rest.length > 4 ? parseInt(rest.slice(0, -4), 10) : 0;
    time = ((hrs * 60 + mins) * 60 + secs) * 1000 + cs * 10;
  } else {
    time = parseClock(s);
  }
  if (time == null || time <= 0) return null;
  // a plus suffix keeps the raw time and adds the penalty
  return { time, penalty };
}

// parses ss.fff, m:ss.ff or h:mm:ss.ff into ms
export function parseClock(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+):)?(?:(\d+):)?(\d+)(?:\.(\d{1,3}))?$/);
  if (!m) return null;
  let h = 0;
  let min = 0;
  if (m[1] != null && m[2] != null) {
    h = parseInt(m[1], 10);
    min = parseInt(m[2], 10);
  } else if (m[1] != null) {
    min = parseInt(m[1], 10);
  }
  const sec = parseInt(m[3]!, 10);
  const frac = m[4] ? parseInt(m[4].padEnd(3, "0"), 10) : 0;
  return ((h * 60 + min) * 60 + sec) * 1000 + frac;
}

// short duration like 3h 12m
export function formatDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor(ms / 1000) % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
