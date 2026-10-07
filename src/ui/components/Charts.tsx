import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatMs } from "../../core/time";
import { openModal, selectSolve, useProfileSolves } from "../../state/store";
import { useStats } from "../../state/useStats";

// trend and distribution charts, singles are neutral dots so ao5 and ao12 are the only colored series

function useWidth<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null);
  const [w, setW] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function niceStep(range: number, target: number): number {
  const raw = range / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10;
  return step * mag;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))));
  return sorted[i]!;
}

const RANGES = [100, 500, 1000, 0] as const;

export function Charts() {
  const [tab, setTab] = useState<"trend" | "dist">("trend");
  const [range, setRange] = useState<(typeof RANGES)[number]>(100);
  return (
    <div className="charts">
      <div className="charts__controls">
        <div className="segmented segmented--tiny" role="tablist">
          <button role="tab" aria-selected={tab === "trend"} className={tab === "trend" ? "is-on" : ""} onClick={() => setTab("trend")}>
            Trend
          </button>
          <button role="tab" aria-selected={tab === "dist"} className={tab === "dist" ? "is-on" : ""} onClick={() => setTab("dist")}>
            Distribution
          </button>
        </div>
        <div className="segmented segmented--tiny" aria-label="Solves shown">
          {RANGES.map((r) => (
            <button key={r} className={range === r ? "is-on" : ""} onClick={() => setRange(r)}>
              {r === 0 ? "All" : r}
            </button>
          ))}
        </div>
      </div>
      {tab === "trend" ? <TrendChart range={range} /> : <Histogram range={range} />}
    </div>
  );
}

const H = 240;
const PAD = { l: 38, r: 8, t: 8, b: 18 };

function TrendChart({ range }: { range: number }) {
  const solves = useProfileSolves();
  const stats = useStats();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const n = stats.values.length;
  const start = range === 0 ? 0 : Math.max(0, n - range);
  const ao5 = stats.series.get("ao5");
  const ao12 = stats.series.get("ao12");

  const geom = useMemo(() => {
    const finite: number[] = [];
    for (let i = start; i < n; i++) {
      const v = stats.values[i]!;
      if (Number.isFinite(v)) finite.push(v);
    }
    if (finite.length < 2) return null;
    const sorted = [...finite].sort((a, b) => a - b);
    // clip outliers so one bad solve does not flatten the chart
    const lo = sorted[0]!;
    const hi = Math.max(quantile(sorted, 0.97) * 1.04, lo + 1000);
    const step = niceStep(hi - lo, 4);
    const y0 = Math.floor(lo / step) * step;
    const y1 = Math.ceil(hi / step) * step;
    const iw = Math.max(10, width - PAD.l - PAD.r);
    const ih = H - PAD.t - PAD.b;
    const count = Math.max(1, n - start - 1);
    const x = (i: number) => PAD.l + ((i - start) / count) * iw;
    const y = (v: number) => PAD.t + ih - ((Math.min(v, y1) - y0) / (y1 - y0)) * ih;
    const ticks: number[] = [];
    for (let t = y0; t <= y1 + 1e-6; t += step) ticks.push(t);
    const path = (s?: Float64Array) => {
      if (!s) return "";
      let d = "";
      let pen = false;
      for (let i = start; i < n; i++) {
        const v = s[i]!;
        if (!Number.isFinite(v)) {
          pen = false;
          continue;
        }
        d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
        pen = true;
      }
      return d;
    };
    return { x, y, ticks, ao5Path: path(ao5), ao12Path: path(ao12), y1 };
  }, [stats, start, n, width, ao5, ao12]);

  if (!geom) {
    return (
      <div ref={ref} className="chart chart--empty muted small">
        Do a few solves to see your trend.
      </div>
    );
  }

  const decimals = (v: number) => formatMs(v, v >= 60_000 ? 0 : 1);
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const iw = Math.max(10, width - PAD.l - PAD.r);
    const t = (px - PAD.l) / iw;
    const i = Math.round(start + t * Math.max(1, n - start - 1));
    setHover(Math.min(n - 1, Math.max(start, i)));
  };

  const hv = hover != null ? stats.values[hover]! : null;

  return (
    <div ref={ref} className="chart">
      <div className="chart__legend" aria-hidden="true">
        <span>
          <i className="key key--dot" /> single
        </span>
        <span>
          <i className="key key--line key--s1" /> ao5
        </span>
        <span>
          <i className="key key--line key--s2" /> ao12
        </span>
      </div>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Trend of the last ${n - start} solves`}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onClick={() => {
          if (hover == null) return;
          const s = solves[hover];
          if (s) {
            selectSolve(s.id);
            openModal({ kind: "solve", id: s.id });
          }
        }}
      >
        {geom.ticks.map((t) => (
          <g key={t}>
            <line className="chart__grid" x1={PAD.l} x2={width - PAD.r} y1={geom.y(t)} y2={geom.y(t)} />
            <text className="chart__tick" x={PAD.l - 6} y={geom.y(t)} dy="0.32em" textAnchor="end">
              {decimals(t)}
            </text>
          </g>
        ))}
        {Array.from({ length: n - start }, (_, k) => {
          const i = start + k;
          const v = stats.values[i]!;
          if (!Number.isFinite(v)) return null;
          return <circle key={i} className={`chart__single ${v > geom.y1 ? "is-clipped" : ""}`} cx={geom.x(i)} cy={geom.y(v)} r={n - start > 200 ? 1.6 : 2.4} />;
        })}
        <path className="chart__line chart__line--s1" d={geom.ao5Path} />
        <path className="chart__line chart__line--s2" d={geom.ao12Path} />
        {hover != null && (
          <g className="chart__cursor">
            <line x1={geom.x(hover)} x2={geom.x(hover)} y1={PAD.t} y2={H - PAD.b} />
            {hv != null && Number.isFinite(hv) && <circle className="chart__marker" cx={geom.x(hover)} cy={geom.y(hv)} r={4} />}
          </g>
        )}
        <text className="chart__tick" x={PAD.l} y={H - 4}>
          #{start + 1}
        </text>
        <text className="chart__tick" x={width - PAD.r} y={H - 4} textAnchor="end">
          #{n}
        </text>
      </svg>
      {hover != null && (
        <div
          className="chart__tooltip"
          style={{ left: Math.min(Math.max(geom.x(hover), 70), width - 70) }}
          role="status"
        >
          <div className="chart__tooltip-title">Solve #{hover + 1}</div>
          <TooltipRow label="single" value={hv} kind="dot" />
          <TooltipRow label="ao5" value={ao5?.[hover]} kind="s1" />
          <TooltipRow label="ao12" value={ao12?.[hover]} kind="s2" />
        </div>
      )}
    </div>
  );
}

function TooltipRow({ label, value, kind }: { label: string; value: number | null | undefined; kind: "dot" | "s1" | "s2" }) {
  if (value == null || Number.isNaN(value)) return null;
  return (
    <div className="chart__tooltip-row">
      <i className={`key ${kind === "dot" ? "key--dot" : `key--line key--${kind}`}`} />
      <strong>{Number.isFinite(value) ? formatMs(value) : "DNF"}</strong>
      <span>{label}</span>
    </div>
  );
}

function Histogram({ range }: { range: number }) {
  const stats = useStats();
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const n = stats.values.length;
  const start = range === 0 ? 0 : Math.max(0, n - range);

  const bins = useMemo(() => {
    const vals = stats.values.slice(start).filter(Number.isFinite).sort((a, b) => a - b);
    if (vals.length < 3) return null;
    const lo = quantile(vals, 0.01);
    const hi = quantile(vals, 0.99);
    const step = niceStep(Math.max(hi - lo, 500), 12);
    const b0 = Math.floor(lo / step) * step;
    const count = Math.max(1, Math.ceil((hi - b0) / step + 1e-9));
    const counts = new Array<number>(count).fill(0);
    let over = 0;
    let under = 0;
    for (const v of vals) {
      const k = Math.floor((v - b0) / step);
      if (k < 0) under++;
      else if (k >= count) over++;
      else counts[k]!++;
    }
    return { b0, step, counts, over, under, total: vals.length };
  }, [stats, start]);

  if (!bins) {
    return (
      <div ref={ref} className="chart chart--empty muted small">
        Not enough solves for a distribution.
      </div>
    );
  }

  const max = Math.max(...bins.counts);
  const iw = Math.max(10, width - PAD.l - PAD.r);
  const ih = H - PAD.t - PAD.b;
  const slot = iw / bins.counts.length;
  const barW = Math.min(24, Math.max(2, slot - 2));
  const label = (k: number) => `${formatMs(bins.b0 + k * bins.step, 1)}–${formatMs(bins.b0 + (k + 1) * bins.step, 1)}`;
  const tallest = bins.counts.indexOf(max);

  return (
    <div ref={ref} className="chart">
      <svg width={width} height={H} role="img" aria-label="Distribution of solve times" onPointerLeave={() => setHover(null)}>
        <line className="chart__grid" x1={PAD.l} x2={width - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} />
        {bins.counts.map((c, k) => {
          const h = max ? (c / max) * (ih - 14) : 0;
          const x = PAD.l + k * slot + (slot - barW) / 2;
          const y = PAD.t + ih - h;
          const r = Math.min(4, barW / 2, h);
          // rounded top, square at the baseline
          const d = h > 0 ? `M${x},${PAD.t + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + barW - r}Q${x + barW},${y} ${x + barW},${y + r}V${PAD.t + ih}Z` : "";
          return (
            <g key={k}>
              <rect
                className="chart__hit"
                x={PAD.l + k * slot}
                y={PAD.t}
                width={slot}
                height={ih}
                tabIndex={0}
                onPointerEnter={() => setHover(k)}
                onFocus={() => setHover(k)}
                onBlur={() => setHover(null)}
              />
              {d && <path className={`chart__bar ${hover === k ? "is-hover" : ""}`} d={d} />}
              {k === tallest && c > 0 && (
                <text className="chart__value" x={x + barW / 2} y={y - 4} textAnchor="middle">
                  {c}
                </text>
              )}
            </g>
          );
        })}
        {[0, Math.floor(bins.counts.length / 2), bins.counts.length].map((k) => (
          <text key={k} className="chart__tick" x={PAD.l + k * slot} y={H - 4} textAnchor={k === 0 ? "start" : k === bins.counts.length ? "end" : "middle"}>
            {formatMs(bins.b0 + k * bins.step, 1)}
          </text>
        ))}
      </svg>
      {hover != null && (
        <div className="chart__tooltip" style={{ left: Math.min(Math.max(PAD.l + (hover + 0.5) * slot, 70), width - 70) }} role="status">
          <div className="chart__tooltip-row">
            <strong>{bins.counts[hover]}</strong>
            <span>
              solves · {label(hover)}s ({((bins.counts[hover]! / bins.total) * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
      {(bins.over > 0 || bins.under > 0) && (
        <div className="muted small chart__note">
          {bins.under + bins.over} outlier{bins.under + bins.over === 1 ? "" : "s"} outside the range not shown
        </div>
      )}
    </div>
  );
}
