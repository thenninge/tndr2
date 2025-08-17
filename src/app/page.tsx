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

// Type-definisjoner for hele appen
export type Post = {
  nr: number;
  name: string;
  lat: number;
  lng: number;
  omrade: string;
};
export type TrekkData = {
  postIdx: number;
  jeger: string;
};
export type Jeger = {
  navn: string;
  callsign: string;
};

export type WeatherData = {
  post: Post;
  hourly: HourlyForecast[];
};

// Funksjon for å oversette weathercode til ikon/tekst
function weatherIcon(code: number) {
  if (code === 0) return "☀️"; // Clear
  if (code === 1 || code === 2) return "🌤️"; // Mainly clear/partly cloudy
  if (code === 3) return "☁️"; // Overcast
  if (code === 45 || code === 48) return "🌫️"; // Fog
  if (code === 51 || code === 53 || code === 55) return "🌦️"; // Drizzle
  if (code === 61 || code === 63 || code === 65) return "🌧️"; // Rain
  if (code === 71 || code === 73 || code === 75) return "❄️"; // Snow
  if (code === 80 || code === 81 || code === 82) return "🌦️"; // Rain showers
  if (code === 95) return "⛈️"; // Thunderstorm
  if (code === 96 || code === 99) return "⛈️"; // Thunderstorm with hail
  return "❔";
}

const MapSection = dynamic(() => import("./MapSection"), { ssr: false });

const DEFAULT_POSITION: [number, number] = [60.72491439929582, 9.036524928167466];

function windDirectionText(deg: number) {
  if (deg >= 337.5 || deg < 22.5) return "N";
  if (deg >= 22.5 && deg < 67.5) return "NØ";
  if (deg >= 67.5 && deg < 112.5) return "Ø";
  if (deg >= 112.5 && deg < 157.5) return "SØ";
  if (deg >= 157.5 && deg < 202.5) return "S";
  if (deg >= 202.5 && deg < 247.5) return "SV";
  if (deg >= 247.5 && deg < 292.5) return "V";
  if (deg >= 292.5 && deg < 337.5) return "NV";
  return "?";
}

function WindArrow({ deg }: { deg: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        transform: `rotate(${deg + 90}deg)`,
        transition: "transform 0.2s",
        fontSize: 18,
        marginRight: 4,
      }}
      aria-label={`Vindretning: ${deg} grader`}
    >
      →
    </span>
  );
}

interface HourlyForecast {
  time: string;
  temp: number;
  windSpeed: number;
  windDir: number;
  weatherCode: number;
  precipitation: number;
}

interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  windSpeed: number;
  windDir: number;
  weatherCode: number;
  precipitation: number;
}

export type HourData = {
  time: string;
  temperature: number;
  weatherCode: number;
  precipitation: number;
};

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

function PostvaerTab() {
  const [selectedPosts, setSelectedPosts] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("postvaer_selectedPosts");
      if (saved) return JSON.parse(saved);
    }
    return ELGPOSTER.map(() => false);
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("postvaer_selectedPosts", JSON.stringify(selectedPosts));
    }
  }, [selectedPosts]);
  const [expanderOpen, setExpanderOpen] = useState(false);
  const [timeOption, setTimeOption] = useState('6timer');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("postvaer_weatherData");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("postvaer_weatherData", JSON.stringify(weatherData));
    }
  }, [weatherData]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('alfabetisk');

  // Sorter ELGPOSTER alfabetisk for visning
  const sortedIdx = ELGPOSTER
    .map((p, i) => ({ name: p.name, idx: i }))
    .sort((a, b) => sortBy === 'alfabetisk' ? a.name.localeCompare(b.name) : a.idx - b.idx)
    .map(x => x.idx);

  function handleToggle(idx: number) {
    setSelectedPosts((sel: boolean[]) => sel.map((v: boolean, i: number) => i === idx ? !v : v));
  }

  async function fetchWeatherForPosts() {
    setLoading(true);
    const posts = ELGPOSTER.filter((_, i) => selectedPosts[i]);
    const now = new Date();
    let from: Date, to: Date;
    if (timeOption === '6timer') {
      from = new Date(now);
      to = new Date(now); to.setHours(to.getHours() + 6);
    } else if (timeOption === 'imorgen1') {
      from = new Date(now); from.setDate(from.getDate() + 1); from.setHours(7,0,0,0);
      to = new Date(from); to.setHours(12,0,0,0);
    } else if (timeOption === 'imorgen2') {
      from = new Date(now); from.setDate(from.getDate() + 1); from.setHours(12,0,0,0);
      to = new Date(from); to.setHours(16,0,0,0);
    } else {
      from = new Date(customFrom);
      to = new Date(customTo);
    }
    const results = await Promise.all(posts.map(async post => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${post.lat}&longitude=${post.lng}&hourly=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation&timezone=auto&start_date=${from.toISOString().slice(0,10)}&end_date=${to.toISOString().slice(0,10)}`;
      const res = await fetch(url);
      const data = await res.json();
      // Filtrer hourly på valgt tidsrom
      const hours: HourlyForecast[] = (data.hourly?.time || []).map((t: string, idx: number) => ({
        time: t,
        temp: data.hourly.temperature_2m[idx],
        windSpeed: data.hourly.windspeed_10m[idx],
        windDir: data.hourly.winddirection_10m[idx],
        weatherCode: data.hourly.weathercode[idx],
        precipitation: data.hourly.precipitation[idx],
      })).filter((h: HourlyForecast) => {
        const ht = new Date(h.time);
        return ht >= from && ht <= to;
      });
      return { post, hourly: hours };
    }));
    setWeatherData(results);
    setLoading(false);
  }

  const numSelected = selectedPosts.filter(Boolean).length;

  // Sorteringslogikk
  const sortedWeatherData = [...weatherData];
  if (sortBy === 'nord-sor') {
    sortedWeatherData.sort((a, b) => b.post.lat - a.post.lat);
  } else if (sortBy === 'sor-nord') {
    sortedWeatherData.sort((a, b) => a.post.lat - b.post.lat);
  } else if (sortBy === 'ost-vest') {
    sortedWeatherData.sort((a, b) => b.post.lng - a.post.lng);
  } else if (sortBy === 'vest-ost') {
    sortedWeatherData.sort((a, b) => a.post.lng - b.post.lng);
  } else if (sortBy === 'omrade') {
    const omradeOrder = ["Strupen", "Høgemyr/GN", "Marstein", "Søndre", "Røytjern"];
    sortedWeatherData.sort((a, b) => {
      const areaA = omradeOrder.indexOf(a.post.omrade);
      const areaB = omradeOrder.indexOf(b.post.omrade);
      if (areaA === -1 && areaB === -1) return a.post.nr - b.post.nr;
      if (areaA === -1) return 1;
      if (areaB === -1) return -1;
      if (areaA !== areaB) return areaA - areaB;
      return a.post.nr - b.post.nr;
    });
  }

  function handleClearSelection() {
    setSelectedPosts(ELGPOSTER.map(() => false));
    setWeatherData([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("postvaer_selectedPosts");
      localStorage.removeItem("postvaer_weatherData");
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Postvær</h2>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <button onClick={() => setExpanderOpen(v => !v)} style={{ padding: '7px 16px', borderRadius: 8, background: '#f4f8ff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginBottom: 8 }}>
          Velg poster ({numSelected} valgt{numSelected === 1 ? '' : 'e'}) {expanderOpen ? '▲' : '▼'}
        </button>
        <div>
          <b>Sorter etter:</b>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #bbb', fontSize: 15 }}>
            <option value="nord-sor">Nord → Sør</option>
            <option value="sor-nord">Sør → Nord</option>
            <option value="ost-vest">Øst → Vest</option>
            <option value="vest-ost">Vest → Øst</option>
            <option value="omrade">Område</option>
          </select>
        </div>
        <button onClick={handleClearSelection} style={{ marginLeft: 12, padding: '8px 18px', borderRadius: 8, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 16, cursor: 'pointer' }}>Slett valg</button>
      </div>
      {expanderOpen && (
        <ul style={{ listStyle: 'none', padding: 0, columns: 2, maxWidth: 500, marginTop: 8, marginBottom: 8, background: '#f8faff', border: '1px solid #dde', borderRadius: 8, boxShadow: '0 2px 8px #0001', paddingLeft: 12, paddingRight: 12 }}>
          {sortedIdx.map(idx => (
            <li key={ELGPOSTER[idx].name} style={{ marginBottom: 4 }}>
              <label style={{ cursor: 'pointer', fontSize: 16 }}>
                <input type="checkbox" checked={selectedPosts[idx]} onChange={() => handleToggle(idx)} style={{ marginRight: 7 }} />
                {ELGPOSTER[idx].name}
              </label>
            </li>
          ))}
        </ul>
      )}
      <div style={{ marginBottom: 16 }}>
        <b>Velg tidsrom:</b>
        <div style={{ display: 'flex', gap: 18, marginTop: 6, marginBottom: 6 }}>
          <label><input type="radio" name="timeopt" value="6timer" checked={timeOption==='6timer'} onChange={e=>setTimeOption(e.target.value)} /> 6 timer fra nå</label>
          <label><input type="radio" name="timeopt" value="imorgen1" checked={timeOption==='imorgen1'} onChange={e=>setTimeOption(e.target.value)} /> I morgen 07–12</label>
          <label><input type="radio" name="timeopt" value="imorgen2" checked={timeOption==='imorgen2'} onChange={e=>setTimeOption(e.target.value)} /> I morgen 12–16</label>
          <label><input type="radio" name="timeopt" value="custom" checked={timeOption==='custom'} onChange={e=>setTimeOption(e.target.value)} /> Sett tidsrom</label>
        </div>
        {timeOption === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input type="datetime-local" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} />
            <span>til</span>
            <input type="datetime-local" value={customTo} onChange={e=>setCustomTo(e.target.value)} />
          </div>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={fetchWeatherForPosts} disabled={selectedPosts.every((v: boolean) => !v) || loading || (timeOption==='custom' && (!customFrom || !customTo))} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Hent værmelding</button>
      </div>
      {loading && <div>Laster værdata...</div>}
      {sortedWeatherData.length > 0 && sortedWeatherData.map(({post, hourly}) => (
        <div key={post.name} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>{post.name}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 4 }}>Tid</th>
                <th style={{ textAlign: "left", padding: 4 }}>Temp</th>
                <th style={{ textAlign: "left", padding: 4 }}>Vind (m/s)</th>
                <th style={{ textAlign: "left", padding: 4 }}>Retning</th>
                <th style={{ textAlign: "left", padding: 4 }}>Vær</th>
                <th style={{ textAlign: "left", padding: 4 }}>Nedbør (mm)</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((h: HourlyForecast) => (
                <tr key={h.time}>
                  <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                  <td style={{ padding: 4 }}>{h.temp}°C</td>
                  <td style={{ padding: 4 }}>{h.windSpeed}</td>
                  <td style={{ padding: 4 }}><WindArrow deg={h.windDir} /> {windDirectionText(h.windDir)}</td>
                  <td style={{ padding: 4 }}>{weatherIcon(h.weatherCode)}</td>
                  <td style={{ padding: 4 }}>{h.precipitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}

function ElgposterTab({ posts, setPosts }: { posts: Post[]; setPosts: React.Dispatch<React.SetStateAction<Post[]>> }) {
  const [sortBy, setSortBy] = useState('omrade');
  const [showAdd, setShowAdd] = useState(false);
  const [newNr, setNewNr] = useState('');
  const [newName, setNewName] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newOmrade, setNewOmrade] = useState('');
  // Fast område-rekkefølge
  const omradeOrder = ["Strupen", "Høgemyr/GN", "Marstein", "Søndre", "Røytjern"];
  // Finn ELGHYTTA-posisjon
  const ELGHYTTA = posts.find(p => /hytte|elghytta/i.test(p.name));
  function distFromHytta(post: {lat:number;lng:number}) {
    if (!ELGHYTTA) return 0;
    const toRad = (d:number) => d * Math.PI / 180;
    const R = 6371000; // meter
    const dLat = toRad(post.lat - ELGHYTTA.lat);
    const dLng = toRad(post.lng - ELGHYTTA.lng);
    const a = Math.sin(dLat/2)**2 + Math.cos(toRad(ELGHYTTA.lat))*Math.cos(toRad(post.lat))*Math.sin(dLng/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  // Område-sortering
  let sortedPosts: Post[] = [];
  if (sortBy === 'omrade') {
    omradeOrder.forEach(omr => {
      const group = posts.filter(p => p.omrade === omr).sort((a,b)=>(a.nr||0)-(b.nr||0));
      sortedPosts.push(...group);
    });
    // Legg til evt. andre områder til slutt
    const rest = posts.filter(p => !omradeOrder.includes(p.omrade)).sort((a,b)=>a.omrade.localeCompare(b.omrade));
    sortedPosts.push(...rest);
  } else {
    sortedPosts = [...posts];
    if (sortBy === 'nord-sor') sortedPosts.sort((a,b)=>b.lat-a.lat);
    else if (sortBy === 'sor-nord') sortedPosts.sort((a,b)=>a.lat-b.lat);
    else if (sortBy === 'ost-vest') sortedPosts.sort((a,b)=>b.lng-a.lng);
    else if (sortBy === 'vest-ost') sortedPosts.sort((a,b)=>a.lng-b.lng);
    else if (sortBy === 'alfabetisk') sortedPosts.sort((a,b)=>a.name.localeCompare(b.name));
    else if (sortBy === 'nummerert') sortedPosts.sort((a,b)=>(a.nr||0)-(b.nr||0));
    else if (sortBy === 'hytta') sortedPosts.sort((a,b)=>distFromHytta(a)-distFromHytta(b));
  }
  function handleDelete(idx:number) {
    if (window.confirm('Vil du slette denne posten?')) setPosts((p: Post[]) => p.filter((_,i)=>i!==idx));
  }
  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!newName.trim() || isNaN(Number(newLat)) || isNaN(Number(newLng)) || isNaN(Number(newNr)) || !newOmrade.trim()) return;
    setPosts(p=>[...p,{nr:Number(newNr),name:newName.trim(),lat:Number(newLat),lng:Number(newLng),omrade:newOmrade.trim()}]);
    setShowAdd(false); setNewName(''); setNewLat(''); setNewLng(''); setNewNr(''); setNewOmrade('');
  }
  // --- Edit-modus ---
  const [editIdx, setEditIdx] = useState<number|null>(null);
  const [editPost, setEditPost] = useState<Post|null>(null);
  function handleEdit(idx: number) {
    setEditIdx(idx);
    setEditPost({ ...sortedPosts[idx] });
  }
  function handleEditChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!editPost) return;
    const { name, value } = e.target;
    setEditPost({ ...editPost, [name]: name === 'nr' || name === 'lat' || name === 'lng' ? Number(value) : value });
  }
  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (editIdx === null || !editPost) return;
    setPosts(posts => posts.map((p, i) => i === posts.indexOf(sortedPosts[editIdx]) ? editPost : p));
    setEditIdx(null);
    setEditPost(null);
  }
  function handleCancelEdit() {
    setEditIdx(null);
    setEditPost(null);
  }
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Elgposter</h2>
      <div style={{ marginBottom: 16, display: 'flex', gap: 18, alignItems: 'center' }}>
        <b>Sorter etter:</b>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #bbb', fontSize: 15 }}>
          <option value="omrade">Område-sortering</option>
          <option value="nord-sor">Nord → Sør</option>
          <option value="sor-nord">Sør → Nord</option>
          <option value="ost-vest">Øst → Vest</option>
          <option value="vest-ost">Vest → Øst</option>
          <option value="alfabetisk">Alfabetisk</option>
          <option value="nummerert">Nummerert</option>
          <option value="hytta">Avstand fra hytta</option>
        </select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={()=>setShowAdd(v=>!v)} style={{ padding: '7px 16px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginBottom: 8 }}>{showAdd ? 'Avbryt' : 'Legg til post'}</button>
      </div>
      {showAdd && (
        <form onSubmit={handleAdd} style={{ marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="number" value={newNr} onChange={e=>setNewNr(e.target.value)} placeholder="Nr" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 60 }} required />
          <input type="text" value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Navn" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 120 }} required />
          <input type="number" value={newLat} onChange={e=>setNewLat(e.target.value)} placeholder="Breddegrad" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 120 }} required step="any" />
          <input type="number" value={newLng} onChange={e=>setNewLng(e.target.value)} placeholder="Lengdegrad" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 120 }} required step="any" />
          <input type="text" value={newOmrade} onChange={e=>setNewOmrade(e.target.value)} placeholder="Område" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 120 }} required />
          <button type="submit" style={{ padding: '7px 16px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Legg til</button>
        </form>
      )}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: 4 }}>Nr</th>
            <th style={{ textAlign: 'left', padding: 4 }}>Navn</th>
            <th style={{ textAlign: 'left', padding: 4 }}>Område</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedPosts.map((post, idx) => (
            <tr key={post.nr+post.name+post.lat+post.lng}>
              {editIdx === idx && editPost ? (
                <>
                  <td><input type="number" name="nr" value={editPost.nr} onChange={handleEditChange} style={{ width: 60 }} /></td>
                  <td><input type="text" name="name" value={editPost.name} onChange={handleEditChange} style={{ width: 120 }} /></td>
                  <td><input type="text" name="omrade" value={editPost.omrade} onChange={handleEditChange} style={{ width: 120 }} /></td>
                  <td>
                    <button onClick={handleUpdate} style={{ padding: '3px 10px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 14, cursor: 'pointer', marginRight: 4 }}>Lagre</button>
                    <button onClick={handleCancelEdit} style={{ padding: '3px 10px', borderRadius: 7, background: '#eee', border: '1px solid #bbb', fontSize: 14, cursor: 'pointer' }}>Avbryt</button>
                  </td>
                </>
              ) : (
                <>
                  <td style={{ padding: 4 }}>{post.nr}</td>
                  <td style={{ padding: 4 }}>{post.name}</td>
                  <td style={{ padding: 4 }}>{post.omrade}</td>
                  <td style={{ padding: 4 }}>
                    <button onClick={()=>handleDelete(posts.indexOf(post))} style={{ padding: '3px 10px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 14, cursor: 'pointer' }}>Slett</button>
                    <button onClick={()=>handleEdit(idx)} style={{ padding: '3px 10px', borderRadius: 7, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 14, cursor: 'pointer', marginLeft: 4 }}>Endre</button>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// Ny DagensPosterTab:
import type { Elgpost } from "./types";

function DagensPosterTab({ posts, jegere }: { posts: Elgpost[]; jegere: { navn: string; callsign: string }[] }) {
  const [fordeling, setFordeling] = useState<{ postIdx: number; jeger: string }[]>([]);
  const [edit, setEdit] = useState<{ [postIdx: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta'>('alfabetisk');
  // Hent dagens fordeling
  useEffect(() => {
    setLoading(true);
    fetch("/api/dagensposter")
      .then(r => r.json())
      .then(data => {
        setFordeling(Array.isArray(data) ? data : []);
        setEdit({});
        setLoading(false);
      });
  }, []);
  // Lagre dagens fordeling
  async function save() {
    setSaving(true);
    const ny = fordeling.map((f) => ({ postIdx: f.postIdx, jeger: edit[f.postIdx] ?? f.jeger }));
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ny),
    });
    setFordeling(ny);
    setEdit({});
    setSaving(false);
  }
  // Slett/Nullstill dagens poster
  async function clearList() {
    setDeleting(true);
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
    setFordeling([]);
    setEdit({});
    setDeleting(false);
    setShowAddFirst(false); // nullstill alltid
    setShowAddRow(false); // nullstill alltid
  }
  const [showAddFirst, setShowAddFirst] = useState(false);
  const [selectedPosts, setSelectedPosts] = useState<number[]>([]); // indexer til valgte poster
  const [postJeger, setPostJeger] = useState<{ [postIdx: number]: string }>({});
  function handleTogglePost(idx: number) {
    setSelectedPosts((prev: number[]) => prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]);
  }
  function handleSetJeger(idx: number, jeger: string) {
    setPostJeger(j => ({ ...j, [idx]: jeger }));
  }
  async function handleSaveNewList(e: React.FormEvent) {
    e.preventDefault();
    if (selectedPosts.length === 0) return;
    const ny = selectedPosts.map(idx => ({ postIdx: idx, jeger: postJeger[idx] || '' }));
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ny),
    });
    setFordeling(ny);
    setEdit({});
    setShowAddFirst(false);
    setSelectedPosts([]);
    setPostJeger({});
  }
  const [showAddRow, setShowAddRow] = useState(false);
  const [addPostIdx, setAddPostIdx] = useState('');
  const [addJeger, setAddJeger] = useState('');
  const [addSortBy, setAddSortBy] = useState<'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta'>('alfabetisk');
  async function handleAddRow(e: React.FormEvent) {
    e.preventDefault();
    if (!addPostIdx || !addJeger) return;
    const ny = [...fordeling, { postIdx: Number(addPostIdx), jeger: addJeger }];
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ny),
    });
    setFordeling(ny);
    setEdit({});
    setShowAddRow(false);
    setAddPostIdx('');
    setAddJeger('');
  }
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Dagens poster</h2>
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, justifyContent: 'space-between' }}>
        <div>
          {fordeling.length === 0 ? (
            !showAddFirst ? (
              <button onClick={() => { setShowAddFirst(true); setShowAddRow(false); }} disabled={deleting || loading} style={{ padding: '7px 16px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Opprett ny liste</button>
            ) : null
          ) : (
            <button onClick={() => { setShowAddRow(true); setShowAddFirst(false); }} style={{ padding: '7px 16px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Legg til post</button>
          )}
        </div>
        {fordeling.length > 0 && (
          <button onClick={clearList} disabled={deleting || loading} style={{ padding: '7px 16px', borderRadius: 8, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 15, cursor: 'pointer' }}>Slett liste</button>
        )}
      </div>
      {showAddFirst && fordeling.length === 0 && (
        <form onSubmit={handleSaveNewList} style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
            <b>1. Velg poster:</b>
            <label style={{ fontWeight: 400, fontSize: 15 }}>
              Sorter postliste:
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ marginLeft: 6, fontSize: 15, padding: 3, borderRadius: 5 }}>
                <option value="omrade">Område-sortering</option>
                <option value="nord-sor">Nord → Sør</option>
                <option value="sor-nord">Sør → Nord</option>
                <option value="ost-vest">Øst → Vest</option>
                <option value="vest-ost">Vest → Øst</option>
                <option value="alfabetisk">Alfabetisk</option>
                <option value="nummerert">Nummerert</option>
                <option value="hytta">Avstand fra hytta</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <ul style={{ listStyle: 'none', padding: 0, columns: 2, maxWidth: 500, marginBottom: 12 }}>
                {(() => {
                  let arr = posts.map((p, idx) => ({ ...p, idx }));
                  if (sortBy === 'omrade') {
                    arr = arr.sort((a, b) => a.omrade.localeCompare(b.omrade) || a.name.localeCompare(b.name));
                    const grouped: { [omrade: string]: typeof arr } = {};
                    arr.forEach(p => {
                      if (!grouped[p.omrade]) grouped[p.omrade] = [];
                      grouped[p.omrade].push(p);
                    });
                    return Object.entries(grouped).flatMap(([omrade, posts]) => [
                      <li key={omrade} style={{ margin: '8px 0 2px 0', fontWeight: 700, fontSize: 15, color: '#444' }}>{omrade}</li>,
                      ...posts.map(p => (
                        <li key={p.nr+p.name} style={{ marginBottom: 4, marginLeft: 8 }}>
                          <label style={{ cursor: 'pointer', fontSize: 16 }}>
                            <input type="checkbox" checked={selectedPosts.includes(p.idx)} onChange={() => handleTogglePost(p.idx)} style={{ marginRight: 7 }} />
                            {p.name}
                          </label>
                        </li>
                      ))
                    ]);
                  }
                  switch (sortBy) {
                    case 'nord-sor':
                      arr = arr.sort((a, b) => b.lat - a.lat);
                      break;
                    case 'sor-nord':
                      arr = arr.sort((a, b) => a.lat - b.lat);
                      break;
                    case 'ost-vest':
                      arr = arr.sort((a, b) => b.lng - a.lng);
                      break;
                    case 'vest-ost':
                      arr = arr.sort((a, b) => a.lng - b.lng);
                      break;
                    case 'alfabetisk':
                      arr = arr.sort((a, b) => a.name.localeCompare(b.name));
                      break;
                    case 'nummerert':
                      arr = arr.sort((a, b) => a.nr - b.nr);
                      break;
                    case 'hytta':
                      arr = arr.sort((a, b) => {
                        const distA = Math.sqrt(Math.pow(a.lat - 60.72479028725314, 2) + Math.pow(a.lng - 9.036607137866255, 2));
                        const distB = Math.sqrt(Math.pow(b.lat - 60.72479028725314, 2) + Math.pow(b.lng - 9.036607137866255, 2));
                        return distA - distB;
                      });
                      break;
                  }
                  return arr.map(p => (
                    <li key={p.nr+p.name} style={{ marginBottom: 4 }}>
                      <label style={{ cursor: 'pointer', fontSize: 16 }}>
                        <input type="checkbox" checked={selectedPosts.includes(p.idx)} onChange={() => handleTogglePost(p.idx)} style={{ marginRight: 7 }} />
                        {p.name}
                      </label>
                    </li>
                  ));
                })()}
              </ul>
            </div>
            <div style={{ minWidth: 180, maxWidth: 260, background: '#f6faff', border: '2px solid #b2d8f6', borderRadius: 10, padding: '10px 16px', fontSize: 18, fontWeight: 500, color: '#235', boxShadow: '0 2px 8px #0001' }}>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 6, color: '#1a4b7a' }}>Valgte poster:</div>
              {selectedPosts.length === 0 ? <div style={{ color: '#888', fontSize: 16 }}>Ingen valgt</div> :
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {selectedPosts.map(idx => <li key={idx} style={{ marginBottom: 2 }}>{posts[idx].name}</li>)}
                </ul>
              }
            </div>
          </div>
          {selectedPosts.length > 0 && (
            <>
              <div style={{ marginBottom: 10 }}><b>2. Velg jeger for hver post:</b></div>
              <ul style={{ listStyle: 'none', padding: 0, maxWidth: 500 }}>
                {selectedPosts.map(idx => (
                  <li key={idx} style={{ marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ minWidth: 120 }}>{posts[idx].name}</span>
                    <select value={postJeger[idx] || ''} onChange={e => handleSetJeger(idx, e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required>
                      <option value="">Velg jeger</option>
                      {jegere.filter(j => !Object.entries(postJeger).some(([k, v]) => Number(k) !== idx && v === j.navn) || postJeger[idx] === j.navn).map(j => (
                        <option key={j.navn} value={j.navn}>{j.navn}</option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div style={{ marginTop: 12 }}>
            <button type="submit" disabled={selectedPosts.length === 0 || selectedPosts.some(idx => !postJeger[idx])} style={{ padding: '7px 16px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: selectedPosts.length === 0 || selectedPosts.some(idx => !postJeger[idx]) ? 'not-allowed' : 'pointer', marginRight: 8 }}>Lagre</button>
            <button type="button" onClick={() => { setShowAddFirst(false); setSelectedPosts([]); setPostJeger({}); }} style={{ padding: '7px 16px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 15, cursor: 'pointer' }}>Avbryt</button>
          </div>
        </form>
      )}
      {showAddRow && fordeling.length > 0 && (
        <form onSubmit={handleAddRow} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
          <select value={addPostIdx} onChange={e => setAddPostIdx(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required>
            <option value="">Velg post</option>
            {(() => {
              let arr = posts.map((p, idx) => ({ ...p, idx })).filter(p => !fordeling.some(f => f.postIdx === p.idx) || addPostIdx === String(p.idx));
              switch (addSortBy) {
                case 'omrade':
                  arr = arr.sort((a, b) => a.omrade.localeCompare(b.omrade) || a.name.localeCompare(b.name));
                  break;
                case 'nord-sor':
                  arr = arr.sort((a, b) => b.lat - a.lat);
                  break;
                case 'sor-nord':
                  arr = arr.sort((a, b) => a.lat - b.lat);
                  break;
                case 'ost-vest':
                  arr = arr.sort((a, b) => b.lng - a.lng);
                  break;
                case 'vest-ost':
                  arr = arr.sort((a, b) => a.lng - b.lng);
                  break;
                case 'alfabetisk':
                  arr = arr.sort((a, b) => a.name.localeCompare(b.name));
                  break;
                case 'nummerert':
                  arr = arr.sort((a, b) => a.nr - b.nr);
                  break;
                case 'hytta':
                  arr = arr.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.lat - 60.72479028725314, 2) + Math.pow(a.lng - 9.036607137866255, 2));
                    const distB = Math.sqrt(Math.pow(b.lat - 60.72479028725314, 2) + Math.pow(b.lng - 9.036607137866255, 2));
                    return distA - distB;
                  });
                  break;
              }
              return arr.map(p => (
                <option key={p.nr+p.name} value={p.idx}>{p.name}</option>
              ));
            })()}
          </select>
          <select value={addJeger} onChange={e => setAddJeger(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required>
            <option value="">Velg jeger</option>
            {jegere.filter(j => !fordeling.some(f => f.jeger === j.navn) || addJeger === j.navn).map(j => (
              <option key={j.navn} value={j.navn}>{j.navn}</option>
            ))}
          </select>
          <select value={addSortBy} onChange={e => setAddSortBy(e.target.value as any)} style={{ fontSize: 15, padding: 3, borderRadius: 5, marginLeft: 8 }}>
            <option value="omrade">Område-sortering</option>
            <option value="nord-sor">Nord → Sør</option>
            <option value="sor-nord">Sør → Nord</option>
            <option value="ost-vest">Øst → Vest</option>
            <option value="vest-ost">Vest → Øst</option>
            <option value="alfabetisk">Alfabetisk</option>
            <option value="nummerert">Nummerert</option>
            <option value="hytta">Avstand fra hytta</option>
          </select>
          <button type="submit" style={{ padding: '7px 16px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Lagre</button>
          <button type="button" onClick={() => { setShowAddRow(false); setAddPostIdx(''); setAddJeger(''); }} style={{ padding: '7px 16px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 15, cursor: 'pointer' }}>Avbryt</button>
        </form>
      )}
      {loading ? <div>Laster...</div> : (
        fordeling.length === 0 ? (
          <div style={{ color: '#888', fontSize: 17, marginBottom: 12 }}>Ingen poster er trukket og sendt inn ennå.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: 4 }}>Post</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Jeger</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Callsign</th>
                <th style={{ textAlign: 'left', padding: 4 }}>Slett</th>
              </tr>
            </thead>
            <tbody>
              {fordeling.map((f) => {
                const post = posts[f.postIdx];
                const valgt = edit[f.postIdx] ?? f.jeger;
                const jegerObj = jegere.find(j => j.navn === valgt);
                return (
                  <tr key={post.nr+post.name}>
                    <td style={{ padding: 4, fontWeight: 700 }}>{post.name}</td>
                    <td style={{ padding: 4 }}>
                      <select value={valgt} onChange={e => setEdit(ed => ({ ...ed, [f.postIdx]: e.target.value }))} style={{ fontSize: 16, padding: 4, borderRadius: 6 }}>
                        <option value="">Velg jeger</option>
                        {jegere.filter(j => !fordeling.some(ff => (edit[ff.postIdx] ?? ff.jeger) === j.navn && ff.postIdx !== f.postIdx) || valgt === j.navn).map(j => (
                          <option key={j.navn} value={j.navn}>{j.navn}</option>
                        ))}
                      </select>
                    </td>
                    <td style={{ padding: 4, color: '#4a90e2', fontWeight: 600 }}>{jegerObj?.callsign || ''}</td>
                    <td style={{ padding: 4 }}>
                      <button onClick={async () => {
                        const ny = fordeling.filter(ff => ff !== f);
                        await fetch("/api/dagensposter", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(ny),
                        });
                        setFordeling(ny);
                        setEdit(ed => { const c = { ...ed }; delete c[f.postIdx]; return c; });
                      }} style={{ padding: '3px 10px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 14, cursor: 'pointer' }}>Slett</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )
      )}
      <button onClick={save} disabled={saving || fordeling.length === 0} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: fordeling.length === 0 ? 'not-allowed' : 'pointer' }}>Lagre dagens poster</button>
      <div style={{ marginTop: 18, color: '#888', fontSize: 15 }}>Alle på jaktlaget ser denne listen. Du kan endre hvem som er på hvilken post og lagre på nytt.</div>
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

  return (
    <>
      <Head><title>Sandbekken IT & Drift</title></Head>
      <div style={{ width: "100%", maxWidth: "100%", margin: "0 auto", padding: "12px 4vw" }}>
        <header style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fafcff', marginBottom: 0 }}>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sandbekken IT & Drift</h1>
      </header>
        <div style={{ position: 'sticky', top: 56, zIndex: 99, background: '#fafcff', marginBottom: 24 }}>
          <Tabs tabs={["Vær", "Postvær", "Trekk din post!", "Dagens poster", "Kart", "Mørning", "Elgposter"]} current={activeTab} onChange={setActiveTab} />
      </div>
        {activeTab === "Vær" && (
          <section>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Vær for de neste 6 timene (Elghytta)</h2>
        {hourly.length === 0 ? (
          <div>Laster værmelding...</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 4 }}>Tid</th>
                <th style={{ textAlign: "left", padding: 4 }}>Temp</th>
                <th style={{ textAlign: "left", padding: 4 }}>Vind (m/s)</th>
                <th style={{ textAlign: "left", padding: 4 }}>Retning</th>
                    <th style={{ textAlign: "left", padding: 4 }}>Vær</th>
                    <th style={{ textAlign: "left", padding: 4 }}>Nedbør (mm)</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((h) => (
                <tr key={h.time}>
                      <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                  <td style={{ padding: 4 }}>{h.temp}°C</td>
                  <td style={{ padding: 4 }}>{h.windSpeed}</td>
                  <td style={{ padding: 4 }}>
                    <WindArrow deg={h.windDir} />
                        {windDirectionText(h.windDir)}
                  </td>
                      <td style={{ padding: 4 }}>{weatherIcon(h.weatherCode)}</td>
                      <td style={{ padding: 4 }}>{h.precipitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
            <div style={{ marginTop: 24 }}>
        <button onClick={() => setExpand((v) => !v)} style={{ padding: "6px 14px", fontSize: 15, borderRadius: 8, cursor: "pointer", marginBottom: 8 }}>
          {expand ? "Skjul 3-dagersvarsel" : "Vis 3-dagersvarsel"}
        </button>
        {expand && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Værmelding neste 3 dager</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 4 }}>Dato</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Min</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Max</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Vind (m/s)</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Retning</th>
                        <th style={{ textAlign: "left", padding: 4 }}>Vær</th>
                        <th style={{ textAlign: "left", padding: 4 }}>Nedbør (mm)</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((day) => (
                  <tr key={day.date}>
                    <td style={{ padding: 4 }}>{day.date}</td>
                    <td style={{ padding: 4 }}>{day.tempMin}°C</td>
                    <td style={{ padding: 4 }}>{day.tempMax}°C</td>
                    <td style={{ padding: 4 }}>{day.windSpeed}</td>
                    <td style={{ padding: 4 }}>
                      <WindArrow deg={day.windDir} />
                            {windDirectionText(day.windDir)}
                    </td>
                          <td style={{ padding: 4 }}>{weatherIcon(day.weatherCode)}</td>
                          <td style={{ padding: 4 }}>{day.precipitation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
            </div>
      </section>
        )}
        {activeTab === "Postvær" && (
          <PostvaerTab />
        )}
        {activeTab === "Trekk din post!" && (
          <TrekkDinPost posts={elgposter} trekkData={trekkData} setTrekkData={setTrekkData} />
        )}
        {activeTab === "Dagens poster" && (
          <DagensPosterTab posts={elgposter} jegere={ELGJEGERE} />
        )}
        {activeTab === "Kart" && (
          <div style={{ margin: '0 auto', maxWidth: 900 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              <button onClick={() => setKartVisning('alle')} style={{ padding: '7px 16px', borderRadius: 8, background: kartVisning === 'alle' ? '#e0eaff' : '#f4f4f4', border: kartVisning === 'alle' ? '2px solid #4a90e2' : '1px solid #ccc', fontWeight: kartVisning === 'alle' ? 600 : 400, cursor: 'pointer' }}>Vis alle poster</button>
              <button onClick={() => setKartVisning('dagens')} style={{ padding: '7px 16px', borderRadius: 8, background: kartVisning === 'dagens' ? '#e0eaff' : '#f4f4f4', border: kartVisning === 'dagens' ? '2px solid #4a90e2' : '1px solid #ccc', fontWeight: kartVisning === 'dagens' ? 600 : 400, cursor: 'pointer' }}>Vis kun dagens poster</button>
              <div style={{ marginLeft: 'auto' }}>
                <select value={mapLayer} onChange={e => setMapLayer(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #bbb', fontSize: 15 }}>
                  <option value="satellite">🛰️ Flyfoto (Esri)</option>
                  <option value="opentopo">🗺️ OpenTopoMap</option>
                  <option value="combo">🛰️+🗺️ Combo</option>
                </select>
              </div>
            </div>
            <MapSection
              position={DEFAULT_POSITION}
              posts={postsToShow}
              setPosts={setElgposter}
              selectedLayer={mapLayer}
              {...(kartVisning === 'dagens' ? { dagensPosterInfo } : {})}
            />
          </div>
        )}
        {activeTab === "Mørning" && (
      <section>
            <h2 style={{ fontSize: 20, marginBottom: 8 }}>Mørning</h2>
            <div style={{ marginBottom: 18 }}>
              <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Legg til ny logg</button>
            </div>
            {showAdd && (
              <form onSubmit={e => { e.preventDefault(); if (newName.trim()) { setLoggers(l => [...l, {
                id: Date.now() + Math.random() + '',
                name: newName.trim(),
                lat: 60.7249,
                lng: 9.0365,
                running: false,
                accelerated: false,
                target: 40,
                offset: 0,
                startTime: null,
                simulatedElapsed: 0,
              }]); setNewName(''); setShowAdd(false); } }} style={{ marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Navn på logg" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 180 }} required />
                <button type="submit" style={{ padding: '7px 16px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Opprett</button>
                <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 15, cursor: 'pointer' }}>Avbryt</button>
              </form>
            )}
            {loggers.length === 0 && <div style={{ color: '#888', marginBottom: 12 }}>Ingen logger opprettet ennå.</div>}
            {loggers.map((l: Logger) => (
              <DgLogger
                key={l.id}
                logger={l}
                onChange={updated => setLoggers(loggers => loggers.map(x => x.id === l.id ? updated : x))}
                onDelete={() => setLoggers((loggers: Logger[]) => loggers.filter((x: Logger) => x.id !== l.id))}
              />
            ))}
      </section>
        )}
        {activeTab === "Elgposter" && (
          <ElgposterTab posts={posts} setPosts={setPosts} />
        )}
    </div>
    </>
  );
}
