import React, { useMemo, useEffect, useState } from "react";
import { TimingState, Penalty, DurationMs } from "../../types";

export interface TimerDisplayProps {
  status: TimingState;
  displayTime: DurationMs;
  inspectionRemaining: number | null;
  penalty: Penalty;
  isHolding: boolean;
  isReady: boolean;
  isPB?: boolean;
}

interface FormattedTime {
  main: string;
  decimal: string;
  hasMinutes: boolean;
}

function formatTimeRunning(ms: DurationMs): FormattedTime {
  if (ms < 0) ms = 0;

  const totalTenths = Math.floor(ms / 100);
  const tenths = totalTenths % 10;
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  if (minutes > 0) {
    const secStr = seconds.toString().padStart(2, "0");
    return {
      main: `${minutes}:${secStr}`,
      decimal: tenths.toString(),
      hasMinutes: true,
    };
  }

  return {
    main: seconds.toString(),
    decimal: tenths.toString(),
    hasMinutes: false,
  };
}

function formatTimeStopped(ms: DurationMs): FormattedTime {
  if (ms < 0) ms = 0;

  const totalCentiseconds = Math.floor(ms / 10);
  const centiseconds = totalCentiseconds % 100;
  const totalSeconds = Math.floor(ms / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const decimalStr = centiseconds.toString().padStart(2, "0");

  if (minutes > 0) {
    const secStr = seconds.toString().padStart(2, "0");
    return {
      main: `${minutes}:${secStr}`,
      decimal: decimalStr,
      hasMinutes: true,
    };
  }

  return {
    main: seconds.toString(),
    decimal: decimalStr,
    hasMinutes: false,
  };
}

function getTimerColor(
  status: TimingState,
  penalty: Penalty,
  isHolding: boolean,
  isReady: boolean,
  inspectionRemaining: number | null,
): string {
  if (isHolding) {
    return isReady
      ? "var(--timer-holding-ready)"
      : "var(--timer-holding-not-ready)";
  }

  switch (status) {
    case "idle":
      return "var(--timer-idle)";

    case "inspection":
      if (inspectionRemaining !== null && inspectionRemaining <= 3) {
        return "var(--timer-inspection-critical)";
      }
      return "var(--timer-inspection)";

    case "running":
      return "var(--timer-running)";

    case "stopped":
      if (penalty === Penalty.DNF) {
        return "var(--timer-stopped-dnf)";
      }
      if (penalty === Penalty.Plus2) {
        return "var(--timer-stopped-plus2)";
      }
      return "var(--timer-stopped)";

    default:
      return "var(--timer-idle)";
  }
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    userSelect: "none",
    WebkitUserSelect: "none",
    padding: "8px",
    touchAction: "manipulation",
  } as React.CSSProperties,

  timeWrapper: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    lineHeight: 1,
  } as React.CSSProperties,

  mainDigits: {
    fontFamily: "var(--font-mono)",
    fontSize: "var(--timer-font-size)",
    fontWeight: "var(--timer-font-weight)",
    fontVariantNumeric: "tabular-nums slashed-zero",
    fontFeatureSettings: '"tnum" 1, "zero" 1, "kern" 1',
    letterSpacing: "var(--timer-letter-spacing)",
    lineHeight: 1,
    transition: "color 60ms ease-out",
  } as React.CSSProperties,

  decimalPoint: {
    fontFamily: "var(--font-mono)",
    fontSize: "calc(var(--timer-font-size) * 0.6)",
    fontWeight: "var(--timer-font-weight)",
    fontVariantNumeric: "tabular-nums",
    opacity: 0.45,
    margin: "0 -0.02em",
    display: "inline-block",
    transition: "color 60ms ease-out",
  } as React.CSSProperties,

  decimalDigits: {
    fontFamily: "var(--font-mono)",
    fontSize: "calc(var(--timer-font-size) * var(--timer-decimal-scale))",
    fontWeight: "var(--timer-font-weight)",
    fontVariantNumeric: "tabular-nums slashed-zero",
    fontFeatureSettings: '"tnum" 1, "zero" 1',
    letterSpacing: "-0.02em",
    lineHeight: 1,
    opacity: "var(--timer-decimal-opacity)",
    transition: "color 60ms ease-out, opacity 100ms ease-out",
  } as React.CSSProperties,

  decimalDigitsTrailing: {
    opacity: 0.3,
  } as React.CSSProperties,

  penaltyBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "clamp(0.75rem, 1.8vw, 1.25rem)",
    fontWeight: 500,
    marginTop: "6px",
    letterSpacing: "0.03em",
    opacity: 0.9,
  } as React.CSSProperties,

  hint: {
    fontFamily: "var(--font-ui)",
    fontSize: "10px",
    fontWeight: 400,
    color: "var(--color-text-disabled)",
    marginTop: "12px",
    textAlign: "center",
    letterSpacing: "0.02em",
    transition: "opacity 100ms ease-out",
  } as React.CSSProperties,

  pbIndicator: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    fontFamily: "var(--font-ui)",
    fontSize: "9px",
    fontWeight: 600,
    color: "var(--color-pb)",
    marginTop: "6px",
    padding: "3px 8px",
    backgroundColor: "rgba(167, 139, 250, 0.08)",
    borderRadius: "4px",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
  } as React.CSSProperties,
};

export function TimerDisplay({
  status,
  displayTime,
  inspectionRemaining,
  penalty,
  isHolding,
  isReady,
  isPB = false,
}: TimerDisplayProps) {
  const [justStopped, setJustStopped] = useState(false);

  useEffect(() => {
    if (status === "stopped") {
      setJustStopped(true);
      const timer = setTimeout(() => setJustStopped(false), 50);
      return () => clearTimeout(timer);
    }
    setJustStopped(false);
  }, [status]);

  const displayContent = useMemo(() => {
    if (status === "inspection" && inspectionRemaining !== null) {
      if (inspectionRemaining <= 0) {
        return { main: "+2", decimal: "", isCountdown: true };
      }
      return {
        main: inspectionRemaining.toString(),
        decimal: "",
        isCountdown: true,
      };
    }

    if (status === "idle" || (isHolding && status !== "running")) {
      return { main: "0", decimal: "00", isCountdown: false };
    }

    if (status === "running") {
      const formatted = formatTimeRunning(displayTime);
      return {
        main: formatted.main,
        decimal: formatted.decimal,
        isCountdown: false,
      };
    }

    const formatted = formatTimeStopped(displayTime);
    return {
      main: formatted.main,
      decimal: formatted.decimal,
      isCountdown: false,
    };
  }, [status, displayTime, inspectionRemaining, isHolding]);

  const color = getTimerColor(
    status,
    penalty,
    isHolding,
    isReady,
    inspectionRemaining,
  );

  const penaltySuffix = useMemo(() => {
    if (status !== "stopped") return null;
    if (penalty === Penalty.Plus2) return "+2";
    if (penalty === Penalty.DNF) return "DNF";
    return null;
  }, [status, penalty]);

  const penaltyColor =
    penalty === Penalty.DNF
      ? "var(--color-error)"
      : penalty === Penalty.Plus2
        ? "var(--color-warn)"
        : color;

  const decimalOpacity = status === "stopped" ? 0.55 : 0.7;
  const decimalTailOpacity = status === "stopped" ? 0.35 : decimalOpacity;

  const decimalFirst = displayContent.decimal?.slice(0, 1) ?? "";
  const decimalTail = displayContent.decimal?.slice(1) ?? "";

  const hintText = useMemo(() => {
    if (status === "idle" && !isHolding) {
      return "Hold space to start";
    }
    if (status === "inspection") {
      return "Release to begin";
    }
    return null;
  }, [status, isHolding]);

  return (
    <div
      style={styles.container}
      className={justStopped ? "timer-settle" : ""}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
    >
      <div style={styles.timeWrapper}>
        <span style={{ ...styles.mainDigits, color }} className="timer-digits">
          {displayContent.main}
        </span>

        {!displayContent.isCountdown && displayContent.decimal && (
          <>
            <span
              style={{ ...styles.decimalPoint, color }}
              className="timer-decimal"
            >
              .
            </span>
            <span
              style={{
                ...styles.decimalDigits,
                color,
                opacity: decimalOpacity,
              }}
              className="timer-decimal-digits"
            >
              {decimalFirst}
            </span>
            {decimalTail && (
              <span
                style={{
                  ...styles.decimalDigits,
                  ...styles.decimalDigitsTrailing,
                  color,
                  opacity: decimalTailOpacity,
                }}
                className="timer-decimal-digits"
              >
                {decimalTail}
              </span>
            )}
          </>
        )}
      </div>

      {penaltySuffix && (
        <div style={{ ...styles.penaltyBadge, color: penaltyColor }}>
          {penaltySuffix}
        </div>
      )}

      {isPB && status === "stopped" && penalty === Penalty.None && (
        <div style={styles.pbIndicator}>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
          </svg>
          <span>Personal Best</span>
        </div>
      )}

      <div style={{ ...styles.hint, opacity: hintText ? 0.55 : 0 }}>
        {hintText || "Hold space to start"}
      </div>
    </div>
  );
}

export default TimerDisplay;
