import React, { useState, useCallback, useRef, useEffect } from "react";
import { Solve, WcaEventId } from "../../types";
import CubeVisualization from "./CubeVisualization";

export interface VirtualReplayProps {
  solve: Solve;
  onClose: () => void;
}

interface ReplayMove {
  notation: string;
  timestamp: number;
}

// Placeholder for reconstruction data
// In a full implementation, this would parse actual move timestamps
function generateMockReconstruction(scramble: string, duration: number): ReplayMove[] {
  const scrambleMoves = scramble.split(" ").filter(Boolean);
  const avgMoveTime = duration / (scrambleMoves.length * 2 + 20); // Rough estimate

  // Generate solve moves (mock - in real app this would come from recorded data)
  const solveMoves = [
    "x2", "y", // Inspection
    "D", "R", "D'", "F2", // Cross
    "U", "R", "U'", "R'", // F2L 1
    "y", "U'", "R", "U", "R'", // F2L 2
    "U2", "L'", "U'", "L", // F2L 3
    "U", "R", "U'", "R'", "U", "R", "U'", "R'", // F2L 4
    "R", "U", "R'", "U", "R", "U2", "R'", // OLL
    "R", "U'", "R", "U", "R", "U", "R", "U'", "R'", "U'", "R2", // PLL
  ];

  let currentTime = 0;
  return solveMoves.map((move) => {
    currentTime += avgMoveTime * (0.5 + Math.random());
    return {
      notation: move,
      timestamp: currentTime,
    };
  });
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    zIndex: 200,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
  } as React.CSSProperties,

  modal: {
    backgroundColor: "var(--color-surface)",
    borderRadius: "12px",
    border: "1px solid var(--color-border)",
    maxWidth: "600px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid var(--color-border)",
  } as React.CSSProperties,

  title: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--color-text-primary)",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,

  closeBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "28px",
    height: "28px",
    backgroundColor: "var(--color-surface-raised)",
    border: "1px solid var(--color-border)",
    borderRadius: "6px",
    color: "var(--color-text-muted)",
    cursor: "pointer",
    transition: "all 100ms ease-out",
  } as React.CSSProperties,

  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "20px",
    gap: "16px",
    overflowY: "auto",
  } as React.CSSProperties,

  cubeContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  controls: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "12px 16px",
    backgroundColor: "var(--color-surface-raised)",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
  } as React.CSSProperties,

  controlBtn: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "36px",
    height: "36px",
    backgroundColor: "var(--color-surface)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "6px",
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    transition: "all 100ms ease-out",
  } as React.CSSProperties,

  controlBtnActive: {
    backgroundColor: "var(--color-focus)",
    borderColor: "var(--color-focus)",
    color: "white",
  } as React.CSSProperties,

  timeline: {
    flex: 1,
    height: "6px",
    backgroundColor: "var(--color-border)",
    borderRadius: "3px",
    cursor: "pointer",
    position: "relative",
    minWidth: "200px",
  } as React.CSSProperties,

  timelineProgress: {
    position: "absolute",
    top: 0,
    left: 0,
    height: "100%",
    backgroundColor: "var(--color-focus)",
    borderRadius: "3px",
    transition: "width 50ms linear",
  } as React.CSSProperties,

  timeDisplay: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--color-text-secondary)",
    minWidth: "60px",
    textAlign: "center",
  } as React.CSSProperties,

  speedControl: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    backgroundColor: "var(--color-surface)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    fontSize: "11px",
    color: "var(--color-text-muted)",
  } as React.CSSProperties,

  scrambleInfo: {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "var(--color-surface-raised)",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
  } as React.CSSProperties,

  scrambleLabel: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "6px",
  } as React.CSSProperties,

  scrambleText: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--color-text-primary)",
    lineHeight: 1.5,
    wordBreak: "break-all",
  } as React.CSSProperties,

  moveSequence: {
    width: "100%",
    padding: "12px 16px",
    backgroundColor: "var(--color-surface-raised)",
    borderRadius: "8px",
    border: "1px solid var(--color-border)",
  } as React.CSSProperties,

  moveLabel: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: "8px",
  } as React.CSSProperties,

  moves: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  } as React.CSSProperties,

  move: {
    padding: "2px 6px",
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    backgroundColor: "var(--color-surface)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "3px",
    color: "var(--color-text-secondary)",
    transition: "all 100ms ease-out",
  } as React.CSSProperties,

  moveActive: {
    backgroundColor: "var(--color-focus)",
    borderColor: "var(--color-focus)",
    color: "white",
  } as React.CSSProperties,

  movePast: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    borderColor: "rgba(96, 165, 250, 0.3)",
    color: "var(--color-text-primary)",
  } as React.CSSProperties,

  placeholder: {
    textAlign: "center",
    padding: "40px 20px",
    color: "var(--color-text-muted)",
    fontSize: "13px",
  } as React.CSSProperties,
};

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

export function VirtualReplay({ solve, onClose }: VirtualReplayProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(3); // 1x default
  const [appliedMoves, setAppliedMoves] = useState<string[]>([]);

  const animationRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const pausedTimeRef = useRef<number>(0);

  const duration = solve.timing.finalDurationMs ?? solve.timing.rawDurationMs;
  const scramble = solve.scramble.notation;
  const puzzleId = solve.scramble.puzzleId as WcaEventId;

  // Generate mock reconstruction (in real app, this would come from recorded data)
  const reconstruction = React.useMemo(
    () => generateMockReconstruction(scramble, duration),
    [scramble, duration]
  );

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((ms % 1000) / 10);
    const minutes = Math.floor(totalSeconds / 60);
    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, "0")}.${centiseconds.toString().padStart(2, "0")}`;
    }
    return `${seconds}.${centiseconds.toString().padStart(2, "0")}`;
  };

  const updatePlayback = useCallback(() => {
    if (!isPlaying) return;

    const speed = SPEEDS[speedIndex] ?? 1;
    const elapsed = (Date.now() - startTimeRef.current) * speed;
    const newTime = Math.min(pausedTimeRef.current + elapsed, duration);
    setCurrentTime(newTime);

    // Find current move
    let moveIdx = -1;
    for (let i = 0; i < reconstruction.length; i++) {
      const move = reconstruction[i];
      if (move && move.timestamp <= newTime) {
        moveIdx = i;
      } else {
        break;
      }
    }
    setCurrentMoveIndex(moveIdx);

    // Update applied moves for cube
    const newAppliedMoves = reconstruction
      .slice(0, moveIdx + 1)
      .map((m) => m.notation);
    setAppliedMoves(newAppliedMoves);

    if (newTime >= duration) {
      setIsPlaying(false);
    } else {
      animationRef.current = requestAnimationFrame(updatePlayback);
    }
  }, [isPlaying, speedIndex, duration, reconstruction]);

  useEffect(() => {
    if (isPlaying) {
      startTimeRef.current = Date.now();
      animationRef.current = requestAnimationFrame(updatePlayback);
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, updatePlayback]);

  const handlePlayPause = () => {
    if (isPlaying) {
      pausedTimeRef.current = currentTime;
      setIsPlaying(false);
    } else {
      if (currentTime >= duration) {
        // Reset if at end
        setCurrentTime(0);
        setCurrentMoveIndex(-1);
        setAppliedMoves([]);
        pausedTimeRef.current = 0;
      }
      setIsPlaying(true);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    setCurrentMoveIndex(-1);
    setAppliedMoves([]);
    pausedTimeRef.current = 0;
  };

  const handleStepBack = () => {
    if (currentMoveIndex >= 0) {
      const newIdx = currentMoveIndex - 1;
      const prevMove = newIdx >= 0 ? reconstruction[newIdx] : null;
      const newTime = prevMove ? prevMove.timestamp : 0;
      setCurrentMoveIndex(newIdx);
      setCurrentTime(newTime);
      pausedTimeRef.current = newTime;
      setAppliedMoves(reconstruction.slice(0, newIdx + 1).map((m) => m.notation));
    }
  };

  const handleStepForward = () => {
    if (currentMoveIndex < reconstruction.length - 1) {
      const newIdx = currentMoveIndex + 1;
      const nextMove = reconstruction[newIdx];
      if (nextMove) {
        const newTime = nextMove.timestamp;
        setCurrentMoveIndex(newIdx);
        setCurrentTime(newTime);
        pausedTimeRef.current = newTime;
        setAppliedMoves(reconstruction.slice(0, newIdx + 1).map((m) => m.notation));
      }
    }
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const newTime = percent * duration;

    setCurrentTime(newTime);
    pausedTimeRef.current = newTime;

    // Find move at this time
    let moveIdx = -1;
    for (let i = 0; i < reconstruction.length; i++) {
      const move = reconstruction[i];
      if (move && move.timestamp <= newTime) {
        moveIdx = i;
      } else {
        break;
      }
    }
    setCurrentMoveIndex(moveIdx);
    setAppliedMoves(reconstruction.slice(0, moveIdx + 1).map((m) => m.notation));
  };

  const handleSpeedChange = (delta: number) => {
    const newIndex = Math.max(0, Math.min(SPEEDS.length - 1, speedIndex + delta));
    setSpeedIndex(newIndex);
  };

  // Build current scramble + applied moves
  const currentScrambleState = scramble + " " + appliedMoves.join(" ");

  // Support all NxN cubes
  const isSupported = ["222", "333", "444", "555", "666", "777"].includes(puzzleId);

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Virtual Replay</span>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            aria-label="Close replay"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={styles.content as React.CSSProperties}>
          {isSupported ? (
            <>
              <div style={styles.cubeContainer}>
                <CubeVisualization
                  scramble={currentScrambleState}
                  puzzleId={puzzleId}
                  size={200}
                  interactive={!isPlaying}
                />
              </div>

              <div style={styles.controls}>
                <button
                  style={styles.controlBtn}
                  onClick={handleReset}
                  title="Reset"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>

                <button
                  style={styles.controlBtn}
                  onClick={handleStepBack}
                  title="Previous move"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
                    <line x1="5" y1="19" x2="5" y2="5" />
                  </svg>
                </button>

                <button
                  style={{
                    ...styles.controlBtn,
                    ...(isPlaying ? styles.controlBtnActive : {}),
                  }}
                  onClick={handlePlayPause}
                  title={isPlaying ? "Pause" : "Play"}
                >
                  {isPlaying ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <button
                  style={styles.controlBtn}
                  onClick={handleStepForward}
                  title="Next move"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>

                <div
                  style={styles.timeline as React.CSSProperties}
                  onClick={handleTimelineClick}
                >
                  <div
                    style={{
                      ...styles.timelineProgress,
                      width: `${(currentTime / duration) * 100}%`,
                    } as React.CSSProperties}
                  />
                </div>

                <span style={styles.timeDisplay as React.CSSProperties}>
                  {formatTime(currentTime)}
                </span>

                <div style={styles.speedControl}>
                  <button
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px" }}
                    onClick={() => handleSpeedChange(-1)}
                  >
                    −
                  </button>
                  <span style={{ minWidth: "32px", textAlign: "center" }}>
                    {SPEEDS[speedIndex]}x
                  </span>
                  <button
                    style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", padding: "2px" }}
                    onClick={() => handleSpeedChange(1)}
                  >
                    +
                  </button>
                </div>
              </div>

              <div style={styles.scrambleInfo}>
                <div style={styles.scrambleLabel}>Scramble</div>
                <div style={styles.scrambleText}>{scramble}</div>
              </div>

              <div style={styles.moveSequence}>
                <div style={styles.moveLabel}>
                  Solution ({reconstruction.length} moves)
                </div>
                <div style={styles.moves as React.CSSProperties}>
                  {reconstruction.map((move, idx) => (
                    <span
                      key={idx}
                      style={{
                        ...styles.move,
                        ...(idx === currentMoveIndex ? styles.moveActive : {}),
                        ...(idx < currentMoveIndex ? styles.movePast : {}),
                      }}
                    >
                      {move.notation}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div style={styles.placeholder as React.CSSProperties}>
              <p>Virtual replay is currently only available for cube puzzles (2×2 to 7×7).</p>
              <p style={{ marginTop: "8px", fontSize: "12px", color: "var(--color-text-disabled)" }}>
                Support for other puzzles coming soon.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default VirtualReplay;
