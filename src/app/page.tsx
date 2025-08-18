"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { ELGPOSTER } from "./elgposter";
import { ELGJEGERE } from "./elgjegere";
import Head from "next/head";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import type { Fall } from "./types";
import { FALL } from "./fall";
import type { FallObs } from "./types";
import { supabase } from '../utils/supabaseClient';
import FallObsTab from './FallObsTab';
import WeatherTab from './WeatherTab';
import PostvaerTab from './PostvaerTab';
import PostTrekkTab from './TrekkDinPostTab';
import DagensPosterTab from './DagensPosterTab';
import KartTab from './KartTab';
import ElgposterTab from './ElgposterTab';
import JaktAI from './JaktAI';
import { WindArrow, weatherIcon, windDirectionText } from './utils/weatherUtils';

// Fjern alle exporterte konstanter og typer fra denne filen. Flytt til src/app/constants.ts og importer dem her.
import { DEFAULT_POSITION, HourlyForecast, ForecastDay, Post, TrekkData, Jeger, WeatherData } from './constants';
import MorningTab from './MorningTab';

// Enkel Tab-komponent
function Tabs({ tabs, current, onChange }: { tabs: string[]; current: string; onChange: (tab: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            padding: '8px 16px',
            fontSize: 16,
            borderRadius: 8,
            cursor: 'pointer',
            background: current === tab ? '#e0eaff' : '#f4f4f4',
            border: current === tab ? '2px solid #4a90e2' : '1px solid #ccc',
            fontWeight: current === tab ? 600 : 400,
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// Flytt type Logger til før DgLogger:
type Logger = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  startTime: number | null;
  target: number;
  offset: number;
  accelerated: boolean;
  running: boolean;
  simulatedElapsed: number; // minutter
};

function DgLogger({ logger, onChange, onDelete }: { logger: Logger; onChange: (l: Logger) => void; onDelete?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ t: number; sum: number; temp: number }[]>([]);
  const [estimate, setEstimate] = useState<{ t: number; sum: number }[]>([]);
  const [dgSum, setDgSum] = useState(0);
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const [estimatedDone, setEstimatedDone] = useState<Date | null>(null);
  // --- Akselerert tid: oppdater simulatedElapsed ---
  useEffect(() => {
    if (!logger.running || !logger.accelerated) return;
    const timer = setInterval(() => {
      onChange({ ...logger, simulatedElapsed: logger.simulatedElapsed + 60 });
    }, 1000);
    return () => clearInterval(timer);
  }, [logger.running, logger.accelerated, logger.simulatedElapsed]);
  useEffect(() => {
    if (!logger.running || !logger.startTime) return;
    let cancelled = false;
    setLoading(true);
    async function fetchTemps() {
      try {
        const interval = 60; // 1 time
      const start = new Date(logger.startTime!);
        const now = logger.accelerated
          ? new Date(logger.startTime! + logger.simulatedElapsed * 60 * 1000)
          : new Date();
        // --- Lag liste med datoer ---
      const dates: string[] = [];
      const d = new Date(start);
        let dateGuard = 0;
        while (d <= now && dateGuard++ < 40) { // maks 40 dager
        dates.push(d.toISOString().slice(0, 10));
        d.setDate(d.getDate() + 1);
      }
        // legg til 2 dager til fremover for forecast
        const d2 = new Date(now);
        d2.setDate(d2.getDate() + 2);
        while (dates[dates.length - 1] < d2.toISOString().slice(0, 10) && dateGuard++ < 42) {
          const nextDay = new Date(dates[dates.length - 1] + "T00:00:00Z");
          if (isNaN(nextDay.getTime())) break; // unngå uendelig loop
          dates.push(nextDay.toISOString().slice(0, 10));
        }
        // --- Hent alle temperaturer parallelt ---
        const fetches = dates.map(date => {
          const today = new Date().toISOString().slice(0, 10);
          const isPast = new Date(date) < new Date(today);
          const url = isPast
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${logger.lat}&longitude=${logger.lng}&start_date=${date}&end_date=${date}&hourly=temperature_2m`
            : `https://api.open-meteo.com/v1/forecast?latitude=${logger.lat}&longitude=${logger.lng}&hourly=temperature_2m&timezone=auto&start_date=${date}&end_date=${date}`;
          return fetch(url).then(r => r.json()).catch(() => null);
        });
        const results = await Promise.all(fetches);
        // --- Pakk ut temperaturene ---
        const temps: { time: string; temp: number }[] = [];
        results.forEach(data => {
          if (data?.hourly?.time && data?.hourly?.temperature_2m) {
          for (let i = 0; i < data.hourly.time.length; ++i) {
            temps.push({ time: data.hourly.time[i], temp: data.hourly.temperature_2m[i] });
          }
        }
        });
        if (cancelled) return;
        // --- Bygg intervaller (hver time) ---
      const intervals: { t: number; temp: number }[] = [];
      let tMin = 0;
      let t = new Date(start);
      while (t <= now) {
          const dateStr = t.toISOString().slice(0, 13); // YYYY-MM-DDTHH
        const found = temps.find(x => x.time.startsWith(dateStr));
          const temp = found
            ? Math.max(found.temp + logger.offset, 0)
            : Math.max(10 + logger.offset, 0);
        intervals.push({ t: tMin, temp });
        tMin += interval;
        t = new Date(t.getTime() + interval * 60 * 1000);
      }
        // --- Akkumuler sum løpende ---
      let sum = 0;
        const hist = intervals.map((iv) => {
          sum += iv.temp / 24;
          return { t: iv.t, temp: iv.temp, sum, startTime: start.getTime() };
        });
        // --- Forecast videre (estimate) ---
        let simSum = sum;
        let simT = intervals.length > 0 ? intervals[intervals.length - 1].t : 0;
        let simTime = intervals.length > 0
          ? new Date(start.getTime() + simT * 60 * 1000)
          : new Date(start);
        const simTemp = intervals.length > 0
          ? intervals[intervals.length - 1].temp
          : Math.max(10 + logger.offset, 0);
        const estimate: { t: number; sum: number; startTime: number }[] = [];
        let guard = 0;
        while (simSum < logger.target && simT < 24 * 365 && guard++ < 24 * 365) {
          simSum += simTemp / 24;
          simT += 60;
          simTime = new Date(simTime.getTime() + 60 * 60 * 1000);
          estimate.push({ t: simT, sum: simSum, startTime: start.getTime() });
        }
        if (estimate.length > 0) {
        setEstimatedDone(simTime);
      }
        setHistory(hist);
        setEstimate(estimate);
        setDgSum(sum);
        setCurrentTemp(intervals.length > 0 ? intervals.at(-1)!.temp : null);
      setLoading(false);
      } catch (err) {
        console.error("fetchTemps error", err);
        if (!cancelled) setLoading(false);
      }
    }
    fetchTemps();
    return () => {
      cancelled = true;
    };
  }, [logger.running, logger.startTime, logger.simulatedElapsed, logger.lat, logger.lng, logger.offset, logger.target]);
  function handleReset() {
    onChange({ ...logger, running: false, startTime: null, simulatedElapsed: 0 });
    setHistory([]); setDgSum(0); setCurrentTemp(null);
  }
  function DGChart({ history, estimate, startTime, target }: { history: { t: number; sum: number; startTime?: number }[]; estimate: { t: number; sum: number; startTime?: number }[]; startTime: number; target: number }) {
    // Slå sammen for x-akse
    const data = [
      ...history.map(h => ({ t: h.t, real: h.sum, est: null, startTime: h.startTime ?? startTime })),
      ...estimate.slice(history.length).map(e => ({ t: e.t, real: null, est: e.sum, startTime: e.startTime ?? startTime })),
    ];
    return (
      <LineChart width={400} height={180} data={data} margin={{ left: 16, right: 16, top: 16, bottom: 16 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey="t"
          tickCount={6}
          interval="preserveStartEnd"
          tickFormatter={(t) => {
            const start = new Date(data[0]?.startTime ?? startTime);
            const d = new Date(start.getTime() + t * 60 * 1000);
            return d.toLocaleString("no-NO", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
            });
          }}
          label={{ value: "Tid", position: "insideBottomRight", offset: -8 }}
        />
        <YAxis label={{ value: "Døgngrader", angle: -90, position: "insideLeft" }} />
        <Tooltip />
        <Legend />
        {/* Reell linje */}
        <Line
          type="monotone"
          dataKey="real"
          stroke="#0077cc"
          strokeWidth={2}
          dot={false}
          name="Reell akkumulert DG"
          isAnimationActive={false}
        />
        {/* Estimat-linje (stiplet) */}
        <Line
          type="monotone"
          dataKey="est"
          stroke="#ff6600"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="Estimert akkumulert DG"
          isAnimationActive={false}
        />
        {/* Target-linje */}
        {target && (
          <Line
            type="stepAfter"
            dataKey={() => target}
            stroke="#e55"
            strokeWidth={1}
            strokeDasharray="2 2"
            dot={false}
            name="Target"
          />
        )}
      </LineChart>
    );
  }
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 18, marginBottom: 24, background: '#fafcff', position: 'relative' }}>
      {onDelete && (
        <button onClick={() => onDelete()} style={{ position: 'absolute', top: 10, right: 10, background: '#ffe0e0', border: '1px solid #d8b2b2', borderRadius: 8, padding: '4px 12px', fontSize: 15, cursor: 'pointer' }}>Slett</button>
      )}
      <h3 style={{ margin: 0, marginBottom: 8 }}>{logger.name}</h3>
      <div style={{ marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 15 }}>
          <input type="checkbox" checked={logger.accelerated} onChange={e => onChange({ ...logger, accelerated: e.target.checked })} style={{ marginRight: 6 }} />
          Akselerert tid (simulering)
        </label>
        <label style={{ fontSize: 15 }}>
          Target døgngrader:
          <input type="number" value={logger.target} min={1} max={100} onChange={e => onChange({ ...logger, target: Number(e.target.value) })} style={{ marginLeft: 6, width: 60, padding: 3, borderRadius: 6, border: '1px solid #ccc' }} />
        </label>
        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Temp-offset:
          <input
            type="number"
            value={logger.offset}
            min={-10}
            max={10}
            step={1}
            onChange={e => onChange({ ...logger, offset: Number(e.target.value) })}
            style={{ marginLeft: 6, width: 60, padding: 3, borderRadius: 6, border: '1px solid #ccc', textAlign: 'center' }}
          />
          <button
            type="button"
            onClick={() => onChange({ ...logger, offset: Math.max(-10, logger.offset - 1) })}
            style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 6, border: '1px solid #bbb', background: '#f4f4f4', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            aria-label="Mindre offset"
          >
            &#8595;
          </button>
          <button
            type="button"
            onClick={() => onChange({ ...logger, offset: Math.min(10, logger.offset + 1) })}
            style={{ marginLeft: 6, padding: '2px 8px', borderRadius: 6, border: '1px solid #bbb', background: '#f4f4f4', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            aria-label="Større offset"
          >
            &#8593;
          </button>
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => onChange({ ...logger, running: !logger.running, startTime: !logger.running ? Date.now() : logger.startTime })} style={{ padding: '8px 18px', borderRadius: 8, background: logger.running ? '#ffe0e0' : '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginRight: 12 }}>{logger.running ? 'Pause' : 'Start'}</button>
        <button onClick={handleReset} style={{ padding: '8px 18px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 16, cursor: 'pointer' }}>Nullstill</button>
      </div>
      {loading ? <div>Laster temperaturdata...</div> : <>
        <div style={{ marginBottom: 12, display: 'flex', gap: 24, alignItems: 'center' }}>
          <span>Akkumulert døgngrad: <b>{dgSum.toFixed(2)}</b></span>
          {estimatedDone && (
            <span style={{ color: '#2a7' }}>
              Estimert ferdig: {estimatedDone.toLocaleDateString('no-NO', { weekday: 'long', day: '2-digit', month: '2-digit', year: '2-digit' })}, {estimatedDone.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', hour12: false })}
            </span>
          )}
        </div>
        {history.length > 0 && (
          <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
            Timer: {(() => {
              const last = history[history.length - 1];
              const totalMin = last.t;
              const days = Math.floor(totalMin / 1440);
              const hours = Math.floor((totalMin % 1440) / 60);
              const mins = totalMin % 60;
              return `${days}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            })()}
          </div>
        )}
        <DGChart history={history} estimate={estimate} startTime={logger.startTime ?? 0} target={logger.target} />
        <div style={{ fontSize: 13, color: '#888' }}>Temperatur: {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : 'ukjent'} (offset: {logger.offset >= 0 ? '+' : ''}{logger.offset})</div>
      </>}
    </div>
  );
}

function TrekkDinPost({ posts, trekkData, setTrekkData }: { posts: Post[]; trekkData: TrekkData[]; setTrekkData: (d: TrekkData[]) => void }) {
  const [selected, setSelected] = useState(() => ELGPOSTER.map(() => false));
  const [remaining, setRemaining] = useState(() => ELGPOSTER.map((_, i) => i));
  const [spinning, setSpinning] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinName, setSpinName] = useState('');
  const [expanderOpen, setExpanderOpen] = useState(false);
  const [drawn, setDrawn] = useState<{ postIdx: number; jeger: string }[]>([]);
  const [selectedJeger, setSelectedJeger] = useState('');
  const [sortBy, setSortBy] = useState('alfabetisk');
  const [showAuto, setShowAuto] = useState(false);
  const [autoJegere, setAutoJegere] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // Sorter ELGPOSTER alfabetisk for visning
  const sortedIdx = ELGPOSTER
    .map((p, i) => ({ name: p.name, idx: i }))
    .sort((a, b) => sortBy === 'alfabetisk' ? a.name.localeCompare(b.name) : a.idx - b.idx)
    .map(x => x.idx);

  function handleToggle(idx: number) {
    setSelected(sel => sel.map((v, i) => i === idx ? !v : v));
  }

  function handleSpin() {
    if (!selectedJeger) return;
    // Ikke la samme jeger trekke flere ganger
    if (drawn.some(d => d.jeger === selectedJeger)) return;
    const available = remaining.filter(i => selected[i]);
    if (available.length === 0) return;
    setSpinning(true);
    setShowResult(false);
    let ticks = 0;
    const spinInterval = setInterval(() => {
      const r = available[Math.floor(Math.random() * available.length)];
      setSpinName(ELGPOSTER[r].name);
      ticks++;
      if (ticks > 15) { // ca 1.5 sek
        clearInterval(spinInterval);
        const winner = available[Math.floor(Math.random() * available.length)];
        setWinnerIdx(winner);
        setSpinning(false);
        setShowResult(true);
        setRemaining(rem => rem.filter(i => i !== winner));
        setDrawn(d => [...d, { postIdx: winner, jeger: selectedJeger }]);
      }
    }, 100);
  }

  function handleReset() {
    setSelected(ELGPOSTER.map(() => false));
    setRemaining(ELGPOSTER.map((_, i) => i));
    setWinnerIdx(null);
    setShowResult(false);
    setSpinName('');
    setDrawn([]);
    setSelectedJeger('');
  }

  async function sendToDagensPoster() {
    setSending(true);
    setSendMsg(null);
    // Lagre drawn-listen til API
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drawn),
    });
    setSending(false);
    setSendMsg("Listen er lagret til Dagens poster!");
  }

  const available = remaining.filter(i => selected[i]);
  const numSelected = selected.filter(Boolean).length;
  const jegereUtenPost = ELGJEGERE.filter(j => !drawn.some(d => d.jeger === j.navn));
  const numIgjen = selected.filter(Boolean).length - drawn.length;

  // Rett før {showAuto && ( ... )} :
  const antallValgtePoster = selected.filter(Boolean).length;
  const antallValgteJegere = autoJegere.length;

  // Håndterer "OK" for Auto-assign
  const handleAutoAssign = () => {
    const valgtePoster = ELGPOSTER.map((_, idx) => selected[idx] && remaining.includes(idx) ? idx : null).filter(idx => idx !== null) as number[];
    if (autoJegere.length !== valgtePoster.length) {
      alert(`Velg nøyaktig ${valgtePoster.length} jegere før du bekrefter!`);
      return;
    }
    const newDrawn = valgtePoster.map((idx, i) => ({
      postIdx: idx,
      jeger: autoJegere[i]
    }));
    setDrawn(prev => [...prev, ...newDrawn]);
    setRemaining(rem => rem.filter(idx => !valgtePoster.includes(idx)));
    setShowAuto(false);
    setAutoJegere([]);
  };

  return (
    <section style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
      {/* Venstre kolonne: hovedinnhold */}
      <div style={{ flex: 1, minWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
          <button onClick={() => setExpanderOpen(v => !v)} style={{ padding: '6px 14px', borderRadius: 8, background: '#f4f8ff', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer', minWidth: 120 }}>
            Velg poster ({numSelected} valgt{numSelected === 1 ? '' : 'e'}) {expanderOpen ? '▲' : '▼'}
          </button>
          <button onClick={handleReset} style={{ padding: '6px 14px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 15, cursor: 'pointer' }}>Reset</button>
          <button onClick={() => setShowAuto(v => !v)} style={{ padding: '6px 14px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Auto</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          
          <select value={selectedJeger} onChange={e => setSelectedJeger(e.target.value)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #bbb', fontSize: 16, minWidth: 160 }}>
            <option value="">Velg navn</option>
            {jegereUtenPost.map(j => (
              <option key={j.navn} value={j.navn}>{j.navn} ({j.callsign})</option>
            ))}
          </select>
          <button onClick={handleSpin} disabled={spinning || available.length === 0 || !selectedJeger || drawn.some(d => d.jeger === selectedJeger)} style={{ padding: '10px 28px', borderRadius: 10, background: '#e0eaff', border: '1px solid #4a90e2', fontSize: 18, fontWeight: 600, cursor: spinning || available.length === 0 || !selectedJeger || drawn.some(d => d.jeger === selectedJeger) ? 'not-allowed' : 'pointer', minWidth: 120 }}>
            {spinning ? 'Trekker...' : 'Trekk post!'}
          </button>
        </div>
        {spinning && (
          <div style={{ fontSize: 22, fontWeight: 600, color: '#4a90e2', minHeight: 40, marginBottom: 10 }}>{spinName}</div>
        )}
        {showResult && winnerIdx !== null && (
          <div style={{ fontSize: 22, fontWeight: 700, color: '#2a7', marginBottom: 10 }}>Du har fått: {ELGPOSTER[winnerIdx].name}!</div>
        )}
        {numIgjen === 0 ? (
          <div style={{ color: '#888', marginBottom: 8 }}>Ingen poster igjen å trekke.</div>
        ) : (
          <div style={{ color: '#888', marginBottom: 8 }}>{numIgjen} poster igjen å trekke!</div>
        )}
        {expanderOpen && (
          <>
            <ul style={{ listStyle: 'none', padding: 0, columns: 2, maxWidth: 500, marginTop: 8, marginBottom: 8, background: '#f8faff', border: '1px solid #dde', borderRadius: 8, boxShadow: '0 2px 8px #0001', paddingLeft: 12, paddingRight: 12 }}>
              {sortedIdx.map(idx => (
                <li key={ELGPOSTER[idx].name} style={{ marginBottom: 4, display: 'flex', alignItems: 'center' }}>
                  <label style={{ cursor: 'pointer', fontSize: 16, flex: 1 }}>
                    <input type="checkbox" checked={selected[idx] && remaining.includes(idx)} disabled={!remaining.includes(idx)} onChange={() => handleToggle(idx)} style={{ marginRight: 7 }} />
                    {ELGPOSTER[idx].name}
                  </label>
                  {!remaining.includes(idx) && (
                    <span style={{ color: '#c33', fontSize: 14, fontWeight: 600, marginLeft: 8 }}>Trukket!</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
            {showAuto && (
          <div style={{ marginTop: 24, background: '#f8faff', border: '2px solid #4a90e2', borderRadius: 14, padding: 24, maxWidth: 500, boxShadow: '0 4px 24px #0002', zIndex: 10 }}>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 18 }}>Automatisk tildeling av poster</div>
            <div style={{ marginBottom: 8 }}>
              Velg {ELGPOSTER.map((_, idx) => selected[idx] && remaining.includes(idx) ? idx : null).filter(idx => idx !== null).length} jegere:
            </div>
            {jegereUtenPost.map(j => (
              <label key={j.navn} style={{ display: 'block', marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={autoJegere.includes(j.navn)}
                  onChange={e => {
                    if (e.target.checked) {
                      setAutoJegere(prev => [...prev, j.navn]);
                    } else {
                      setAutoJegere(prev => prev.filter(n => n !== j.navn));
                    }
                  }}
                  disabled={
                    !autoJegere.includes(j.navn) &&
                    autoJegere.length >= ELGPOSTER.map((_, idx) => selected[idx] && remaining.includes(idx) ? idx : null).filter(idx => idx !== null).length
                  }
                  style={{ marginRight: 6 }}
                />
                        {j.navn} ({j.callsign})
                      </label>
            ))}
                <button
              onClick={handleAutoAssign}
              style={{ marginTop: 12, padding: '10px 24px', borderRadius: 8, background: '#4a90e2', color: '#fff', fontWeight: 600, fontSize: 17, cursor: 'pointer' }}
            >
              OK
                </button>
            <button
              onClick={() => { setShowAuto(false); setAutoJegere([]); }}
              style={{ marginTop: 12, marginLeft: 16, padding: '10px 24px', borderRadius: 8, background: '#eee', color: '#333', fontWeight: 600, fontSize: 17, cursor: 'pointer', border: '1px solid #bbb' }}
            >
              Avbryt
            </button>
              </div>
        )}
        <div style={{ marginTop: 24 }}>
          <button onClick={sendToDagensPoster} disabled={drawn.length === 0 || sending} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: drawn.length === 0 || sending ? 'not-allowed' : 'pointer' }}>
            {sending ? 'Sender...' : 'Send liste til Dagens poster'}
          </button>
          {sendMsg && <span style={{ marginLeft: 12, color: '#2a7', fontWeight: 500 }}>{sendMsg}</span>}
        </div>
      </div>
      {/* Høyre kolonne: Trukne poster */}
      <div style={{ minWidth: 220, maxWidth: 340, background: '#f8faff', border: '1px solid #dde', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px #0001', marginLeft: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Trukne poster</div>
        {drawn.length === 0 ? (
          <div style={{ color: '#aaa' }}>Ingen poster trukket ennå.</div>
        ) : (
          <ol style={{ paddingLeft: 18, margin: 0 }}>
            {drawn.map((d, i) => {
              const post = posts[d.postIdx];
              const jeger = ELGJEGERE.find(j => j.navn === d.jeger);
              return (
                <li key={i} style={{ marginBottom: 8, fontSize: 20, fontWeight: 700 }}>
                  <span style={{ fontSize: 22 }}>{post.name}</span>{' '}
                  <span style={{ color: '#4a90e2', fontSize: 18, fontWeight: 600, marginLeft: 8 }}>{jeger ? jeger.callsign : d.jeger}</span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function FallTab({ jegere, onShowInMap }: { jegere: { navn: string; callsign: string }[]; onShowInMap?: (fall: Fall[]) => void }) {
  const [fall, setFall] = useState<Fall[]>([]);
  const [dato, setDato] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [type, setType] = useState('');
  const [vekt, setVekt] = useState('');
  const [skytter, setSkytter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editFall, setEditFall] = useState<{ dato: string; lat: string; lng: string; type: string; vekt: string; skytter: string } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/fall')
      .then(r => r.json())
      .then(data => { setFall(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!dato || !lat || !lng || !type || !vekt || !skytter) {
      setError('Fyll ut alle felter');
      return;
    }
    const nyttFall: Fall = { dato, lat: Number(lat), lng: Number(lng), type, vekt: Number(vekt), skytter };
    const nyListe = [nyttFall, ...fall];
    setFall(nyListe);
    await fetch('/api/fall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(nyListe) });
    setDato(''); setLat(''); setLng(''); setType(''); setVekt(''); setSkytter('');
  }

  async function handleSaveEdit(idx: number) {
    if (!editFall || !editFall.dato || !editFall.lat || !editFall.lng || !editFall.type || !editFall.vekt || !editFall.skytter) {
      setError('Fyll ut alle felter');
      return;
    }
    const ny = [...fall];
    ny[idx] = {
      dato: editFall.dato,
      lat: Number(editFall.lat),
      lng: Number(editFall.lng),
      type: editFall.type,
      vekt: Number(editFall.vekt),
      skytter: editFall.skytter
    };
    setFall(ny);
    setEditIdx(null);
    setEditFall(null);
    await fetch('/api/fall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ny) });
  }

  async function handleDelete(idx: number) {
    const ny = fall.filter((_, i) => i !== idx);
    setFall(ny);
    setEditIdx(null);
    setEditFall(null);
    await fetch('/api/fall', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ny) });
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Logg elgfall</h2>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBottom: 18 }}>
        <input type="date" value={dato} onChange={e => setDato(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required />
        <input type="number" step="any" placeholder="Lat" value={lat} onChange={e => setLat(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6, width: 120 }} required />
        <input type="number" step="any" placeholder="Lng" value={lng} onChange={e => setLng(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6, width: 120 }} required />
        <input type="text" placeholder="Type (f.eks. Okse)" value={type} onChange={e => setType(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6, width: 120 }} required />
        <input type="number" placeholder="Vekt (kg)" value={vekt} onChange={e => setVekt(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6, width: 100 }} required />
        <select value={skytter} onChange={e => setSkytter(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6, width: 120 }} required>
          <option value="">Skytter</option>
          {jegere.map(j => <option key={j.navn} value={j.navn}>{j.navn} ({j.callsign})</option>)}
        </select>
        <button type="submit" style={{ padding: '7px 16px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Lagre</button>
        </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Laster...</div> : (
        <div style={{ background: '#f8f8ff', border: '1px solid #b2d8f6', borderRadius: 12, padding: 18, marginTop: 12, boxShadow: '0 2px 8px #0001', maxWidth: 700, marginLeft: 'auto', marginRight: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
        <thead>
              <tr style={{ background: '#e0eaff' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Dato</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Lat</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Lng</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Type</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Vekt (kg)</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Skytter</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}></th>
          </tr>
        </thead>
        <tbody>
              {fall.map((f, i) => (
                editIdx === i && editFall ? (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafdff' : '#f0f6fa' }}>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="date" value={editFall.dato} onChange={e => setEditFall(ef => ef ? { ...ef, dato: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 120 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" step="any" value={editFall.lat} onChange={e => setEditFall(ef => ef ? { ...ef, lat: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" step="any" value={editFall.lng} onChange={e => setEditFall(ef => ef ? { ...ef, lng: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="text" value={editFall.type} onChange={e => setEditFall(ef => ef ? { ...ef, type: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" value={editFall.vekt} onChange={e => setEditFall(ef => ef ? { ...ef, vekt: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 70 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <select value={editFall.skytter} onChange={e => setEditFall(ef => ef ? { ...ef, skytter: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 110 }}>
                        <option value="">Skytter</option>
                        {jegere.map(j => <option key={j.navn} value={j.navn}>{j.navn} ({j.callsign})</option>)}
                      </select>
                  </td>
                    <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => handleSaveEdit(i)} style={{ padding: '3px 10px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 14, cursor: 'pointer', marginRight: 4 }}>Lagre</button>
                      <button onClick={() => { setEditIdx(null); setEditFall(null); }} style={{ padding: '3px 10px', borderRadius: 7, background: '#eee', border: '1px solid #bbb', fontSize: 14, cursor: 'pointer', marginRight: 4 }}>Lukk</button>
                      <button onClick={() => handleDelete(i)} style={{ padding: '3px 10px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 14, cursor: 'pointer' }}>Slett</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafdff' : '#f0f6fa' }}>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.dato}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.lat.toFixed(3)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.lng.toFixed(3)}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.type.charAt(0).toUpperCase() + f.type.slice(1).toLowerCase()}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.vekt}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.skytter}</td>
                    <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setEditIdx(i); setEditFall({
                        dato: f.dato,
                        lat: f.lat.toString(),
                        lng: f.lng.toString(),
                        type: f.type,
                        vekt: f.vekt.toString(),
                        skytter: f.skytter
                      }); }} style={{ padding: '3px 10px', borderRadius: 7, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 14, cursor: 'pointer', marginRight: 4 }}>Endre</button>
                  </td>
            </tr>
                )
          ))}
        </tbody>
      </table>
        </div>
      )}
    </section>
  );
}

function ElgAITab() {
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>ElgAI – Smart postvalg</h2>
      <div style={{ background: '#f8f8ff', border: '1px solid #d2d2e2', borderRadius: 10, padding: 24, maxWidth: 600, margin: '0 auto', minHeight: 180 }}>
        <div style={{ color: '#888', fontSize: 16, marginBottom: 12 }}>
          Her kommer en AI-chat som hjelper deg å velge smarte poster basert på vær, jegere og om vi har tilgang til hund eller kun må postere.
      </div>
        <div style={{ color: '#aaa', fontSize: 15 }}>
          (Placeholder: AI-funksjonalitet og chat kommer snart!)
          </div>
      </div>
    </section>
  );
}

export default function Home() {
  const [showMap, setShowMap] = useState(false);
  const [addPostMode, setAddPostMode] = useState(false);
  const [posts, setPosts] = useState<Post[]>(ELGPOSTER);
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]); // indexer til posts
  const [expanderOpen, setExpanderOpen] = useState(false);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [expand, setExpand] = useState(false);
  const [activeTab, setActiveTab] = useState('Vær');
  // For dynamiske døgngrad-loggere
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  // Døgngrad-logging state
  const [dg1, setDg1] = useState('');
  const [dg2, setDg2] = useState('');
  const [dg3, setDg3] = useState('');
  const [dgLogs, setDgLogs] = useState<{ date: string; dg1: string; dg2: string; dg3: string }[]>([]);
  // Automatisk døgngrad-logging state
  const [running, setRunning] = useState(false);
  const [dgSum, setDgSum] = useState(0);
  const [dgHistory, setDgHistory] = useState<{ t: number; sum: number }[]>([]); // t: simulert minutt
  const [showReset, setShowReset] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Delt trekkData-state for trukne poster
  const [trekkData, setTrekkData] = useState<TrekkData[]>([]);
  const [fallIMarker, setFallIMarker] = useState<Fall[] | undefined>(undefined);
  const [fallData, setFallData] = useState<Fall[]>([]);
  const [showFallInMap, setShowFallInMap] = useState(false);
  const [showObsInMap, setShowObsInMap] = useState(false);
  const [fallObs, setFallObs] = useState<FallObs[]>(() => {
    // Prøv å hente fra localStorage eller annen persistens senere
    // For nå: bruk FALL som default hvis tomt
    return FALL;
  });
  const [loadingFallObs, setLoadingFallObs] = useState(false);

  function handlePostAdded() {
    setShowMap(false);
    setAddPostMode(false);
  }

  function handleAddDgLog(e: React.FormEvent) {
    e.preventDefault();
    const today = new Date().toISOString().slice(0, 10);
    setDgLogs((prev) => [
      { date: today, dg1, dg2, dg3 },
      ...prev,
    ]);
    setDg1('');
    setDg2('');
    setDg3('');
  }

  // Simulert tid: 1 sekund = 15 minutt (96 målinger per døgn, 15 min intervall)
  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(() => {
      setDgHistory((prev) => {
        const t = prev.length > 0 ? prev[prev.length - 1].t + 15 : 0; // neste tid (i min)
        // Finn time fra t (0-60-120...)
        const hourIdx = Math.floor(t / 60) % hourly.length;
        const temp = hourly[hourIdx]?.temp ?? 10; // fallback 10°C
        const dg = temp / 96;
        const sum = (prev.length > 0 ? prev[prev.length - 1].sum : 0) + dg;
        setDgSum(sum);
        return [...prev, { t, sum }];
      });
    }, 1000); // 1 sek = 15 min
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, hourly]);

  // Stop timer når tab byttes eller komponent unmountes
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Nullstillingsfunksjon
  function handleReset() {
    setShowReset(false);
    setRunning(false);
    setDgSum(0);
    setDgHistory([]);
  }

  // Finn ELGHYTTA-posisjon
  const ELGHYTTA = ELGPOSTER.find(p => p.name.toLowerCase().includes("hytte"));
  // Bruk ELGHYTTA-posisjon for vær
  const weatherLat = ELGHYTTA?.lat ?? DEFAULT_POSITION[0];
  const weatherLng = ELGHYTTA?.lng ?? DEFAULT_POSITION[1];

  useEffect(() => {
    async function fetchWeather() {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${weatherLat}&longitude=${weatherLng}&hourly=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation&daily=temperature_2m_min,temperature_2m_max,windspeed_10m_max,winddirection_10m_dominant,weathercode,precipitation_sum&timezone=auto&forecast_days=3`
      );
      const data = await res.json();
      // Finn nåværende time
      const now = new Date();
      const times: string[] = data.hourly.time;
      const idxNow = times.findIndex((t: string) => new Date(t).getTime() >= now.getTime());
      // Ta de neste 6 timene
      const next6 = Array.from({ length: 6 }, (_, i) => idxNow + i).filter(idx => idx < times.length);
      setHourly(
        next6.map(idx => ({
          time: data.hourly.time[idx],
          temp: data.hourly.temperature_2m[idx],
          windSpeed: data.hourly.windspeed_10m[idx],
          windDir: data.hourly.winddirection_10m[idx],
          weatherCode: data.hourly.weathercode[idx],
          precipitation: data.hourly.precipitation[idx],
        }))
      );
      // 3-dagersvarsel
      const days: ForecastDay[] = (data.daily?.time || []).map((date: string, idx: number) => ({
        date,
        tempMin: data.daily.temperature_2m_min[idx],
        tempMax: data.daily.temperature_2m_max[idx],
        windSpeed: data.daily.windspeed_10m_max[idx],
        windDir: data.daily.winddirection_10m_dominant[idx],
        weatherCode: data.daily.weathercode[idx],
        precipitation: data.daily.precipitation_sum[idx],
      }));
      setForecast(days);
    }
    fetchWeather();
  }, [weatherLat, weatherLng]);

  // I Home-komponenten, i Kart-tab:
  // 1. Legg til state:
  const [kartVisning, setKartVisning] = useState<'alle' | 'dagens'>('alle');
  const [dagensPosterData, setDagensPosterData] = useState<{ postIdx: number; jeger: string }[]>([]);
  const [mapLayer, setMapLayer] = useState('satellite');
  // 2. useEffect for å hente dagens poster:
  useEffect(() => {
    if (activeTab === 'Kart' && kartVisning === 'dagens') {
      fetch('/api/dagensposter')
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data)) setDagensPosterData(data);
          else if (data.assignments) setDagensPosterData(data.assignments);
          else setDagensPosterData([]);
        });
    }
  }, [activeTab, kartVisning]);
  // 3. Bruk dagensPosterData til filtrering:
  const dagensPosterIdx = kartVisning === 'dagens' ? (dagensPosterData.map((d) => d.postIdx)) : [];
  const dagensPosterInfo = kartVisning === 'dagens' ? (dagensPosterData.map((d) => {
    const jegerObj = ELGJEGERE.find(j => j.navn === d.jeger);
    return { postIdx: d.postIdx, jeger: d.jeger, callsign: jegerObj?.callsign || '' };
  })) : undefined;
  const elghyttaIdx = ELGPOSTER.findIndex(p => /hytte|elghytta/i.test(p.name));
  // Rett før postsToShow:
  type KartPost = Post & { originalIdx?: number; visBlatt?: boolean };
  let postsToShow: KartPost[] = kartVisning === 'alle'
    ? ELGPOSTER
    : ELGPOSTER
        .map((p, idx) => ({ ...p, originalIdx: idx }))
        .filter((p) => dagensPosterIdx.includes(p.originalIdx));
  if (kartVisning === 'dagens' && elghyttaIdx !== -1 && !postsToShow.some(p => p.originalIdx === elghyttaIdx)) {
    postsToShow = [
      ...postsToShow,
      { ...ELGPOSTER[elghyttaIdx], originalIdx: elghyttaIdx, visBlatt: true },
    ];
  }

  // --- Persistens for mørnings-timer og elgposter/jegere ---
  // I Home-komponenten:
  // 1. Les elgposter fra localStorage ved init:
  const [elgposter, setElgposter] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('elgposter');
      if (saved) return JSON.parse(saved);
    }
    return [...ELGPOSTER];
  });
  // 2. Lagre elgposter til localStorage ved endring:
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('elgposter', JSON.stringify(elgposter));
    }
  }, [elgposter]);
  // 3. Reset-knapp for elgposter:
  function handleResetElgposter() {
    if (window.confirm('Vil du tilbakestille elgposter til standard?')) {
      setElgposter([...ELGPOSTER]);
      localStorage.removeItem('elgposter');
    }
  }
  // --- Persistens for mørnings-timer (loggers) ---
  const [loggers, setLoggers] = useState<Logger[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('loggers');
      if (saved) {
        const arr = JSON.parse(saved);
        return arr.map((l: Logger) => ({
          id: l.id,
          name: l.name,
          lat: l.lat,
          lng: l.lng,
          startTime: l.startTime ?? null,
          target: l.target ?? 40,
          offset: l.offset ?? 0,
          accelerated: l.accelerated ?? false,
          running: l.running ?? false,
          simulatedElapsed: l.simulatedElapsed ?? 0,
        }));
      }
    }
    return [];
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('loggers', JSON.stringify(loggers));
    }
  }, [loggers]);

  // Hent fall-data én gang
  useEffect(() => {
    fetch('/api/fall').then(r => r.json()).then(data => setFallData(Array.isArray(data) ? data : []));
  }, []);

  return (
    <>
      <Head><title>Sandbekken IT & Drift</title></Head>
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "12px 4vw" }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fafcff', marginBottom: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sandbekken IT & Drift</h1>
      </header>
        <div style={{ position: 'sticky', top: 56, zIndex: 99, background: '#fafcff', marginBottom: 24 }}>
          <Tabs tabs={["Vær", "Postvær", "Post-trekk", "Dagens poster", "Kart", "Mørning", "Elgposter", "Fall/Obs", "ElgAI"]} current={activeTab} onChange={setActiveTab} />
      </div>
        {activeTab === "Vær" && (
          <WeatherTab
            hourly={hourly}
            forecast={forecast}
            expand={expand}
            setExpand={setExpand}
          />
        )}
        {activeTab === "Postvær" && (
          <PostvaerTab />
        )}
        {activeTab === "Post-trekk" && (
          <PostTrekkTab />
        )}
        {activeTab === "Dagens poster" && (
          <DagensPosterTab />
        )}
        {activeTab === "Kart" && (
          <KartTab
            postsToShow={postsToShow}
            setElgposter={setElgposter}
            DEFAULT_POSITION={DEFAULT_POSITION}
            kartVisning={kartVisning}
            setKartVisning={setKartVisning}
            dagensPosterInfo={dagensPosterInfo}
            showFallInMap={showFallInMap}
            setShowFallInMap={setShowFallInMap}
            showObsInMap={showObsInMap}
            setShowObsInMap={setShowObsInMap}
            fallObs={fallObs}
            mapLayer={mapLayer}
            setMapLayer={setMapLayer}
          />
        )}
        {activeTab === "Mørning" && (
          <MorningTab loggers={loggers} setLoggers={setLoggers} />
        )}
        {activeTab === "Elgposter" && (
          <ElgposterTab />
        )}
        {activeTab === "Fall/Obs" && <FallObsTab jegere={ELGJEGERE} fallObs={fallObs} setFallObs={setFallObs} loading={loadingFallObs} />}
        {activeTab === "ElgAI" && <JaktAI />}
    </div>
    </>
  );
}
