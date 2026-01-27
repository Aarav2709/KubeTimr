import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from "react";
import { DurationMs, Penalty, Solve, SolveId } from "../../types";

export interface SolveListProps {
  solves: Solve[];
  selectedSolveId?: SolveId | null;
  onSelectSolve?: (solveId: SolveId) => void;
  onPenaltyChange: (solveId: SolveId, penalty: Penalty) => void;
  onDelete: (solveId: SolveId) => void;
  disabled?: boolean;
}

function formatTime(ms: DurationMs | null): string {
  if (ms === null) return "DNF";
  if (ms < 0) ms = 0;

  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centis = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    const secStr = seconds.toString().padStart(2, "0");
    return `${minutes}:${secStr}.${centis.toString().padStart(2, "0")}`;
  }

  return `${seconds}.${centis.toString().padStart(2, "0")}`;
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  } as React.CSSProperties,

  header: {
    flexShrink: 0,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 8px",
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: "var(--color-border-subtle)",
  } as React.CSSProperties,

  headerTitle: {
    fontSize: "9px",
    fontWeight: 600,
    color: "var(--color-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  } as React.CSSProperties,

  headerCount: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--color-text-muted)",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 500,
  } as React.CSSProperties,

  listContainer: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
  } as React.CSSProperties,

  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    color: "var(--color-text-muted)",
    fontSize: "var(--text-xs)",
    gap: "4px",
    padding: "var(--space-4)",
    textAlign: "center",
  } as React.CSSProperties,

  emptyHint: {
    fontSize: "9px",
    color: "var(--color-text-disabled)",
  } as React.CSSProperties,

  footer: {
    flexShrink: 0,
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    padding: "3px 6px",
    borderTopWidth: "1px",
    borderTopStyle: "solid",
    borderTopColor: "var(--color-border-subtle)",
    fontSize: "9px",
    color: "var(--color-text-disabled)",
  } as React.CSSProperties,

  footerHint: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
  } as React.CSSProperties,

  footerKey: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "12px",
    padding: "0 2px",
    fontFamily: "var(--font-mono)",
    fontSize: "8px",
    fontWeight: 500,
    lineHeight: 1.3,
    color: "var(--color-text-muted)",
    backgroundColor: "var(--color-surface-raised)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--color-border)",
    borderRadius: "2px",
  } as React.CSSProperties,

  row: {
    display: "flex",
    alignItems: "center",
    padding: "1px 6px 1px 3px",
    cursor: "pointer",
    position: "relative",
    transition: "background-color 40ms ease-out",
    borderLeftWidth: "2px",
    borderLeftStyle: "solid",
    borderLeftColor: "transparent",
    minHeight: "17px",
  } as React.CSSProperties,

  rowSelected: {
    borderLeftColor: "var(--color-ready)",
    backgroundColor: "rgba(74, 222, 128, 0.04)",
  } as React.CSSProperties,

  rowHover: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
  } as React.CSSProperties,

  rowIndex: {
    fontFamily: "var(--font-mono)",
    fontSize: "9px",
    color: "var(--color-text-disabled)",
    minWidth: "18px",
    marginRight: "4px",
    fontVariantNumeric: "tabular-nums",
    opacity: 0.5,
    textAlign: "right",
  } as React.CSSProperties,

  rowTime: {
    flex: 1,
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    color: "var(--color-text-primary)",
    letterSpacing: "-0.01em",
  } as React.CSSProperties,

  rowTimeDnf: {
    color: "var(--color-error-muted)",
  } as React.CSSProperties,

  rowTimePlus2: {
    color: "var(--color-warn-muted)",
  } as React.CSSProperties,

  rowPenaltyBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "7px",
    fontWeight: 600,
    marginLeft: "2px",
    padding: "0 2px",
    borderRadius: "2px",
    textTransform: "uppercase",
    lineHeight: 1.3,
    opacity: 0.5,
  } as React.CSSProperties,

  penaltyPlus2: {
    color: "var(--color-warn)",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  } as React.CSSProperties,

  penaltyDnf: {
    color: "var(--color-error)",
    backgroundColor: "rgba(248, 113, 113, 0.1)",
  } as React.CSSProperties,

  rowActions: {
    display: "flex",
    alignItems: "center",
    gap: "1px",
    opacity: 0,
    transition: "opacity 40ms ease-out",
    marginLeft: "4px",
  } as React.CSSProperties,

  rowActionsVisible: {
    opacity: 1,
  } as React.CSSProperties,

  actionButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1px 2px",
    fontSize: "8px",
    fontWeight: 600,
    fontFamily: "var(--font-mono)",
    color: "var(--color-text-muted)",
    backgroundColor: "transparent",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "transparent",
    borderRadius: "2px",
    cursor: "pointer",
    transition: "all 40ms ease-out",
    minWidth: "16px",
    lineHeight: 1.2,
  } as React.CSSProperties,

  actionButtonHover: {
    backgroundColor: "var(--color-surface-raised)",
    borderColor: "var(--color-border)",
    color: "var(--color-text-secondary)",
  } as React.CSSProperties,

  actionButtonActive: {
    borderColor: "currentColor",
  } as React.CSSProperties,

  actionButtonDelete: {
    marginLeft: "2px",
  } as React.CSSProperties,

  actionButtonDeleteConfirm: {
    color: "var(--color-error)",
    borderColor: "var(--color-error)",
    backgroundColor: "rgba(248, 113, 113, 0.08)",
  } as React.CSSProperties,
};

interface SolveRowProps {
  solve: Solve;
  index: number;
  isSelected: boolean;
  onSelect: (id: SolveId) => void;
  onPenaltyChange: (solveId: SolveId, penalty: Penalty) => void;
  onDelete: (solveId: SolveId) => void;
  disabled?: boolean;
}

function SolveRow({
  solve,
  index,
  isSelected,
  onSelect,
  onPenaltyChange,
  onDelete,
  disabled = false,
}: SolveRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isSelected]);

  useEffect(() => {
    if (!isHovered && !isSelected) {
      const timeout = setTimeout(() => setConfirmDelete(false), 150);
      return () => clearTimeout(timeout);
    }
  }, [isHovered, isSelected]);

  const handleRowClick = useCallback(() => {
    onSelect(solve.id);
  }, [solve.id, onSelect]);

  const handlePenaltyClick = useCallback(
    (e: React.MouseEvent, penalty: Penalty) => {
      e.stopPropagation();
      if (disabled) return;
      const newPenalty =
        solve.timing.penalty === penalty ? Penalty.None : penalty;
      onPenaltyChange(solve.id, newPenalty);
    },
    [solve.id, solve.timing.penalty, onPenaltyChange, disabled],
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      if (confirmDelete) {
        onDelete(solve.id);
        setConfirmDelete(false);
      } else {
        setConfirmDelete(true);
      }
    },
    [solve.id, onDelete, confirmDelete, disabled],
  );

  const showActions = isHovered || isSelected;
  const isPlus2 = solve.timing.penalty === Penalty.Plus2;
  const isDnf = solve.timing.penalty === Penalty.DNF;

  return (
    <div
      ref={rowRef}
      role="row"
      aria-selected={isSelected}
      onClick={handleRowClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setHoveredButton(null);
      }}
      style={{
        ...styles.row,
        ...(isSelected ? styles.rowSelected : {}),
        ...(isHovered && !isSelected ? styles.rowHover : {}),
      }}
    >
      <span style={styles.rowIndex as React.CSSProperties}>{index + 1}</span>
      <span
        style={{
          ...styles.rowTime,
          ...(isDnf ? styles.rowTimeDnf : {}),
          ...(isPlus2 ? styles.rowTimePlus2 : {}),
        }}
      >
        {formatTime(solve.timing.finalDurationMs)}
      </span>
      {isPlus2 && (
        <span
          style={{
            ...styles.rowPenaltyBadge,
            ...styles.penaltyPlus2,
            opacity: showActions ? 0.8 : 0.5,
          }}
        >
          +2
        </span>
      )}
      {isDnf && (
        <span
          style={{
            ...styles.rowPenaltyBadge,
            ...styles.penaltyDnf,
            opacity: showActions ? 0.8 : 0.5,
          }}
        >
          DNF
        </span>
      )}
      <div
        style={{
          ...styles.rowActions,
          ...(showActions ? styles.rowActionsVisible : {}),
        }}
      >
        <button
          type="button"
          onClick={(e) => handlePenaltyClick(e, Penalty.Plus2)}
          onMouseEnter={() => setHoveredButton("plus2")}
          onMouseLeave={() => setHoveredButton(null)}
          disabled={disabled}
          style={{
            ...styles.actionButton,
            ...(hoveredButton === "plus2" ? styles.actionButtonHover : {}),
            ...(isPlus2 ? styles.actionButtonActive : {}),
            color: isPlus2 ? "var(--color-warn)" : undefined,
          }}
          aria-label="Toggle +2 penalty"
        >
          +2
        </button>
        <button
          type="button"
          onClick={(e) => handlePenaltyClick(e, Penalty.DNF)}
          onMouseEnter={() => setHoveredButton("dnf")}
          onMouseLeave={() => setHoveredButton(null)}
          disabled={disabled}
          style={{
            ...styles.actionButton,
            ...(hoveredButton === "dnf" ? styles.actionButtonHover : {}),
            ...(isDnf ? styles.actionButtonActive : {}),
            color: isDnf ? "var(--color-error)" : undefined,
          }}
          aria-label="Toggle DNF penalty"
        >
          DNF
        </button>
        <button
          type="button"
          onClick={handleDeleteClick}
          onMouseEnter={() => setHoveredButton("del")}
          onMouseLeave={() => setHoveredButton(null)}
          disabled={disabled}
          style={{
            ...styles.actionButton,
            ...styles.actionButtonDelete,
            ...(hoveredButton === "del" ? styles.actionButtonHover : {}),
            ...(confirmDelete ? styles.actionButtonDeleteConfirm : {}),
          }}
          aria-label={confirmDelete ? "Confirm delete" : "Delete solve"}
        >
          {confirmDelete ? "?" : "×"}
        </button>
      </div>
    </div>
  );
}

export function SolveList({
  solves,
  selectedSolveId,
  onSelectSolve,
  onPenaltyChange,
  onDelete,
  disabled = false,
}: SolveListProps) {
  const [selectedId, setSelectedId] = useState<SolveId | null>(
    selectedSolveId ?? null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  const reversedSolves = useMemo(() => [...solves].reverse(), [solves]);
  const displayedSolves = reversedSolves;

  useEffect(() => {
    if (selectedSolveId !== undefined) {
      setSelectedId(selectedSolveId ?? null);
      return;
    }
    if (reversedSolves.length > 0) {
      if (!selectedId || !solves.find((s) => s.id === selectedId)) {
        const firstSolve = reversedSolves[0];
        if (firstSolve) {
          setSelectedId(firstSolve.id);
        }
      }
    } else {
      setSelectedId(null);
    }
  }, [reversedSolves, selectedId, solves, selectedSolveId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;

      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      const currentIndex = displayedSolves.findIndex(
        (s) => s.id === selectedId,
      );

      switch (e.code) {
        case "ArrowUp":
        case "KeyK": {
          e.preventDefault();
          if (currentIndex > 0) {
            const prevSolve = displayedSolves[currentIndex - 1];
            if (prevSolve) {
              setSelectedId(prevSolve.id);
              onSelectSolve?.(prevSolve.id);
            }
          }
          break;
        }

        case "ArrowDown":
        case "KeyJ": {
          e.preventDefault();
          if (currentIndex < displayedSolves.length - 1) {
            const nextSolve = displayedSolves[currentIndex + 1];
            if (nextSolve) {
              setSelectedId(nextSolve.id);
              onSelectSolve?.(nextSolve.id);
            }
          }
          break;
        }

        case "KeyP": {
          if (selectedId && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            const solve = solves.find((s) => s.id === selectedId);
            if (solve) {
              const newPenalty =
                solve.timing.penalty === Penalty.Plus2
                  ? Penalty.None
                  : Penalty.Plus2;
              onPenaltyChange(selectedId, newPenalty);
            }
          }
          break;
        }

        case "KeyN": {
          if (selectedId && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            const solve = solves.find((s) => s.id === selectedId);
            if (solve) {
              const newPenalty =
                solve.timing.penalty === Penalty.DNF
                  ? Penalty.None
                  : Penalty.DNF;
              onPenaltyChange(selectedId, newPenalty);
            }
          }
          break;
        }

        case "KeyD": {
          if (selectedId && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            onDelete(selectedId);
          }
          break;
        }

        case "Digit0":
        case "Numpad0": {
          if (selectedId && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onPenaltyChange(selectedId, Penalty.None);
          }
          break;
        }

        case "Delete":
        case "Backspace": {
          if (selectedId && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            onDelete(selectedId);
          }
          break;
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedId,
    displayedSolves,
    solves,
    onPenaltyChange,
    onDelete,
    onSelectSolve,
    disabled,
  ]);

  const handleSelect = useCallback(
    (id: SolveId) => {
      setSelectedId(id);
      onSelectSolve?.(id);
    },
    [onSelectSolve],
  );

  return (
    <div
      ref={containerRef}
      style={styles.container}
      role="grid"
      tabIndex={0}
      aria-label="Solve list"
    >
      <div style={styles.header}>
        <span style={styles.headerTitle as React.CSSProperties}>Solves</span>
        <span style={styles.headerCount}>{solves.length}</span>
      </div>

      <div
        style={styles.listContainer}
        className="hide-scrollbar"
        role="rowgroup"
      >
        {displayedSolves.length === 0 ? (
          <div style={styles.emptyState as React.CSSProperties}>
            <span>No solves yet</span>
            <span style={styles.emptyHint}>Hold space to start</span>
          </div>
        ) : (
          displayedSolves.map((solve, idx) => (
            <SolveRow
              key={solve.id}
              solve={solve}
              index={solves.length - 1 - idx}
              isSelected={solve.id === selectedId}
              onSelect={handleSelect}
              onPenaltyChange={onPenaltyChange}
              onDelete={onDelete}
              disabled={disabled}
            />
          ))
        )}
      </div>

      {displayedSolves.length > 0 && (
        <div style={styles.footer}>
          <span style={styles.footerHint}>
            <span style={styles.footerKey}>↑↓</span>
          </span>
          <span style={styles.footerHint}>
            <span style={styles.footerKey}>P</span>
            <span>+2</span>
          </span>
          <span style={styles.footerHint}>
            <span style={styles.footerKey}>N</span>
            <span>DNF</span>
          </span>
          <span style={styles.footerHint}>
            <span style={styles.footerKey}>D</span>
            <span>Del</span>
          </span>
        </div>
      )}
    </div>
  );
}

export default SolveList;
