import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
} from "react";
import { PuzzleId, Scramble, WcaEventId } from "../../types";

export interface ScrambleDisplayProps {
  scramble: Scramble | null;
  activePuzzleId: PuzzleId;
  onPuzzleChange: (puzzleId: PuzzleId) => void;
  onRefresh: () => void;
  disabled?: boolean;
  loading?: boolean;
}

const PUZZLE_LABELS: Record<WcaEventId, string> = {
  "222": "2×2",
  "333": "3×3",
  "444": "4×4",
  "555": "5×5",
  "666": "6×6",
  "777": "7×7",
  pyram: "Pyraminx",
  skewb: "Skewb",
  sq1: "Square-1",
  clock: "Clock",
  minx: "Megaminx",
};

const PUZZLE_ORDER: WcaEventId[] = [
  "333",
  "222",
  "444",
  "555",
  "666",
  "777",
  "pyram",
  "skewb",
  "sq1",
  "clock",
  "minx",
];

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    width: "100%",
    maxWidth: "600px",
  } as React.CSSProperties,

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
  } as React.CSSProperties,

  dropdownContainer: {
    position: "relative",
    zIndex: 20,
  } as React.CSSProperties,

  dropdownTrigger: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 12px",
    fontSize: "11px",
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-text-primary)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "5px",
    cursor: "pointer",
    outline: "none",
    transition: "all 60ms ease-out",
    minWidth: "80px",
    userSelect: "none",
  } as React.CSSProperties,

  dropdownTriggerHover: {
    borderColor: "var(--color-text-muted)",
    backgroundColor: "var(--color-surface)",
  } as React.CSSProperties,

  dropdownTriggerOpen: {
    borderColor: "var(--color-focus)",
    backgroundColor: "var(--color-surface)",
  } as React.CSSProperties,

  dropdownTriggerDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,

  dropdownArrow: {
    marginLeft: "auto",
    transition: "transform 40ms ease-out",
  } as React.CSSProperties,

  dropdownArrowOpen: {
    transform: "rotate(180deg)",
  } as React.CSSProperties,

  dropdownMenu: {
    position: "absolute",
    top: "calc(100% + 3px)",
    left: "50%",
    transform: "translateX(-50%)",
    minWidth: "120px",
    maxHeight: "240px",
    overflowY: "auto",
    backgroundColor: "var(--color-surface-raised)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "4px",
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.45)",
    padding: "2px 0",
    zIndex: 100,
  } as React.CSSProperties,

  dropdownItem: {
    display: "flex",
    alignItems: "center",
    padding: "5px 10px",
    fontSize: "11px",
    fontFamily: "var(--font-ui)",
    fontWeight: 400,
    color: "var(--color-text-secondary)",
    cursor: "pointer",
    transition: "all 40ms ease-out",
    outline: "none",
  } as React.CSSProperties,

  dropdownItemHover: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    color: "var(--color-text-primary)",
  } as React.CSSProperties,

  dropdownItemSelected: {
    backgroundColor: "rgba(96, 165, 250, 0.1)",
    color: "var(--color-text-primary)",
    fontWeight: 500,
  } as React.CSSProperties,

  dropdownItemFocused: {
    backgroundColor: "rgba(96, 165, 250, 0.12)",
    color: "var(--color-text-primary)",
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

  refreshButton: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    padding: "3px 10px",
    fontSize: "10px",
    fontFamily: "var(--font-ui)",
    fontWeight: 500,
    color: "var(--color-text-muted)",
    backgroundColor: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "4px",
    cursor: "pointer",
    transition: "all 60ms ease-out",
    marginTop: "4px",
  } as React.CSSProperties,

  refreshButtonHover: {
    color: "var(--color-text-secondary)",
    backgroundColor: "var(--color-surface-raised)",
    borderColor: "var(--color-border)",
  } as React.CSSProperties,

  refreshButtonDisabled: {
    opacity: 0.35,
    cursor: "not-allowed",
  } as React.CSSProperties,

  kbd: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "14px",
    padding: "1px 4px",
    fontFamily: "var(--font-mono)",
    fontSize: "8px",
    fontWeight: 500,
    lineHeight: 1.3,
    color: "var(--color-text-muted)",
    backgroundColor: "var(--color-surface)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "3px",
  } as React.CSSProperties,
};

function formatScrambleLines(notation: string): string[] {
  const normalized = notation.replace(/\s+/g, " ").trim();
  if (!normalized) return [""];
  if (normalized.includes("\n")) {
    return normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 2);
  }

  const tokens = normalized.split(" ");
  if (tokens.length <= 4) return [normalized];

  const totalLen = tokens.reduce((sum, token) => sum + token.length + 1, -1);
  const target = totalLen / 2;

  const line1: string[] = [];
  const line2: string[] = [];
  let line1Len = 0;

  tokens.forEach((token, index) => {
    const projected = line1Len + (line1.length ? 1 : 0) + token.length;
    const remainingTokens = tokens.length - index - 1;
    const shouldStartLine2 =
      (line2.length === 0 && projected > target && remainingTokens >= 1) ||
      (line2.length === 0 && remainingTokens === 0 && line1.length > 2);

    if (shouldStartLine2) {
      line2.push(token);
    } else {
      line1.push(token);
      line1Len = projected;
    }
  });

  if (line2.length === 1 && line1.length > 2) {
    const moved = line1.pop();
    if (moved) line2.unshift(moved);
  }

  return [line1.join(" "), line2.join(" ")].filter(Boolean).slice(0, 2);
}

export function ScrambleDisplay({
  scramble,
  activePuzzleId,
  onPuzzleChange,
  onRefresh,
  disabled = false,
  loading = false,
}: ScrambleDisplayProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isRefreshHovered, setIsRefreshHovered] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [filterQuery, setFilterQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredPuzzles = useMemo(() => {
    if (!filterQuery) return PUZZLE_ORDER;
    const query = filterQuery.toLowerCase();
    return PUZZLE_ORDER.filter((id) => id.toLowerCase().includes(query));
  }, [filterQuery]);

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
        onRefresh();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onRefresh, disabled]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      const idx = filteredPuzzles.indexOf(activePuzzleId as WcaEventId);
      setFocusedIndex(idx >= 0 ? idx : 0);
    } else {
      setFocusedIndex(-1);
      setHoveredIndex(-1);
      setFilterQuery("");
    }
  }, [isOpen, activePuzzleId, filteredPuzzles]);

  const handleToggle = useCallback(() => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
      setFilterQuery("");
    }
  }, [disabled]);

  const handleSelect = useCallback(
    (puzzleId: WcaEventId) => {
      onPuzzleChange(puzzleId);
      setIsOpen(false);
    },
    [onPuzzleChange],
  );

  const handleMenuKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const isChar =
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;

      if (!isOpen && isChar && !disabled) {
        setIsOpen(true);
        setFilterQuery(e.key.toLowerCase());
        setFocusedIndex(0);
        e.preventDefault();
        return;
      }

      if (!isOpen) return;

      if (isChar) {
        e.preventDefault();
        setFilterQuery((prev) => (prev + e.key).slice(-12).toLowerCase());
        setFocusedIndex(0);
        return;
      }

      switch (e.code) {
        case "Backspace":
          e.preventDefault();
          setFilterQuery((prev) => prev.slice(0, -1));
          setFocusedIndex(0);
          break;
        case "ArrowDown":
        case "KeyJ":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev < filteredPuzzles.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
        case "KeyK":
          e.preventDefault();
          setFocusedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredPuzzles.length - 1,
          );
          break;
        case "Enter":
        case "Space": {
          e.preventDefault();
          const selectedPuzzle = filteredPuzzles[focusedIndex];
          if (
            focusedIndex >= 0 &&
            focusedIndex < filteredPuzzles.length &&
            selectedPuzzle
          ) {
            handleSelect(selectedPuzzle);
          }
          break;
        }
        case "Home":
          e.preventDefault();
          setFocusedIndex(0);
          break;
        case "End":
          e.preventDefault();
          setFocusedIndex(filteredPuzzles.length - 1);
          break;
      }
    },
    [isOpen, focusedIndex, handleSelect, filteredPuzzles, disabled],
  );

  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && menuRef.current) {
      const items = menuRef.current.querySelectorAll("[data-puzzle-item]");
      const focusedItem = items[focusedIndex] as HTMLElement;
      if (focusedItem) {
        focusedItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [focusedIndex, isOpen]);

  const filteredCurrentIndex = Math.min(
    Math.max(focusedIndex, 0),
    Math.max(filteredPuzzles.length - 1, 0),
  );

  const scrambleLines = useMemo(
    () => (scramble?.notation ? formatScrambleLines(scramble.notation) : []),
    [scramble],
  );
  const isMultiLine = scrambleLines.length > 1;
  const hasScramble = scramble?.notation && scramble.notation.length > 0;

  return (
    <div style={styles.container}>
      <div style={styles.topRow}>
        <div
          ref={containerRef}
          style={styles.dropdownContainer as React.CSSProperties}
          onKeyDown={handleMenuKeyDown}
        >
          <button
            type="button"
            onClick={handleToggle}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            onFocus={() => setIsHovered(true)}
            onBlur={() => setIsHovered(false)}
            style={{
              ...styles.dropdownTrigger,
              ...(isHovered && !disabled && !isOpen
                ? styles.dropdownTriggerHover
                : {}),
              ...(isOpen ? styles.dropdownTriggerOpen : {}),
              ...(disabled ? styles.dropdownTriggerDisabled : {}),
            }}
            disabled={disabled}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label="Select puzzle type"
          >
            <span>{PUZZLE_LABELS[activePuzzleId as WcaEventId] || "3×3"}</span>
            <svg
              width="9"
              height="9"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                ...styles.dropdownArrow,
                ...(isOpen ? styles.dropdownArrowOpen : {}),
              }}
              aria-hidden="true"
            >
              <path d="M2 4l4 4 4-4" />
            </svg>
          </button>

          {isOpen && (
            <div
              ref={menuRef}
              style={styles.dropdownMenu as React.CSSProperties}
              role="listbox"
              aria-activedescendant={
                filteredCurrentIndex >= 0
                  ? `puzzle-${filteredPuzzles[filteredCurrentIndex]}`
                  : undefined
              }
            >
              {filteredPuzzles.length === 0 && (
                <div style={{ ...styles.dropdownItem, opacity: 0.5 }}>
                  No matches
                </div>
              )}
              {filteredPuzzles.map((id, index) => {
                const isSelected = id === activePuzzleId;
                const isFocused = index === focusedIndex;
                const isItemHovered = index === hoveredIndex;

                return (
                  <div
                    key={id}
                    id={`puzzle-${id}`}
                    data-puzzle-item
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(id)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(-1)}
                    style={{
                      ...styles.dropdownItem,
                      ...(isSelected ? styles.dropdownItemSelected : {}),
                      ...(isFocused && !isItemHovered
                        ? styles.dropdownItemFocused
                        : {}),
                      ...(isItemHovered ? styles.dropdownItemHover : {}),
                    }}
                  >
                    {PUZZLE_LABELS[id]}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div style={styles.scrambleContainer as React.CSSProperties}>
        {loading ? (
          <div style={styles.scrambleLoading}>Generating scramble...</div>
        ) : hasScramble ? (
          <div
            style={{
              ...styles.scrambleText,
              ...(isMultiLine ? styles.scrambleTextMultiLine : {}),
            }}
            role="region"
            aria-label="Scramble sequence"
            aria-live="polite"
          >
            {scrambleLines.map((line, idx) => (
              <div key={idx}>{line}</div>
            ))}
          </div>
        ) : (
          <div style={styles.scrambleLoading}>No scramble</div>
        )}
      </div>

      <button
        type="button"
        onClick={onRefresh}
        onMouseEnter={() => setIsRefreshHovered(true)}
        onMouseLeave={() => setIsRefreshHovered(false)}
        disabled={disabled || loading}
        style={{
          ...styles.refreshButton,
          ...(isRefreshHovered && !disabled && !loading
            ? styles.refreshButtonHover
            : {}),
          ...(disabled || loading ? styles.refreshButtonDisabled : {}),
        }}
        aria-label="Generate new scramble"
      >
        <span>New scramble</span>
        <span style={styles.kbd}>R</span>
      </button>
    </div>
  );
}

export default ScrambleDisplay;
