import { InspectionAlert } from "../core/types";

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

export function beep(freq = 880, durationMs = 120, count = 1): void {
  const ac = ctx();
  if (!ac) return;
  for (let i = 0; i < count; i++) {
    const start = ac.currentTime + i * (durationMs / 1000 + 0.08);
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + durationMs / 1000);
    osc.connect(gain).connect(ac.destination);
    osc.start(start);
    osc.stop(start + durationMs / 1000 + 0.02);
  }
}

function speak(text: string): void {
  if (!("speechSynthesis" in window)) {
    beep();
    return;
  }
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.15;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// wca judges call 8 and 12 seconds during inspection
export function inspectionAlert(kind: InspectionAlert, second: 8 | 12): void {
  if (kind === "off") return;
  if (kind === "voice") speak(second === 8 ? "Eight seconds" : "Twelve seconds");
  else beep(second === 8 ? 660 : 990, 140, second === 8 ? 1 : 2);
}

// unlock audio on a user gesture so later calls are not blocked
export function primeAudio(): void {
  ctx();
}

