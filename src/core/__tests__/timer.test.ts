import { describe, expect, it } from "vitest";
import { initialTimerState, TimerConfig, TimerEvent, timerReducer, TimerState } from "../timer";

function run(events: TimerEvent[], config: Partial<TimerConfig> = {}): TimerState {
  const cfg: TimerConfig = { holdTime: 300, inspection: false, phases: 1, ...config };
  return events.reduce((s, e) => timerReducer(s, e, cfg), initialTimerState);
}

describe("timer state machine", () => {
  it("requires holding before it starts", () => {
    const early = run([
      { type: "press", now: 0 },
      { type: "tick", now: 100 },
      { type: "release", now: 150 },
    ]);
    expect(early.phase).toBe("idle");

    const ok = run([
      { type: "press", now: 0 },
      { type: "tick", now: 320 },
      { type: "release", now: 400 },
    ]);
    expect(ok.phase).toBe("running");
    expect(ok.runStart).toBe(400);
  });

  it("zero hold time is immediately ready", () => {
    const s = run([{ type: "press", now: 0 }, { type: "release", now: 10 }], { holdTime: 0 });
    expect(s.phase).toBe("running");
  });

  it("stops on press and records the time", () => {
    const s = run([
      { type: "press", now: 0 },
      { type: "tick", now: 300 },
      { type: "release", now: 1000 },
      { type: "press", now: 13_345.6 },
    ]);
    expect(s.phase).toBe("stopped");
    expect(s.result).toEqual({ time: 12_346, penalty: 0 });
  });

  it("goes through inspection and requires a hold to start from inspection", () => {
    const cfg = { inspection: true };
    let s = run(
      [
        { type: "press", now: 0 },
        { type: "tick", now: 300 },
        { type: "release", now: 1000 },
      ],
      cfg,
    );
    expect(s.phase).toBe("inspection");
    expect(s.inspectionStart).toBe(1000);
    // a quick tap during inspection must not start the solve
    s = [
      { type: "press", now: 5000 } as TimerEvent,
      { type: "release", now: 5100 } as TimerEvent,
    ].reduce((st, e) => timerReducer(st, e, { holdTime: 300, inspection: true, phases: 1 }), s);
    expect(s.phase).toBe("inspection");
  });

  it("applies +2 for 15–17s inspection", () => {
    const s = run(
      [
        { type: "press", now: 0 },
        { type: "tick", now: 300 },
        { type: "release", now: 1000 },
        { type: "press", now: 16_000 },
        { type: "tick", now: 16_300 },
        { type: "release", now: 16_500 },
        { type: "press", now: 26_500 },
      ],
      { inspection: true },
    );
    expect(s.result).toEqual({ time: 10_000, penalty: 2000, inspection: 15_500 });
  });

  it("auto-DNFs after 17s of inspection", () => {
    const s = run(
      [
        { type: "press", now: 0 },
        { type: "tick", now: 300 },
        { type: "release", now: 1000 },
        { type: "tick", now: 18_001 },
      ],
      { inspection: true },
    );
    expect(s.phase).toBe("stopped");
    expect(s.result?.penalty).toBe(-1);
  });

  it("records multi-phase splits", () => {
    const s = run(
      [
        { type: "press", now: 0 },
        { type: "tick", now: 300 },
        { type: "release", now: 1000 },
        { type: "press", now: 3000 },
        { type: "press", now: 8000 },
        { type: "press", now: 10_000 },
      ],
      { phases: 3 },
    );
    expect(s.phase).toBe("stopped");
    expect(s.result).toEqual({ time: 9000, penalty: 0, splits: [2000, 7000] });
  });

  it("cancel during inspection returns to idle without a result", () => {
    const s = run(
      [
        { type: "press", now: 0 },
        { type: "tick", now: 300 },
        { type: "release", now: 1000 },
        { type: "cancel" },
      ],
      { inspection: true },
    );
    expect(s.phase).toBe("idle");
    expect(s.result).toBeNull();
  });

  it("a hold after a solve that is released early returns to stopped and keeps the result", () => {
    const s = run([
      { type: "press", now: 0 },
      { type: "tick", now: 300 },
      { type: "release", now: 1000 },
      { type: "press", now: 2000 },
      { type: "release", now: 2100 },
      { type: "press", now: 3000 },
      { type: "release", now: 3050 },
    ]);
    expect(s.phase).toBe("stopped");
    expect(s.result?.time).toBe(1000);
  });
});
