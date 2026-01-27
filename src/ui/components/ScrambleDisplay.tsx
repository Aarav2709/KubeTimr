import React, {
  useEffect,
  useMemo,
  useState,
} from "react";
import { PuzzleId, Scramble } from "../../types";
import ScrambleVisualizationModal from "./ScrambleVisualizationModal";

export interface ScrambleDisplayProps {
  scramble: Scramble | null;
  activePuzzleId: PuzzleId;
  onPuzzleChange: (puzzleId: PuzzleId) => void;
  onRefresh: () => void;
  disabled?: boolean;
  loading?: boolean;
  showImage?: boolean;
}

type CubeEventId = "222" | "333" | "444" | "555" | "666" | "777";

const PUZZLE_LABELS: Record<CubeEventId, string> = {
  "222": "2×2",
  "333": "3×3",
  "444": "4×4",
  "555": "5×5",
  "666": "6×6",
  "777": "7×7",
};

// Icon components for each puzzle type
const PUZZLE_ICONS: Record<CubeEventId, (active: boolean) => React.ReactNode> = {
  "222": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round">
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  ),
  "333": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round">
      <rect x="3" y="3" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="3" width="5" height="5" rx="0.5" />
      <rect x="16" y="3" width="5" height="5" rx="0.5" />
      <rect x="3" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="16" y="9.5" width="5" height="5" rx="0.5" />
      <rect x="3" y="16" width="5" height="5" rx="0.5" />
      <rect x="9.5" y="16" width="5" height="5" rx="0.5" />
      <rect x="16" y="16" width="5" height="5" rx="0.5" />
    </svg>
  ),
  "444": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.8 : 1.3} strokeLinecap="round">
      <rect x="2" y="2" width="4.5" height="4.5" rx="0.3" />
      <rect x="7.5" y="2" width="4.5" height="4.5" rx="0.3" />
      <rect x="13" y="2" width="4.5" height="4.5" rx="0.3" />
      <rect x="18.5" y="2" width="3.5" height="4.5" rx="0.3" />
      <rect x="2" y="7.5" width="4.5" height="4.5" rx="0.3" />
      <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="0.3" />
      <rect x="13" y="7.5" width="4.5" height="4.5" rx="0.3" />
      <rect x="18.5" y="7.5" width="3.5" height="4.5" rx="0.3" />
      <rect x="2" y="13" width="4.5" height="4.5" rx="0.3" />
      <rect x="7.5" y="13" width="4.5" height="4.5" rx="0.3" />
      <rect x="13" y="13" width="4.5" height="4.5" rx="0.3" />
      <rect x="18.5" y="13" width="3.5" height="4.5" rx="0.3" />
      <rect x="2" y="18.5" width="4.5" height="3.5" rx="0.3" />
      <rect x="7.5" y="18.5" width="4.5" height="3.5" rx="0.3" />
      <rect x="13" y="18.5" width="4.5" height="3.5" rx="0.3" />
      <rect x="18.5" y="18.5" width="3.5" height="3.5" rx="0.3" />
    </svg>
  ),
  "555": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round">
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" stroke="none">5</text>
      <rect x="2" y="2" width="20" height="20" rx="2" />
    </svg>
  ),
  "666": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round">
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" stroke="none">6</text>
      <rect x="2" y="2" width="20" height="20" rx="2" />
    </svg>
  ),
  "777": (active) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.5 : 1} strokeLinecap="round">
      <text x="12" y="16" textAnchor="middle" fontSize="11" fontWeight="bold" fill="currentColor" stroke="none">7</text>
      <rect x="2" y="2" width="20" height="20" rx="2" />
    </svg>
  ),
};

const PUZZLE_ORDER: CubeEventId[] = [
  "333",
  "222",
  "444",
  "555",
  "666",
  "777",
];

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    width: "100%",
    maxWidth: "700px",
  } as React.CSSProperties,

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    width: "100%",
  } as React.CSSProperties,

  // Modern horizontal puzzle selector
  puzzleSelectorContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "4px",
    backgroundColor: "var(--color-surface)",
    borderRadius: "12px",
    border: "1px solid var(--color-border)",
    flexWrap: "wrap",
  } as React.CSSProperties,

  puzzleChip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "6px 10px",
    fontSize: "11px",
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    backgroundColor: "transparent",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
    outline: "none",
    minWidth: "52px",
    position: "relative",
    overflow: "hidden",
  } as React.CSSProperties,

  puzzleChipActive: {
    color: "var(--color-text-primary)",
    backgroundColor: "var(--color-surface-raised)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.05)",
  } as React.CSSProperties,

  puzzleChipHover: {
    color: "var(--color-text-secondary)",
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  } as React.CSSProperties,

  puzzleChipDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  } as React.CSSProperties,

  scrambleContainer: {
    width: "100%",
    textAlign: "center",
    padding: "0 12px",
    minHeight: "40px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as React.CSSProperties,

  scrambleText: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--scramble-font-size)",
    fontWeight: "var(--scramble-font-weight)",
    color: "var(--color-text-primary)",
    lineHeight: "var(--scramble-line-height)",
    letterSpacing: "var(--scramble-letter-spacing)",
    wordBreak: "break-word",
    hyphens: "none",
    maxWidth: "520px",
    margin: "0 auto",
    opacity: 0.95,
  } as React.CSSProperties,

  scrambleTextMultiLine: {
    whiteSpace: "pre-wrap",
    fontSize: "var(--text-sm)",
    lineHeight: 1.65,
  } as React.CSSProperties,

  scrambleLoading: {
    color: "var(--color-text-muted)",
    fontSize: "var(--text-sm)",
    fontFamily: "var(--font-ui)",
    fontWeight: 450,
    letterSpacing: "0.01em",
  } as React.CSSProperties,
};

function formatScramble(notation: string): string {
  // Normalize whitespace and return as single line
  return notation.replace(/\s+/g, " ").trim();
}

export function ScrambleDisplay({
  scramble,
  activePuzzleId,
  onPuzzleChange,
  onRefresh,
  disabled = false,
  loading = false,
  showImage = true,
}: ScrambleDisplayProps) {
  const [hoveredPuzzle, setHoveredPuzzle] = useState<CubeEventId | null>(null);
  const [showVisualizationModal, setShowVisualizationModal] = useState(false);

  // Close visualization modal on Escape
  useEffect(() => {
    if (!showVisualizationModal) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setShowVisualizationModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showVisualizationModal]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.code === "KeyR" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        // Blur any focused button before refreshing
        if (document.activeElement instanceof HTMLButtonElement) {
          document.activeElement.blur();
        }
        onRefresh();
      }

      // Arrow keys to navigate puzzles
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        const currentIndex = PUZZLE_ORDER.indexOf(activePuzzleId as CubeEventId);
        if (currentIndex === -1) return;

        let newIndex: number;
        if (e.code === "ArrowLeft") {
          newIndex = currentIndex > 0 ? currentIndex - 1 : PUZZLE_ORDER.length - 1;
        } else {
          newIndex = currentIndex < PUZZLE_ORDER.length - 1 ? currentIndex + 1 : 0;
        }
        const nextPuzzle = PUZZLE_ORDER[newIndex];
        if (nextPuzzle) {
          onPuzzleChange(nextPuzzle);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRefresh, disabled, activePuzzleId, onPuzzleChange]);

  const scrambleText = useMemo(
    () => (scramble?.notation ? formatScramble(scramble.notation) : ""),
    [scramble],
  );
  const hasScramble = scrambleText.length > 0;

  return (
    <div style={styles.container}>
      {/* Top row: puzzle selector + 3D view button */}
      <div style={styles.topRow}>
        {/* Modern horizontal puzzle chip selector */}
        <div style={styles.puzzleSelectorContainer} role="tablist" aria-label="Select puzzle type">
          {PUZZLE_ORDER.map((id) => {
            const isActive = id === activePuzzleId;
            const isHovered = id === hoveredPuzzle;
            const IconComponent = PUZZLE_ICONS[id];

            return (
              <button
                key={id}
                type="button"
                role="tab"
                tabIndex={-1}
                aria-selected={isActive}
                onClick={() => {
                  if (!disabled) {
                    onPuzzleChange(id);
                    // Blur button after click to allow R key to work
                    (document.activeElement as HTMLElement)?.blur();
                  }
                }}
                onMouseEnter={() => setHoveredPuzzle(id)}
                onMouseLeave={() => setHoveredPuzzle(null)}
                style={{
                  ...styles.puzzleChip,
                  ...(isActive ? styles.puzzleChipActive : {}),
                  ...(!isActive && isHovered ? styles.puzzleChipHover : {}),
                  ...(disabled ? styles.puzzleChipDisabled : {}),
                }}
                disabled={disabled}
                title={PUZZLE_LABELS[id]}
              >
                <span style={{ display: "flex", alignItems: "center", opacity: isActive ? 1 : 0.7 }}>
                  {IconComponent(isActive)}
                </span>
                <span style={{
                  fontSize: isActive ? "11px" : "10px",
                  transition: "all 150ms ease",
                }}>
                  {PUZZLE_LABELS[id]}
                </span>
              </button>
            );
          })}
        </div>

        {/* 3D visualization button - right next to puzzle selector */}
        {showImage && hasScramble && !loading && ["222", "333", "444", "555", "666", "777"].includes(activePuzzleId) && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => {
              setShowVisualizationModal(true);
              (document.activeElement as HTMLElement)?.blur();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              padding: "4px 10px",
              height: "32px",
              fontSize: "10px",
              fontWeight: 500,
              color: "var(--color-text-muted)",
              backgroundColor: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "12px",
              cursor: disabled ? "not-allowed" : "pointer",
              transition: "all 150ms ease",
              opacity: disabled ? 0.5 : 1,
            }}
            onMouseEnter={(e) => {
              if (!disabled) {
                e.currentTarget.style.backgroundColor = "var(--color-surface-raised)";
                e.currentTarget.style.color = "var(--color-text-primary)";
                e.currentTarget.style.borderColor = "var(--color-text-muted)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--color-surface)";
              e.currentTarget.style.color = "var(--color-text-muted)";
              e.currentTarget.style.borderColor = "var(--color-border)";
            }}
            disabled={disabled}
            aria-label="Show 3D scramble visualization"
            title="View 3D cube"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l9 5v8l-9 5-9-5V8l9-5z" />
              <path d="M12 8v13" />
              <path d="M3 8l9 5 9-5" />
            </svg>
            <span>3D</span>
          </button>
        )}
      </div>

      {/* 3D Visualization Modal with Animation */}
      {showVisualizationModal && hasScramble && ["222", "333", "444", "555", "666", "777"].includes(activePuzzleId) && (
        <ScrambleVisualizationModal
          scramble={scrambleText}
          puzzleId={activePuzzleId as CubeEventId}
          puzzleLabel={PUZZLE_LABELS[activePuzzleId as CubeEventId] || "Cube"}
          onClose={() => setShowVisualizationModal(false)}
        />
      )}

      <div style={styles.scrambleContainer as React.CSSProperties}>
        {loading ? (
          <div style={styles.scrambleLoading}>Generating scramble...</div>
        ) : hasScramble ? (
          <div
            style={styles.scrambleText}
            role="region"
            aria-label="Scramble sequence"
            aria-live="polite"
          >
            {scrambleText}
          </div>
        ) : (
          <div style={styles.scrambleLoading}>No scramble</div>
        )}
      </div>

    </div>
  );
}

export default ScrambleDisplay;
