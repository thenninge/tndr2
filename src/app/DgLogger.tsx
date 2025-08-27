import React, { useState, useEffect } from 'react';
import type { Logger } from './constants';
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

function DgLogger({ logger, onChange, onDelete }: { logger: Logger; onChange: (l: Logger) => void; onDelete?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<{ t: number; sum: number; temp: number }[]>([]);
  const [estimate, setEstimate] = useState<{ t: number; sum: number }[]>([]);
  const [dgSum, setDgSum] = useState(0);
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const [estimatedDone, setEstimatedDone] = useState<Date | null>(null);
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
        // --- REACTIVATED API CALLS: Use real data with rate limiting ---
        console.log('🌍 Fetching real temperature data from API in DgLogger.tsx');
        const results = [];
        for (let i = 0; i < dates.length; i++) {
          const date = dates[i];
          // Add delay between API calls to avoid rate limiting
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
          }
          
          const today = new Date().toISOString().slice(0, 10);
          const isPast = new Date(date) < new Date(today);
          const url = isPast
            ? `https://archive-api.open-meteo.com/v1/archive?latitude=${logger.lat}&longitude=${logger.lng}&start_date=${date}&end_date=${date}&hourly=temperature_2m`
            : `https://api.open-meteo.com/v1/forecast?latitude=${logger.lat}&longitude=${logger.lng}&hourly=temperature_2m&timezone=auto&start_date=${date}&end_date=${date}`;
          const result = await fetch(url).then(r => r.json()).catch(() => null);
          results.push(result);
        }
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

export default DgLogger;
