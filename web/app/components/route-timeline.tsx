'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { TrainFront, MapPin, ChevronRight } from 'lucide-react';

interface Station {
  Sr: string | number;
  SN: string;
  SC?: string;
  STA?: string;
  STD?: string;
  ETA?: string;
  ETD?: string;
  DARR?: string;
  DDEP?: string;
  PF?: string | number;
  DIST?: string | number;
}

interface RouteTimelineProps {
  stations: Station[];
  currentIdx: number;
  sourceName: string;
  destName: string;
  trainName?: string;
  trainNumber?: string;
  totalDist?: string | number;
  delay?: string | number;
  updateTime?: string;
  status: string;
  statusClass: string;
}

function formatTime(raw?: string): string {
  if (!raw || raw === '----') return '—';
  const cleaned = raw.replace(/[^0-9]/g, '');
  if (cleaned.length !== 4) return raw;
  const hh = parseInt(cleaned.slice(0, 2), 10);
  const mm = cleaned.slice(2, 4);
  const p = hh >= 12 ? 'PM' : 'AM';
  return `${hh % 12 || 12}:${mm} ${p}`;
}

function isDelayed(s: Station): boolean {
  const d = s.DARR || s.DDEP;
  return d !== undefined && d !== 'On Time' && d !== '----' && d !== '';
}

function isHalt(s: Station): boolean {
  return !!s.STD && s.STD !== '----';
}

type TimelineRow =
  | { type: 'station'; station: Station; idx: number }
  | { type: 'segment'; key: string; stations: Station[]; startIdx: number; endIdx: number };

type VisibleRow =
  | { kind: 'station'; station: Station; idx: number }
  | { kind: 'segment-first'; station: Station; idx: number; segKey: string; total: number }
  | { kind: 'segment-summary'; segKey: string; count: number; viaStartIdx: number; viaStations: Station[]; passed: boolean };

function buildRows(stations: Station[], currentIdx: number): TimelineRow[] {
  const total = stations.length;
  const rows: TimelineRow[] = [];
  let i = 0;
  while (i < total) {
    if (i === 0 || i === currentIdx || i === total - 1 || isHalt(stations[i])) {
      rows.push({ type: 'station', station: stations[i], idx: i });
      i++;
    } else {
      const start = i;
      while (i < total && i !== 0 && i !== currentIdx && i !== total - 1 && !isHalt(stations[i])) {
        i++;
      }
      const count = i - start;
      if (count === 1) {
        rows.push({ type: 'station', station: stations[start], idx: start });
      } else {
        rows.push({ type: 'segment', key: `seg-${start}`, stations: stations.slice(start, i), startIdx: start, endIdx: i - 1 });
      }
    }
  }
  return rows;
}

function buildVisible(rows: TimelineRow[], expanded: Set<string>, currentIdx: number): VisibleRow[] {
  const out: VisibleRow[] = [];
  for (const r of rows) {
    if (r.type === 'station') {
      out.push({ kind: 'station', station: r.station, idx: r.idx });
    } else if (expanded.has(r.key)) {
      for (let o = 0; o < r.stations.length; o++) {
        out.push({ kind: 'station', station: r.stations[o], idx: r.startIdx + o });
      }
    } else {
      const first = r.stations[0];
      out.push({ kind: 'segment-first', station: first, idx: r.startIdx, segKey: r.key, total: r.stations.length });
      const rest = r.stations.slice(1);
      if (rest.length > 0) {
        out.push({ kind: 'segment-summary', segKey: r.key, count: rest.length, viaStartIdx: r.startIdx + 1, viaStations: rest, passed: (r.startIdx + 1) < currentIdx });
      }
    }
  }
  return out;
}

export default function RouteTimeline({
  stations, currentIdx, sourceName, destName, totalDist,
  delay: overallDelay, updateTime, status, statusClass,
}: RouteTimelineProps) {
  if (!stations || stations.length === 0) return null;

  const total = stations.length;
  const lastIdx = total - 1;

  const rows = useMemo(() => buildRows(stations, currentIdx), [stations, currentIdx]);

  const autoExpandKeys = useMemo(
    () => new Set(
      rows
        .filter((r): r is Extract<TimelineRow, { type: 'segment' }> =>
          r.type === 'segment' && currentIdx >= r.startIdx && currentIdx <= r.endIdx)
        .map(r => r.key)
    ),
    [rows, currentIdx]
  );

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(autoExpandKeys));

  useEffect(() => {
    if (autoExpandKeys.size === 0) return;
    setExpanded(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const k of autoExpandKeys) {
        if (!next.has(k)) { next.add(k); changed = true; }
      }
      return changed ? next : prev;
    });
  }, [autoExpandKeys]);

  const toggle = useCallback((key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const visible = useMemo(() => buildVisible(rows, expanded, currentIdx), [rows, expanded, currentIdx]);

  const currentDist = currentIdx >= 0 && stations[currentIdx]?.DIST ? Number(stations[currentIdx].DIST) : 0;
  const totalDistNum = totalDist ? Number(totalDist) : 0;
  const progressPct = totalDistNum > 0 && currentDist > 0
    ? Math.round(Math.min((currentDist / totalDistNum) * 100, 100))
    : total > 1
      ? Math.round((currentIdx / (total - 1)) * 100)
      : 0;

  const currentStation = currentIdx >= 0 && currentIdx < total ? stations[currentIdx] : null;
  const nextPassingIdx = currentIdx >= 0
    ? stations.findIndex((s, i) => i > currentIdx && !isHalt(s))
    : -1;
  const nextPassing = nextPassingIdx >= 0 ? stations[nextPassingIdx] : null;
  const nextStopIdx = currentIdx >= 0
    ? stations.findIndex((s, i) => i > currentIdx && isHalt(s))
    : -1;
  const nextStop = nextStopIdx >= 0 ? stations[nextStopIdx] : null;
  const nextStopName = nextStop?.SN || (currentIdx < lastIdx ? stations[lastIdx].SN : null);

  return (
    <div className="rounded-lg border border-border-primary bg-bg-elevated overflow-hidden">
      <div className="border-b border-border-primary px-4 py-3 sm:px-5">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-text-secondary">
            <span className="truncate font-medium">{sourceName}</span>
            <span className="text-text-quaternary shrink-0">→</span>
            <span className="truncate font-medium">{destName}</span>
            {totalDist && <span className="shrink-0 font-mono text-text-tertiary">{totalDist} km</span>}
          </div>
          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-mono font-medium ${statusClass}`}>{status}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-text-tertiary">
          <span>{total} stops</span>
          <span className="font-mono">{currentIdx + 1}/{total}</span>
          {overallDelay && overallDelay !== '0' && (
            <span className="text-status-delayed font-medium">+{overallDelay} min</span>
          )}
          {updateTime && <span className="hidden sm:inline">{updateTime}</span>}
        </div>
      </div>

      <div className="px-4 pt-3 pb-2 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-[11px] font-semibold text-text-primary font-mono w-9 text-right tabular-nums">{progressPct}%</span>
          <div className="relative flex-1 h-4">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-bg-secondary overflow-hidden">
              <div className="absolute inset-y-0 left-0 rounded-full bg-status-info transition-all duration-700 ease-out"
                style={{ width: `${Math.min(progressPct, 100)}%` }} />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 size-3 rounded-full border-2 border-bg-elevated bg-status-info shadow-sm transition-all duration-700 ease-out z-10"
              style={{ left: `calc(${Math.min(progressPct, 100)}% - 6px)` }} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {currentStation && <span className="font-semibold text-text-primary">{currentStation.SN}</span>}
          {nextPassing && <span className="font-medium text-amber-400">PASS {nextPassing.SN}</span>}
          {nextStopName && <span className="font-medium text-emerald-400">STOP {nextStopName}</span>}
        </div>
      </div>

      <div className="px-4 pb-3 pt-3 sm:px-5">
        {visible.map((v, vi) => {
          const isFirst = vi === 0;
          const isLast = vi === visible.length - 1;

          if (v.kind === 'segment-summary') {
            const color = v.passed ? 'bg-status-ontime/60' : 'bg-border-secondary';
            const firstVia = v.viaStations[0];
            const lastVia = v.viaStations[v.viaStations.length - 1];
            return (
              <div key={`sum-${v.segKey}`} className="flex min-h-[28px]">
                <div className="w-14 shrink-0" />
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <div className="flex-1 w-0.5 rounded-full bg-border-secondary" style={{ background: v.passed ? undefined : undefined }}>
                    <div className={`h-full w-full rounded-full ${color}`} />
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 items-center pl-2.5">
                  <button
                    onClick={() => toggle(v.segKey)}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-bg-secondary transition-colors"
                  >
                    <ChevronRight className="size-3 shrink-0" />
                    <span>{v.count} more {v.count === 1 ? 'station' : 'stations'}</span>
                    {firstVia && (
                      <span className="text-text-quaternary hidden sm:inline">
                        via {firstVia.SN}{lastVia && lastVia !== firstVia ? `, ${lastVia.SN}` : ''}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            );
          }

          const s = v.station;
          const i = v.idx;
          const passed = i < currentIdx;
          const current = i === currentIdx;
          const upcoming = i > currentIdx;
          const destination = i === lastIdx;
          const delayed = isDelayed(s);
          const connectorColor = passed ? 'bg-status-ontime/60' : 'bg-border-secondary';

          return (
            <div key={current ? 'cur' : `${s.Sr ?? i}`} className="flex">
              <div className="flex w-14 shrink-0 flex-col items-end justify-center pr-2">
                <span className={`font-mono text-[11px] leading-tight ${
                  current ? 'font-semibold text-status-info'
                  : delayed && destination ? 'font-semibold text-status-delayed'
                  : passed ? 'text-text-tertiary'
                  : 'text-text-secondary'
                }`}>
                  {current || upcoming
                    ? formatTime(s.ETA || s.STA)
                    : formatTime(s.DDEP || s.STD || s.STA)}
                </span>
                {current && (s.ETA || s.STA) && (
                  <span className="font-mono text-[9px] leading-tight text-text-quaternary">ETA</span>
                )}
              </div>

              <div className="flex w-6 shrink-0 flex-col items-center">
                {isFirst ? (
                  <div className="flex-1 min-h-[8px]" />
                ) : (
                  <div className="flex-1 min-h-[4px] flex justify-center">
                    <div className={`w-0.5 h-full rounded-full ${connectorColor}`} />
                  </div>
                )}

                {current ? (
                  <div className="relative z-10 my-0.5 flex size-8 shrink-0 items-center justify-center">
                    <span className="absolute inset-0 rounded-full bg-status-info/20 animate-ping" />
                    <span className="relative flex size-8 items-center justify-center rounded-full bg-status-info shadow-[0_0_10px_rgba(37,99,235,0.35)]">
                      <TrainFront className="size-4 text-white" />
                    </span>
                  </div>
                ) : passed ? (
                  <div className="z-10 my-0.5 size-3 shrink-0 rounded-full bg-status-ontime ring-[3px] ring-bg-elevated" />
                ) : destination ? (
                  <div className="z-10 my-0.5 flex size-4 shrink-0 items-center justify-center">
                    <MapPin className="size-4 text-status-delayed" />
                  </div>
                ) : (
                  <div className="z-10 my-0.5 size-3 shrink-0 rounded-full bg-status-info/35 ring-[3px] ring-bg-elevated" />
                )}

                {isLast ? (
                  <div className="flex-1 min-h-[8px]" />
                ) : (
                  <div className="flex-1 min-h-[4px] flex justify-center">
                    <div className={`w-0.5 h-full rounded-full ${connectorColor}`} />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 items-start gap-2 pl-2.5">
                <div className="min-w-0 flex-1 py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`truncate text-sm ${
                      current ? 'font-bold text-text-primary'
                      : passed ? 'text-text-tertiary'
                      : 'font-semibold text-text-primary'
                    }`}>
                      {s.SN}
                    </span>
                    {s.SC && (
                      <span className="hidden shrink-0 font-mono text-[10px] uppercase text-text-quaternary sm:inline">
                        {s.SC}
                      </span>
                    )}
                    {upcoming && !destination && !isHalt(s) && (
                      <span className="shrink-0 rounded-sm bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-amber-400">
                        PASS
                      </span>
                    )}
                    {upcoming && !destination && isHalt(s) && (
                      <span className="shrink-0 rounded-sm bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-emerald-400">
                        STOP
                      </span>
                    )}
                    {current && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-status-info/15 px-1.5 py-0.5 text-[10px] font-semibold text-status-info">
                        <span className="inline-block size-1.5 animate-pulse rounded-full bg-current" />
                        HERE
                      </span>
                    )}
                    {v.kind === 'segment-first' && v.total > 1 && (
                      <button
                        onClick={() => toggle(v.segKey)}
                        className="inline-flex items-center gap-0.5 rounded-sm bg-bg-secondary px-1.5 py-0.5 text-[9px] text-text-tertiary hover:text-text-secondary transition-colors"
                      >
                        <ChevronRight className="size-2.5" />
                        <span>+{v.total - 1}</span>
                      </button>
                    )}
                  </div>

                  {passed && delayed && (
                    <div className="mt-0.5 text-[10px] font-medium text-status-delayed">
                      {s.DARR || s.DDEP} late
                    </div>
                  )}

                  {current && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-text-tertiary">
                      {s.ETD && s.ETD !== '----' && <span>Dep {formatTime(s.ETD)}</span>}
                      {s.PF && <span>PF {s.PF}</span>}
                      {delayed && <span className="text-status-delayed font-medium">{s.DDEP || s.DARR} late</span>}
                    </div>
                  )}

                  {destination && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                      {s.ETA && s.ETA !== '----' && (
                        <span className="font-semibold text-status-delayed">ETA {formatTime(s.ETA)}</span>
                      )}
                      {s.PF && <span className="text-text-tertiary">Platform #{s.PF}</span>}
                    </div>
                  )}
                </div>

                <div className="shrink-0 py-1 text-right">
                  {current ? (
                    <span className={`font-mono text-[11px] font-semibold ${
                      delayed && s.ETD ? 'text-status-delayed' : 'text-status-info'
                    }`}>
                      {formatTime(s.ETD || s.STD)}
                    </span>
                  ) : passed ? (
                    <span className="font-mono text-[11px] text-text-tertiary">
                      {formatTime(s.DDEP || s.STD)}
                    </span>
                  ) : destination ? null : s.PF ? (
                    <span className="font-mono text-[11px] text-text-quaternary">PF {s.PF}</span>
                  ) : (
                    <span className="font-mono text-[11px] text-text-quaternary">{formatTime(s.STD)}</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
