'use client';

import { useState, useCallback } from 'react';
import {
  Search, Train, Calendar, MapPin, ArrowLeftRight, Activity, AlertTriangle, Ticket,
} from 'lucide-react';
import Header from './components/header';
import ToolCard from './components/tool-card';
import RouteTimeline from './components/route-timeline';

function toDDMonYYYY(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')}-${months[m - 1]}-${y}`;
}

const MONTH_MAP: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

function parseTrainTime(timeStr: string, refDateStr: string): Date | null {
  if (!timeStr || timeStr === '----') return null;
  const parts = timeStr.split(' ');
  if (parts.length !== 2) return null;
  const [hm, dayMon] = parts;
  const [hhStr, mmStr] = hm.split(':');
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  const day = parseInt(dayMon.slice(0, 2), 10);
  const mon = dayMon.slice(3);
  if (isNaN(hh) || isNaN(mm) || isNaN(day) || MONTH_MAP[mon] === undefined) return null;
  const refParts = refDateStr.split(' ');
  if (refParts.length < 2) return null;
  const refDateParts = refParts[0].split('-');
  const year = parseInt(refDateParts[2], 10);
  if (isNaN(year)) return null;
  return new Date(year, MONTH_MAP[mon], day, hh, mm, 0, 0);
}

function parseRefTime(refDateStr: string): Date | null {
  if (!refDateStr) return null;
  const parts = refDateStr.split(' ');
  if (parts.length < 2) return null;
  const dateParts = parts[0].split('-');
  if (dateParts.length !== 3) return null;
  const [dd, mon, yyyy] = dateParts;
  const [hh, mm] = parts[1].split(':').map(Number);
  if (MONTH_MAP[mon] === undefined || isNaN(hh) || isNaN(mm) || isNaN(parseInt(dd, 10)) || isNaN(parseInt(yyyy, 10))) return null;
  return new Date(parseInt(yyyy, 10), MONTH_MAP[mon], parseInt(dd, 10), hh, mm, 0, 0);
}

function parseStationTime(timeStr: string, refDateStr: string, dayOffset: number): Date | null {
  if (!timeStr || timeStr === '----' || timeStr === 'On Time') return null;
  const parts = timeStr.split(':');
  if (parts.length !== 2) return null;
  const hh = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10);
  if (isNaN(hh) || isNaN(mm)) return null;
  const dateMatch = refDateStr.match(/^(\d{1,2})-(\w{3})-(\d{4})/);
  if (!dateMatch) return null;
  const [_, dd, mon, yyyy] = dateMatch;
  if (MONTH_MAP[mon] === undefined) return null;
  return new Date(parseInt(yyyy, 10), MONTH_MAP[mon], parseInt(dd, 10) + dayOffset, hh, mm, 0, 0);
}

type View = 'search' | 'trainInfo' | 'schedule' | 'stationLive' | 'trainsBetween' | 'liveStatus' | 'exceptions' | 'pnr';

interface FormState {
  [key: string]: string;
}

export default function Home() {
  const [view, setView] = useState<View | null>(null);
  const [form, setForm] = useState<FormState>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [lastLiveParams, setLastLiveParams] = useState<{ trainNo: string; startDate: string } | null>(null);
  const [inlineLiveResult, setInlineLiveResult] = useState<any>(null);
  const [inlineLiveLoading, setInlineLiveLoading] = useState(false);
  const [inlineLiveError, setInlineLiveError] = useState<string | null>(null);
  const [lastInlineLiveParams, setLastInlineLiveParams] = useState<{ trainNo: string; startDate: string } | null>(null);

  const updateForm = (key: string, value: string) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const clearForm = () => {
    setForm({});
    setError(null);
    setResult(null);
  };

  const openView = useCallback((v: View) => {
    clearForm();
    setView(v);
  }, []);

  const goHome = useCallback(() => {
    setView(null);
    clearForm();
  }, []);

  const tools: { id: View; title: string; description: string; icon: any }[] = [
    { id: 'search', title: 'Search Train', description: 'Find trains by number or name', icon: Search },
    { id: 'trainInfo', title: 'Train Info', description: 'Get detailed train information', icon: Train },
    { id: 'schedule', title: 'Schedule', description: 'View train schedule with stops', icon: Calendar },
    { id: 'stationLive', title: 'Station Live', description: 'Live trains at a station', icon: MapPin },
    { id: 'trainsBetween', title: 'Trains Between', description: 'Find trains between stations', icon: ArrowLeftRight },
    { id: 'liveStatus', title: 'Live Status', description: 'Real-time train running status', icon: Activity },
    { id: 'exceptions', title: 'Exceptions', description: 'Train cancellations & diversions', icon: AlertTriangle },
    { id: 'pnr', title: 'PNR Status', description: 'Check PNR status & passenger details', icon: Ticket },
  ];

  async function refreshLiveStatus() {
    if (!lastLiveParams) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/ntes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'liveStatus', params: lastLiveParams }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Request failed');
      } else {
        setResult(data.data);
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  async function trackLiveTrain(e: React.FormEvent) {
    e.preventDefault();
    const trainNo = form.inlineTrainNo?.trim();
    if (!trainNo) return;
    setInlineLiveLoading(true);
    setInlineLiveError(null);
    setInlineLiveResult(null);
    try {
      const params = {
        trainNo,
        startDate: toDDMonYYYY(form.inlineStartDate || new Date().toISOString().split('T')[0]),
      };
      setLastInlineLiveParams(params);
      const res = await fetch('/api/ntes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'liveStatus', params }),
      });
      const data = await res.json();
      if (!data.success) {
        setInlineLiveError(data.error || 'Request failed');
      } else {
        setInlineLiveResult(data.data);
      }
    } catch (e: any) {
      setInlineLiveError(e.message || 'Network error');
    } finally {
      setInlineLiveLoading(false);
    }
  }

  async function refreshInlineLive() {
    if (!lastInlineLiveParams) return;
    setInlineLiveLoading(true);
    setInlineLiveError(null);
    setInlineLiveResult(null);
    try {
      const res = await fetch('/api/ntes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method: 'liveStatus', params: lastInlineLiveParams }),
      });
      const data = await res.json();
      if (!data.success) {
        setInlineLiveError(data.error || 'Request failed');
      } else {
        setInlineLiveResult(data.data);
      }
    } catch (e: any) {
      setInlineLiveError(e.message || 'Network error');
    } finally {
      setInlineLiveLoading(false);
    }
  }

  async function submit(method: View) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const params: Record<string, string> = {};
      switch (method) {
        case 'search': params.query = form.query; break;
        case 'trainInfo': params.trainNo = form.trainNo; break;
        case 'schedule': params.trainNo = form.trainNo; params.startDate = (form.startDate || '').replace(/-/g, ''); break;
        case 'stationLive': params.stationCode = form.stationCode; params.hours = form.hours || '2'; break;
        case 'trainsBetween': params.fromStation = form.fromStation; params.toStation = form.toStation; params.trainType = form.trainType || 'XXX'; break;
        case 'liveStatus':
          params.trainNo = form.trainNo;
          params.startDate = toDDMonYYYY(form.startDate || '');
          setLastLiveParams({ trainNo: params.trainNo, startDate: params.startDate });
          break;
        case 'exceptions': params.trainNo = form.trainNo; break;
        case 'pnr': params.pnr = form.pnr; break;
      }
      const res = await fetch('/api/ntes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, params }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error || 'Request failed');
      } else {
        setResult(data.data);
      }
    } catch (e: any) {
      setError(e.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  function renderForm() {
    const inputs: { key: string; label: string; placeholder: string; type?: string }[] = [];

    switch (view) {
      case 'search':
        inputs.push({ key: 'query', label: 'Train number or name', placeholder: 'e.g. 12301 or Rajdhani' });
        break;
      case 'trainInfo':
        inputs.push({ key: 'trainNo', label: 'Train number', placeholder: 'e.g. 12301' });
        break;
      case 'schedule':
        inputs.push({ key: 'trainNo', label: 'Train number', placeholder: 'e.g. 12301' });
        inputs.push({ key: 'startDate', label: 'Start date (optional)', placeholder: 'e.g. 2024-06-15 — blank for today', type: 'date' });
        break;
      case 'stationLive':
        inputs.push({ key: 'stationCode', label: 'Station code', placeholder: 'e.g. NDLS' });
        inputs.push({ key: 'hours', label: 'Hours (1-4)', placeholder: '2' });
        break;
      case 'trainsBetween':
        inputs.push({ key: 'fromStation', label: 'From station code', placeholder: 'e.g. NDLS' });
        inputs.push({ key: 'toStation', label: 'To station code', placeholder: 'e.g. BCT' });
        break;
      case 'liveStatus':
        inputs.push({ key: 'trainNo', label: 'Train number', placeholder: 'e.g. 12301' });
        inputs.push({ key: 'startDate', label: 'Start date', placeholder: 'e.g. 2026-06-15', type: 'date' });
        break;
      case 'exceptions':
        inputs.push({ key: 'trainNo', label: 'Train number', placeholder: 'e.g. 12301' });
        break;
      case 'pnr':
        inputs.push({ key: 'pnr', label: 'PNR number', placeholder: 'e.g. 1234567890' });
        break;
    }

    return (
      <form onSubmit={e => { e.preventDefault(); submit(view!); }} className="space-y-4">
        {inputs.map(({ key, label, placeholder, type }) => (
          <div key={key}>
            <label className="mb-1.5 block text-xs font-medium text-text-secondary">{label}</label>
            <input
              type={type || 'text'}
              value={form[key] || ''}
              onChange={e => updateForm(key, e.target.value)}
              placeholder={placeholder}
              className="w-full rounded-lg border border-border-primary bg-bg-elevated px-3.5 py-2.5 text-sm text-text-primary placeholder-text-quaternary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
              required
            />
          </div>
        ))}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Submit'}
        </button>
      </form>
    );
  }

  function SearchResult({ data }: { data: any }) {
    const trains = data.Trains || [];
    if (!trains.length) return <EmptyResult />;
    return (
      <div className="space-y-2">
        {trains.map((t: any, i: number) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-elevated px-4 py-3">
            <div>
              <span className="font-mono text-sm font-semibold text-text-primary">{t.TrainNumber}</span>
              <span className="ml-3 text-sm text-text-secondary">{t.TrainName}</span>
            </div>
            <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">{t.TrainType}</span>
          </div>
        ))}
      </div>
    );
  }

  function TrainInfoResult({ data }: { data: any }) {
    if (!data || !data.TrainNo) return <EmptyResult />;
    const statusMap: Record<number, string> = { 0: 'Not Started', 1: 'Running', 2: 'Arrived', 3: 'Cancelled' };
    const statusColor: Record<number, string> = {
      0: 'bg-status-ontime/10 text-status-ontime',
      1: 'bg-status-info/10 text-status-info',
      2: 'bg-status-ontime/10 text-status-ontime',
      3: 'bg-status-cancelled/10 text-status-cancelled',
    };
    return (
      <div className="rounded-lg border border-border-primary bg-bg-elevated">
        <div className="border-b border-border-primary px-5 py-4">
          <div className="font-mono text-xs text-text-tertiary">#{data.TrainNo}</div>
          <div className="mt-0.5 text-lg font-semibold tracking-tight text-text-primary">{data.TrainName}</div>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-secondary">
            <span>{data.SrcName || data.Src} → {data.DstnName || data.Dstn}</span>
            {data.TravelTime && <span className="font-mono">{data.TravelTime}h</span>}
          </div>
        </div>
        {data.vInstanceList && data.vInstanceList.length > 0 && (
          <div className="divide-y divide-border-primary">
            {data.vInstanceList.map((inst: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div>
                  <span className="font-mono text-sm text-text-secondary">{inst.startDate}</span>
                  {inst.trainPosition && (
                    <span className="ml-2 text-xs text-text-tertiary">{inst.trainPosition}</span>
                  )}
                </div>
                <span className={`rounded-md px-2.5 py-0.5 font-mono text-xs font-medium ${statusColor[inst.trainStatus] || 'bg-bg-tertiary text-text-tertiary'}`}>
                  {statusMap[inst.trainStatus] || inst.excpMsg || '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function ScheduleResult({ data }: { data: any }) {
    if (!data || !data.stations) return <EmptyResult />;
    const { TrainNumber, TrainName, stations, SourceName, DestinationName } = data;
    return (
      <div className="rounded-lg border border-border-primary bg-bg-elevated overflow-hidden">
        <div className="border-b border-border-primary px-5 py-3">
          <div className="font-mono text-xs text-text-tertiary">#{TrainNumber}</div>
          <div className="mt-0.5 text-base font-semibold tracking-tight text-text-primary">{TrainName}</div>
          {(SourceName || DestinationName) && (
            <div className="mt-1 text-xs text-text-secondary">{SourceName} → {DestinationName}</div>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary bg-bg-secondary text-xs font-medium text-text-tertiary">
                <th className="px-4 py-2.5 text-left">#</th>
                <th className="px-4 py-2.5 text-left">Station</th>
                <th className="px-4 py-2.5 text-left w-20">Code</th>
                <th className="px-4 py-2.5 text-center w-16">Arr</th>
                <th className="px-4 py-2.5 text-center w-16">Dep</th>
                <th className="px-4 py-2.5 text-right w-16">Dist</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {stations.map((s: any, i: number) => (
                <tr key={i} className="hover:bg-bg-secondary/50 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{s.Sr}</td>
                  <td className="px-4 py-2.5 font-medium text-text-primary">{s.StationName}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{s.StationCode}</td>
                  <td className={`px-4 py-2.5 text-center font-mono text-xs ${!s.STA ? 'text-text-quaternary' : 'text-text-primary'}`}>{s.STA || '—'}</td>
                  <td className={`px-4 py-2.5 text-center font-mono text-xs ${!s.STD ? 'text-text-quaternary' : 'text-text-primary'}`}>{s.STD || '—'}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-text-tertiary">{s.Distance || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  function StationLiveResult({ data }: { data: any }) {
    if (!data || !data.TrainsAtStation) return <EmptyResult />;
    const { StationName, TrainsAtStation } = data;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3.5">
          <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium">Station</div>
          <div className="mt-0.5 text-base font-semibold tracking-tight text-text-primary">{StationName}</div>
        </div>
        {TrainsAtStation.length === 0 ? (
          <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-8 text-center text-sm text-text-tertiary">
            No trains found at this station
          </div>
        ) : (
          <div className="space-y-2">
            {TrainsAtStation.map((t: any, i: number) => (
              <div key={i} className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-sm font-semibold text-text-primary">{t.TrainNumber}</span>
                    <span className="ml-2.5 text-sm text-text-secondary">{t.TrainName}</span>
                  </div>
                  <span className="text-xs font-mono text-text-tertiary">{t.Platform ? `PF ${t.Platform}` : '—'}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-tertiary">Source: </span>
                    <span className="text-text-secondary font-mono">{t.Source}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Dest: </span>
                    <span className="text-text-secondary font-mono">{t.Destination}</span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Arr: </span>
                    <span className="font-mono text-text-primary">{t.STA || t.ETA || '—'}</span>
                    {t.DelayArr && t.DelayArr !== '0' && t.DelayArr !== 'RT' && <span className="ml-1.5 text-status-delayed">+{t.DelayArr}m</span>}
                  </div>
                  <div>
                    <span className="text-text-tertiary">Dep: </span>
                    <span className="font-mono text-text-primary">{t.STD || t.ETD || '—'}</span>
                    {t.DelayDep && t.DelayDep !== '0' && t.DelayDep !== 'RT' && <span className="ml-1.5 text-status-delayed">+{t.DelayDep}m</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function TrainsBetweenResult({ data }: { data: any }) {
    if (!data) return <EmptyResult />;
    const trains = data.Trains || data;
    const arr = Array.isArray(trains) ? trains : [];
    return (
      <div className="space-y-3">
        {(data.StationFrom || data.StationTo) && (
          <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3.5">
            <div className="text-xs text-text-tertiary">
              {data.StationFrom} <span className="mx-1">→</span> {data.StationTo}
            </div>
          </div>
        )}
        {arr.length === 0 ? (
          <EmptyResult />
        ) : (
          <div className="space-y-2">
            {arr.map((t: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-border-primary bg-bg-elevated px-4 py-3">
                <div>
                  <span className="font-mono text-sm font-semibold text-text-primary">{t.TrainNumber}</span>
                  <span className="ml-3 text-sm text-text-secondary">{t.TrainName}</span>
                </div>
                <span className="rounded-md bg-accent-soft px-2 py-0.5 font-mono text-xs text-accent">{t.TrainType}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function LiveStatusResult({ data, onRefresh }: { data: any; onRefresh?: () => void }) {
    if (!data || !data.TN) return <EmptyResult />;
    const { TN, TNM, TNH, SRC, SRCN, DSTN, DSTNN, CPOS, TTLDIST, LDEL, TRUNST,
            LTIME, LUPDFULL, LSTNSR, LEVNT, STD, STNS } = data;

    const runStatusMap: Record<number, string> = { 0: 'Not Started', 1: 'Running', 2: 'Arrived', 3: 'Cancelled' };
    const runStatusColor: Record<number, string> = {
      0: 'bg-status-ontime/10 text-status-ontime',
      1: 'bg-status-info/10 text-status-info',
      2: 'bg-status-ontime/10 text-status-ontime',
      3: 'bg-status-cancelled/10 text-status-cancelled',
    };
    const status = TRUNST !== undefined ? runStatusMap[TRUNST] : null;
    const statusCls = TRUNST !== undefined ? runStatusColor[TRUNST] : '';

    const totalStations = STNS?.length || 0;
    const getCurrentIdx = (stations: any[], lstnsr: any, cpos: any, ltime: string): number => {
      if (!stations?.length) return 0;

      if (lstnsr !== undefined && lstnsr !== null && lstnsr !== '') {
        const idx = stations.findIndex((s: any) => Number(s.Sr) === Number(lstnsr));
        if (idx >= 0) return idx;
      }

      if (ltime) {
        const refDate = parseRefTime(ltime);
        if (refDate) {
          let lastDeparted = -1;
          let prevMinutes = -1;
          let dayOffset = 0;

          for (let i = 0; i < stations.length; i++) {
            const s = stations[i];
            const depStr = s.ETD || s.STD || '';
            const arrStr = s.ETA || s.STA || '';

            if (depStr && depStr !== '----') {
              const dp = depStr.split(':');
              if (dp.length === 2) {
                const hh = parseInt(dp[0], 10);
                const mm = parseInt(dp[1], 10);
                if (!isNaN(hh) && !isNaN(mm)) {
                  const mins = hh * 60 + mm;
                  if (prevMinutes >= 0 && mins < prevMinutes) dayOffset++;
                  prevMinutes = mins;
                }
              }
              const depDate = parseStationTime(depStr, ltime, dayOffset);
              if (depDate && depDate <= refDate) {
                lastDeparted = i;
                continue;
              }
            }

            if (arrStr && arrStr !== '----') {
              const ap = arrStr.split(':');
              if (ap.length === 2) {
                const hh = parseInt(ap[0], 10);
                const mm = parseInt(ap[1], 10);
                if (!isNaN(hh) && !isNaN(mm)) {
                  const mins = hh * 60 + mm;
                  if (prevMinutes >= 0 && mins < prevMinutes) dayOffset++;
                  prevMinutes = mins;
                }
              }
              const arrDate = parseStationTime(arrStr, ltime, dayOffset);
              if (arrDate && arrDate <= refDate) {
                return i;
              }
            }

            return lastDeparted >= 0 ? lastDeparted : 0;
          }

          return stations.length - 1;
        }
      }

      if (cpos !== undefined && cpos !== null && cpos !== '') {
        const cp = Number(cpos);
        if (!isNaN(cp) && cp >= 0 && cp < stations.length) return cp;
        if (!isNaN(cp) && cp > 0 && cp < stations.length) return cp - 1;
      }

      for (let i = stations.length - 1; i >= 0; i--) {
        const s = stations[i];
        if ((s.ETD && s.ETD !== '----' && s.ETD !== '') || (s.ETA && s.ETA !== '----' && s.ETA !== '')) return i;
      }
      return 0;
    };
    const currentIdx = getCurrentIdx(STNS, LSTNSR, CPOS, LTIME);

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3.5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-xs text-text-tertiary">#{TN}</div>
              <div className="mt-0.5 text-lg font-semibold tracking-tight text-text-primary truncate">{TNM}</div>
              {TNH && <div className="text-xs text-text-tertiary/70 font-medium truncate">{TNH}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2 ml-3">
              {status && <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium font-mono ${statusCls}`}>{status}</span>}
              {onRefresh && (
                <button onClick={onRefresh} className="rounded-lg border border-border-primary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-secondary transition-colors">
                  Refresh
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
            <span>{(SRCN || SRC)} → {DSTNN || DSTN}</span>
            <span className="font-mono">Start: {STD}</span>
            {TTLDIST && <span className="font-mono">{TTLDIST} km</span>}
            {totalStations > 0 && <span className="font-mono">{totalStations} stops</span>}
            {LDEL && LDEL !== '0' && <span className="font-mono text-status-delayed">Delay: {LDEL} min</span>}
            {LTIME && <span className="text-text-tertiary">Updated: {LTIME}</span>}
          </div>

          {STNS && STNS.length > 0 && (
            <div className="mt-3">
              <RouteTimeline
                stations={STNS}
                currentIdx={currentIdx >= 0 ? currentIdx : 0}
                sourceName={SRCN || SRC}
                destName={DSTNN || DSTN}
                trainName={TNM}
                trainNumber={TN}
                totalDist={TTLDIST}
                delay={LDEL}
                updateTime={LTIME}
                status={status || '—'}
                statusClass={statusCls || ''}
              />
            </div>
          )}
        </div>

        {LUPDFULL && (
          <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3">
            <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium mb-1.5">Current Status</div>
            <p className="text-sm text-text-primary leading-relaxed">{LUPDFULL}</p>
          </div>
        )}

        {STNS && STNS.length > 0 && (
          <div className="rounded-lg border border-border-primary bg-bg-elevated overflow-hidden">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-primary bg-bg-secondary text-xs font-medium text-text-tertiary">
                    <th className="px-4 py-2.5 text-left">#</th>
                    <th className="px-4 py-2.5 text-left">Station</th>
                    <th className="px-4 py-2.5 text-left w-14">Code</th>
                    <th className="px-4 py-2.5 text-center w-16">Sch Arr</th>
                    <th className="px-4 py-2.5 text-center w-16">Sch Dep</th>
                    <th className="px-4 py-2.5 text-center w-16">ETA</th>
                    <th className="px-4 py-2.5 text-center w-16">ETD</th>
                    <th className="px-4 py-2.5 text-center w-14">Delay</th>
                    <th className="px-4 py-2.5 text-center w-10">PF</th>
                    <th className="px-4 py-2.5 text-right w-14">Dist</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {STNS.map((s: any, i: number) => {
                    const isCurrent = i === currentIdx;
                    const delayText = (s.DARR && s.DARR !== 'On Time' && s.DARR !== '') ? s.DARR :
                                      (s.DDEP && s.DDEP !== 'On Time' && s.DDEP !== '') ? s.DDEP : null;
                    return (
                      <tr key={i} className={`hover:bg-bg-secondary/50 transition-colors ${isCurrent ? 'bg-status-info/5 border-l-2 border-l-status-info' : ''}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-tertiary">{s.Sr}</td>
                        <td className="px-4 py-2.5 font-medium text-text-primary">
                          {s.SN}
                          {isCurrent && <span className="ml-2 rounded bg-status-info/15 px-1.5 py-0.5 text-[10px] text-status-info font-medium">● HERE</span>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{s.SC || '—'}</td>
                        <td className={`px-4 py-2.5 text-center font-mono text-xs ${s.STA && s.STA !== '----' ? 'text-text-primary' : 'text-text-quaternary'}`}>{s.STA && s.STA !== '----' ? s.STA : '—'}</td>
                        <td className={`px-4 py-2.5 text-center font-mono text-xs ${s.STD && s.STD !== '----' ? 'text-text-primary' : 'text-text-quaternary'}`}>{s.STD && s.STD !== '----' ? s.STD : '—'}</td>
                        <td className={`px-4 py-2.5 text-center font-mono text-xs ${s.ETA && s.ETA !== '----' ? (s.ETA !== s.STA && s.STA !== '----' ? 'text-status-delayed' : 'text-status-ontime') : 'text-text-quaternary'}`}>{s.ETA && s.ETA !== '----' ? s.ETA : '—'}</td>
                        <td className={`px-4 py-2.5 text-center font-mono text-xs ${s.ETD && s.ETD !== '----' ? (s.ETD !== s.STD && s.STD !== '----' ? 'text-status-delayed' : 'text-status-ontime') : 'text-text-quaternary'}`}>{s.ETD && s.ETD !== '----' ? s.ETD : '—'}</td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs">
                          {delayText
                            ? <span className="text-status-delayed">{delayText}</span>
                            : <span className="text-status-ontime">On Time</span>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-xs text-text-secondary">{s.PF || '—'}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-text-tertiary">{s.DIST !== undefined ? `${s.DIST}` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-border-primary">
              {STNS.map((s: any, i: number) => {
                const isCurrent = i === currentIdx;
                const delayText = (s.DARR && s.DARR !== 'On Time' && s.DARR !== '') ? s.DARR :
                                  (s.DDEP && s.DDEP !== 'On Time' && s.DDEP !== '') ? s.DDEP : null;
                return (
                  <div key={i} className={`px-4 py-3 ${isCurrent ? 'bg-status-info/5 border-l-2 border-l-status-info' : ''}`}>
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-[11px] text-text-quaternary shrink-0">#{s.Sr}</span>
                        <span className="font-medium text-sm text-text-primary truncate">{s.SN}</span>
                        {s.SC && <span className="font-mono text-[11px] text-text-tertiary shrink-0">{s.SC}</span>}
                        {isCurrent && <span className="rounded bg-status-info/15 px-1.5 py-0.5 text-[10px] text-status-info font-medium shrink-0">HERE</span>}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className={`font-mono text-[11px] ${delayText ? 'text-status-delayed' : 'text-status-ontime'}`}>
                          {delayText || 'On Time'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                      <div className="flex justify-between text-text-tertiary">
                        <span>Arr:</span>
                        <span className={`font-mono ${s.STA && s.STA !== '----' ? 'text-text-primary' : 'text-text-quaternary'}`}>{s.STA && s.STA !== '----' ? s.STA : '—'}</span>
                      </div>
                      <div className="flex justify-between text-text-tertiary">
                        <span>Dep:</span>
                        <span className={`font-mono ${s.STD && s.STD !== '----' ? 'text-text-primary' : 'text-text-quaternary'}`}>{s.STD && s.STD !== '----' ? s.STD : '—'}</span>
                      </div>
                      <div className="flex justify-between text-text-tertiary">
                        <span>ETA:</span>
                        <span className={`font-mono ${s.ETA && s.ETA !== '----' ? (s.ETA !== s.STA && s.STA !== '----' ? 'text-status-delayed' : 'text-status-ontime') : 'text-text-quaternary'}`}>{s.ETA && s.ETA !== '----' ? s.ETA : '—'}</span>
                      </div>
                      <div className="flex justify-between text-text-tertiary">
                        <span>ETD:</span>
                        <span className={`font-mono ${s.ETD && s.ETD !== '----' ? (s.ETD !== s.STD && s.STD !== '----' ? 'text-status-delayed' : 'text-status-ontime') : 'text-text-quaternary'}`}>{s.ETD && s.ETD !== '----' ? s.ETD : '—'}</span>
                      </div>
                      {s.PF && (
                        <div className="flex justify-between text-text-tertiary">
                          <span>PF:</span>
                          <span className="font-mono text-text-primary">{s.PF}</span>
                        </div>
                      )}
                      {s.DIST !== undefined && (
                        <div className="flex justify-between text-text-tertiary">
                          <span>Dist:</span>
                          <span className="font-mono text-text-primary">{s.DIST} km</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  function ExceptionsResult({ data }: { data: any }) {
    if (!data || !data.TrainNumber) return <EmptyResult />;
    const { TrainName, TrainNumber, Source, Destination, DaysOfRun, ExceptionArr } = data;
    return (
      <div className="rounded-lg border border-border-primary bg-bg-elevated overflow-hidden">
        <div className="border-b border-border-primary px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-xs text-text-tertiary">#{TrainNumber}</div>
              <div className="mt-0.5 text-base font-semibold tracking-tight text-text-primary">{TrainName}</div>
            </div>
            <div className="text-right text-xs text-text-tertiary">
              <div>{Source} → {Destination}</div>
              {DaysOfRun && <div className="mt-0.5 font-mono">{DaysOfRun}</div>}
            </div>
          </div>
        </div>
        {ExceptionArr && ExceptionArr.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary bg-bg-secondary text-xs font-medium text-text-tertiary">
                  <th className="px-4 py-2.5 text-left">Date</th>
                  <th className="px-4 py-2.5 text-left">Flag</th>
                  <th className="px-4 py-2.5 text-left">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {ExceptionArr.map((s: any, i: number) => (
                  <tr key={i} className="hover:bg-bg-secondary/50 transition-colors">
                    <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{s.SchDate}</td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-medium ${
                        s.ExcpFlag === 'C' ? 'bg-status-cancelled/10 text-status-cancelled' :
                        s.ExcpFlag === 'D' ? 'bg-status-delayed/10 text-status-delayed' :
                        s.ExcpFlag === 'R' ? 'bg-status-ontime/10 text-status-ontime' :
                        'bg-bg-tertiary text-text-tertiary'
                      }`}>{s.EC || s.ExcpFlag}</span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">{s.ExcpMsg || s.RS || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  function PnrResult({ data }: { data: any }) {
    if (!data) return <EmptyResult />;
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium">PNR</div>
              <div className="mt-0.5 font-mono text-lg font-semibold tracking-tight text-text-primary">{data.pnr || data.PnrNumber || '—'}</div>
            </div>
            <span className={`rounded-md px-2.5 py-0.5 text-xs font-medium font-mono ${
              data.response_code === '1' ? 'bg-status-ontime/10 text-status-ontime' : 'bg-status-delayed/10 text-status-delayed'
            }`}>{data.response_code === '1' ? 'Confirmed' : data.response_code === '2' ? 'Cancelled' : 'Unknown'}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Train', data.train_number || data.TrainNumber],
            ['Name', data.train_name || data.TrainName],
            ['From', data.from_station || data.FromStation],
            ['To', data.to_station || data.ToStation],
            ['Class', data.class || data.Class],
            ['Date', data.date_of_journey || data.DateOfJourney],
            ['DoB', data.date_of_boarding || data.DateOfBoarding],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} className="rounded-lg border border-border-primary bg-bg-elevated px-4 py-2.5">
              <div className="text-[10px] uppercase tracking-wider text-text-tertiary font-medium">{label as string}</div>
              <div className="mt-0.5 text-sm font-medium text-text-primary font-mono">{value as string}</div>
            </div>
          ))}
        </div>
        {data.passengers && data.passengers.length > 0 && (
          <div className="rounded-lg border border-border-primary bg-bg-elevated overflow-hidden">
            <div className="border-b border-border-primary px-5 py-2.5 text-xs font-medium text-text-tertiary uppercase tracking-wider">
              Passengers
            </div>
            <div className="divide-y divide-border-primary">
              {data.passengers.map((p: any, i: number) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5">
                  <span className="text-sm text-text-primary font-mono">{p.name || p.Name || `Passenger ${p.number || i + 1}`}</span>
                  <span className={`rounded-md px-2 py-0.5 text-xs font-mono font-medium ${
                    (p.status || p.Status || '').includes('CNF') ? 'bg-status-ontime/10 text-status-ontime' :
                    (p.status || p.Status || '').includes('RAC') ? 'bg-status-info/10 text-status-info' :
                    (p.status || p.Status || '').includes('WL') ? 'bg-status-delayed/10 text-status-delayed' :
                    'bg-bg-tertiary text-text-tertiary'
                  }`}>{p.status || p.Status || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function EmptyResult() {
    return (
      <div className="rounded-lg border border-border-primary bg-bg-elevated px-5 py-10 text-center">
        <p className="text-sm text-text-tertiary">No results found.</p>
      </div>
    );
  }

  function renderResult() {
    if (!result) return null;
    switch (view) {
      case 'search': return <SearchResult data={result} />;
      case 'trainInfo': return <TrainInfoResult data={result} />;
      case 'schedule': return <ScheduleResult data={result} />;
      case 'stationLive': return <StationLiveResult data={result} />;
      case 'trainsBetween': return <TrainsBetweenResult data={result} />;
      case 'liveStatus': return <LiveStatusResult data={result} onRefresh={refreshLiveStatus} />;
      case 'exceptions': return <ExceptionsResult data={result} />;
      case 'pnr': return <PnrResult data={result} />;
      default: return <EmptyResult />;
    }
  }

  const viewLabels: Record<View, string> = {
    search: 'Search train',
    trainInfo: 'Train info',
    schedule: 'Schedule',
    stationLive: 'Station live',
    trainsBetween: 'Trains between',
    liveStatus: 'Live status',
    exceptions: 'Exceptions',
    pnr: 'PNR status',
  };

  return (
    <div className="flex min-h-dvh flex-col text-text-primary" style={{ background: 'linear-gradient(180deg, var(--color-gradient-start) 0%, var(--color-gradient-mid) 40%, var(--color-gradient-end) 100%)' }}>
      <Header view={view} onBack={goHome} />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {!view ? (
          <>
            {/* Hero */}
            <section className="mb-8 animate-fade-in-up">
              <h1 className="text-3xl font-bold tracking-tight text-text-primary">
                M2HRail
              </h1>
              <p className="mt-1.5 text-sm text-text-secondary">
                Real-time Indian Railways train enquiry
              </p>
            </section>

            {/* Live Train Card */}
            <section className="mb-10 animate-fade-in-up animate-fade-in-up-1">
              <div className="rounded-2xl border border-border-primary bg-bg-elevated p-5 sm:p-6" style={{ boxShadow: 'var(--shadow-live-card)' }}>
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
                    <Activity size={16} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-text-primary">Track Your Train</h2>
                    <p className="text-xs text-text-tertiary">Enter train number to see live running status</p>
                  </div>
                </div>
                <form onSubmit={trackLiveTrain} className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 min-w-0">
                    <input
                      type="text"
                      value={form.inlineTrainNo || ''}
                      onChange={e => updateForm('inlineTrainNo', e.target.value)}
                      placeholder="Train number, e.g. 12301"
                      className="w-full rounded-lg border border-border-primary bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary placeholder-text-quaternary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
                      required
                    />
                  </div>
                  <div className="sm:w-44">
                    <input
                      type="date"
                      value={form.inlineStartDate || new Date().toISOString().split('T')[0]}
                      onChange={e => updateForm('inlineStartDate', e.target.value)}
                      className="w-full rounded-lg border border-border-primary bg-bg-primary px-3.5 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={inlineLiveLoading}
                    className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap"
                  >
                    {inlineLiveLoading ? 'Loading...' : 'Track Now'}
                  </button>
                </form>

                {/* Inline live result */}
                {inlineLiveError && (
                  <div className="mt-4 rounded-lg border border-status-delayed/20 bg-status-delayed/5 px-4 py-3 text-sm text-status-delayed">
                    {inlineLiveError}
                  </div>
                )}
                {inlineLiveLoading && !inlineLiveResult && (
                  <div className="mt-6 flex items-center justify-center py-6">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-secondary border-t-accent" />
                  </div>
                )}
                {inlineLiveResult && !inlineLiveLoading && (
                  <div className="mt-5 border-t border-border-primary pt-5">
                    <LiveStatusResult data={inlineLiveResult} onRefresh={refreshInlineLive} />
                  </div>
                )}
              </div>
            </section>

            {/* Tool Cards */}
            <section className="animate-fade-in-up animate-fade-in-up-2">
              <h2 className="mb-4 text-sm font-semibold text-text-tertiary uppercase tracking-wider">Enquiry Tools</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {tools.map((t, i) => (
                  <div key={t.id} className={`animate-fade-in-up animate-fade-in-up-${Math.min(i + 3, 8)}`}>
                    <ToolCard
                      title={t.title}
                      description={t.description}
                      icon={t.icon}
                      onClick={() => openView(t.id)}
                    />
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <div className="mx-auto max-w-2xl">
            <h2 className="mb-6 text-lg font-semibold tracking-tight text-text-primary">{viewLabels[view]}</h2>

            {renderForm()}

            {error && (
              <div className="mt-4 rounded-lg border border-status-delayed/20 bg-status-delayed/5 px-4 py-3 text-sm text-status-delayed">
                {error}
              </div>
            )}

            {loading && (
              <div className="mt-8 flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-border-secondary border-t-accent" />
              </div>
            )}

            {result && !loading && (
              <div className="mt-6 space-y-1">
                <div className="text-xs text-text-tertiary uppercase tracking-wider font-medium px-0.5">Results</div>
                <div className="mt-2">{renderResult()}</div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-border-primary py-5 text-center text-xs text-text-quaternary">
        M2HRail &mdash; unofficial Indian Railways live enquiry interface
      </footer>
    </div>
  );
}
