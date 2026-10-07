import { useCallback, useEffect, useRef, useState } from "react";
import type { TwistyPlayer } from "cubing/twisty";
import { getScrambleType } from "../../core/events";
import { Solution, solutionFor } from "../../core/scramble";
import { useStore } from "../../state/store";
import { cleanAlg, playerConfig } from "../twisty";
import { Icon, Modal } from "./Modal";

type Mode = "scramble" | "solve";

// inverts one move, a static cubing/alg import would pull cubing into the entry chunk its worker loads
export function invertMove(m: string): string {
  if (m.endsWith("++")) return `${m.slice(0, -2)}--`;
  if (m.endsWith("--")) return `${m.slice(0, -2)}++`;
  if (m.endsWith("2'")) return m.slice(0, -1);
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return `${m}'`;
}
const SPEEDS = [0.5, 1, 2];

// walks through the scramble or a solution one move at a time
export function Guide() {
  const scramble = useStore((s) => s.scramble);
  const type = getScrambleType(scramble.type);
  const [mode, setMode] = useState<Mode>("scramble");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [ready, setReady] = useState(false);
  const [tick, setTick] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  // id of the running single move animation, 0 when idle
  const animating = useRef(0);
  const autoplayRef = useRef(false);
  autoplayRef.current = autoplay;

  const scrambleAlg = cleanAlg(scramble.text);
  const base = mode === "scramble" ? "" : scrambleAlg;
  const moveText = mode === "scramble" ? scrambleAlg : (solution?.moves ?? "");
  const loading = mode === "solve" && !solution;
  const movesRef = useRef<string[]>([]);
  movesRef.current = moveText ? moveText.split(" ") : [];
  const total = movesRef.current.length;

  useEffect(() => {
    if (mode !== "solve" || solution) return;
    let cancelled = false;
    void solutionFor(scramble.type, scramble.text).then((s) => !cancelled && setSolution(s));
    return () => {
      cancelled = true;
    };
  }, [mode, solution, scramble.type, scramble.text]);

  useEffect(() => {
    let cancelled = false;
    import("cubing/twisty").then(({ TwistyPlayer }) => {
      if (cancelled || !hostRef.current) return;
      const player = new TwistyPlayer(playerConfig(scramble.type));
      player.className = "twisty";
      hostRef.current.replaceChildren(player);
      playerRef.current = player;
      setReady(true);
    });
    return () => {
      cancelled = true;
      playerRef.current = null;
      hostRef.current?.replaceChildren();
    };
  }, [scramble.type]);

  // shows the state after the first i moves without animating
  const show = useCallback(
    (i: number) => {
      const p = playerRef.current;
      if (!p) return;
      animating.current = 0;
      p.experimentalSetupAlg = [base, ...movesRef.current.slice(0, i)].join(" ").trim();
      p.alg = "";
      setIndex(i);
    },
    [base],
  );

  useEffect(() => {
    if (!ready) return;
    setAutoplay(false);
    show(0);
  }, [ready, mode, moveText, show]);

  useEffect(() => {
    if (playerRef.current) playerRef.current.tempoScale = speed;
  }, [speed, ready]);

  // animates exactly one move forward or back from the current index
  const step = useCallback(
    (dir: 1 | -1) => {
      const p = playerRef.current;
      const moves = movesRef.current;
      if (!p) return;
      const target = index + dir;
      if (target < 0 || target > moves.length) return;
      p.experimentalSetupAlg = [base, ...moves.slice(0, index)].join(" ").trim();
      p.alg = dir === 1 ? moves[index]! : invertMove(moves[index - 1]!);
      p.jumpToStart({ flash: false });
      const id = Date.now() + Math.random();
      animating.current = id;
      p.play();
      setIndex(target);
      // polling the timeline is more reliable than the playing event for back to back moves
      const poll = async () => {
        if (animating.current !== id) return;
        const info = await p.experimentalModel.coarseTimelineInfo.get();
        if (animating.current !== id) return;
        if (info.playing || !info.atEnd) return void setTimeout(poll, 40);
        animating.current = 0;
        setTick((t) => t + 1);
      };
      setTimeout(poll, 40);
    },
    [index, base],
  );

  // when one move finishes, autoplay starts the next
  useEffect(() => {
    if (!autoplayRef.current) return;
    if (index >= movesRef.current.length) setAutoplay(false);
    else step(1);
  }, [tick]);

  const togglePlay = useCallback(() => {
    if (autoplay) return setAutoplay(false);
    if (index >= total) show(0);
    setAutoplay(true);
    setTick((t) => t + 1);
  }, [autoplay, index, total, show]);

  const manual = (dir: 1 | -1) => {
    setAutoplay(false);
    step(dir);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "ArrowRight") manual(1);
      else if (e.code === "ArrowLeft") manual(-1);
      else if (e.code === "Space") togglePlay();
      else if (e.code === "Home") show(0);
      else if (e.code === "End") show(total);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const tabs = (
    <div className="segmented" role="radiogroup" aria-label="Guide">
      <button role="radio" aria-checked={mode === "scramble"} className={mode === "scramble" ? "is-on" : ""} onClick={() => setMode("scramble")}>
        Scramble
      </button>
      <button role="radio" aria-checked={mode === "solve"} className={mode === "solve" ? "is-on" : ""} onClick={() => setMode("solve")}>
        Solve
      </button>
    </div>
  );

  return (
    <Modal title={type.name} actions={tabs} size="md">
      <div className="guide">

        <div className="guide__stage">
          <div className="guide__host" ref={hostRef} />
        </div>

        <div className="guide__now" aria-live="polite">
          <span className="guide__move">{loading ? "…" : index > 0 ? movesRef.current[index - 1] : "Start"}</span>
          <span className="guide__count">{loading ? "Finding a solution" : `Step ${index} of ${total}`}</span>
        </div>

        <div className="guide__controls">
          <button className="icon-btn" onClick={() => show(0)} disabled={loading || index === 0} aria-label="Back to start" title="Start (Home)">
            <Icon name="first" />
          </button>
          <button className="icon-btn" onClick={() => manual(-1)} disabled={loading || index === 0} aria-label="Previous move" title="Previous (←)">
            <Icon name="prev" />
          </button>
          <button className="guide__play" onClick={togglePlay} disabled={loading} aria-label={autoplay ? "Pause" : "Play"} title="Play (Space)">
            <Icon name={autoplay ? "pause" : "play"} size={18} />
          </button>
          <button className="icon-btn" onClick={() => manual(1)} disabled={loading || index >= total} aria-label="Next move" title="Next (→)">
            <Icon name="next" />
          </button>
          <button className="icon-btn" onClick={() => show(total)} disabled={loading || index >= total} aria-label="Jump to end" title="End (End)">
            <Icon name="last" />
          </button>
        </div>

        <div className="segmented segmented--small" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button key={s} className={speed === s ? "is-on" : ""} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
