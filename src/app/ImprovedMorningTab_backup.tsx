import React, { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Logger {
  id: string;
  name: string;
  lat: number;
  lng: number;
  target: number;
  offset: number;
  baseTemp: number;
  realHistory: { time: Date; temp: number; dg: number }[];
  accumulatedDG: number;
  lastFetched?: Date;
  isRunning: boolean;
  startTime?: Date;
}

async function fetchForecast(lat: number, lon: number) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunne ikke hente værdata");
  const data = await res.json();

  return data.hourly.time.map((t: string, i: number) => ({
    time: new Date(t),
    temp: data.hourly.temperature_2m[i],
  }));
}

// Henter historiske data fra from → to
async function fetchHistory(
  lat: number,
  lon: number,
  from: Date,
  to: Date
): Promise<{ time: Date; temp: number }[]> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&start_date=${from
    .toISOString()
    .slice(0, 10)}&end_date=${to
    .toISOString()
    .slice(0, 10)}&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunne ikke hente historiske data");
  const data = await res.json();

  return data.hourly.time.map((t: string, i: number) => ({
    time: new Date(t),
    temp: data.hourly.temperature_2m[i],
  }));
}

function calculateDG(
  points: { time: Date; temp: number }[],
  baseTemp = 0,
  stepHours = 3,
  targetDG = 40
) {
  let cumDG = 0;
  const result: { time: string; dg: number }[] = [];
  let targetReached = false;
  let hoursAfterTarget = 0;

  for (let i = 0; i < points.length; i += stepHours) {
    const t = points[i];
    const dgHour = Math.max(0, t.temp - baseTemp);
    cumDG += (dgHour * stepHours) / 24;
    
    result.push({
      time: t.time.toLocaleString("no-NO", {
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      }),
      dg: Number(cumDG.toFixed(2)),
    });

    // Sjekk om target er nådd
    if (!targetReached && cumDG >= targetDG) {
      targetReached = true;
    }

    // Hvis target er nådd, tell timer etter target
    if (targetReached) {
      hoursAfterTarget += stepHours;
      
      // Stopp etter 12 timer etter target
      if (hoursAfterTarget >= 12) {
        break;
      }
    }
  }
  return result;
}

// Oppdaterer real logg fra sistFetched → nå
async function refreshRealLog(logger: Logger): Promise<Logger> {
  const now = new Date();
  const from = logger.lastFetched ?? logger.realHistory.at(-1)?.time ?? now;
  if (from >= now) return logger; // ingenting nytt å hente

  const history = await fetchHistory(logger.lat, logger.lng, from, now);

  let cumDG = logger.accumulatedDG;
  const newPoints: { time: Date; temp: number; dg: number }[] = [];

  for (let i = 0; i < history.length; i++) {
    const h = history[i];
    if (h.time <= from) continue; // hopp over allerede loggede punkter
    const dgHour = Math.max(0, h.temp - logger.baseTemp);
    cumDG += dgHour / 24;
    newPoints.push({ time: h.time, temp: h.temp, dg: cumDG });
  }

  return {
    ...logger,
    realHistory: [...logger.realHistory, ...newPoints],
    accumulatedDG: cumDG,
    lastFetched: now,
  };
}

export default function ImprovedMorningTab() {
  const [loggers, setLoggers] = useState<Logger[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <section>
      <h2 style={{ fontSize: 24, marginBottom: 16, color: "#333" }}>
        🥩 Forbedret Mørning
      </h2>

      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            background: "#e0eaff",
            border: "1px solid #b2d8b2",
            fontSize: 16,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ➕ Legg til ny mørningslogg
        </button>
      </div>

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              setLoggers((l) => [
                ...l,
                {
                  id: Date.now() + Math.random() + "",
                  name: newName.trim(),
                  lat: 60.7249,
                  lng: 9.0365,
                  target: 40,
                  offset: 0,
                  baseTemp: 0,
                  realHistory: [],
                  accumulatedDG: 0,
                  isRunning: false,
                },
              ]);
              setNewName("");
              setShowAdd(false);
            }
          }}
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Navn på mørningslogg"
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #bbb",
              fontSize: 16,
              width: 200,
            }}
            required
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#e0ffe0",
              border: "1px solid #b2d8b2",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ✅ Opprett
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setNewName("");
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#ffe0e0",
              border: "1px solid #d8b2b2",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ❌ Avbryt
          </button>
        </form>
      )}

      {loggers.length === 0 && (
        <div
          style={{
            color: "#888",
            marginBottom: 12,
            textAlign: "center",
            padding: 40,
            background: "#f9f9f9",
            borderRadius: 8,
            border: "1px dashed #ccc",
          }}
        >
          📝 Ingen mørningslogger opprettet ennå.
        </div>
      )}

      {loggers.map((logger) => (
        <LoggerCard key={logger.id} logger={logger} setLoggers={setLoggers} />
      ))}
    </section>
  );
}

function LoggerCard({
  logger,
  setLoggers,
}: {
  logger: Logger;
  setLoggers: React.Dispatch<React.SetStateAction<Logger[]>>;
}) {
  const [estimate, setEstimate] = useState<{ time: string; dg: number }[]>([]);

  // Hent estimat
  useEffect(() => {
    async function runEstimate() {
      try {
        const forecast = await fetchForecast(logger.lat, logger.lng);
        const dgPoints = calculateDG(forecast, logger.offset, 3, logger.target);
        setEstimate(dgPoints);
      } catch (err) {
        console.error("Feil ved henting av forecast:", err);
      }
    }
    runEstimate();
  }, [logger.lat, logger.lng, logger.offset, logger.target]);

  // Oppdater reell logg hvis loggeren kjører
  useEffect(() => {
    if (!logger.isRunning) return;

    async function updateRealLog() {
      try {
        const updated = await refreshRealLog(logger);
        setLoggers(loggers => loggers.map(l => l.id === logger.id ? updated : l));
      } catch (err) {
        console.error("Feil ved oppdatering av reell logg:", err);
      }
    }

    updateRealLog();
    const interval = setInterval(updateRealLog, 60000); // Oppdater hvert minutt
    return () => clearInterval(interval);
  }, [logger.isRunning, logger.id]);

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        background: "#fafcff",
        position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, color: "#333" }}>
        {logger.name}
      </h3>

      {/* Controls */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={() => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { 
            ...x, 
            isRunning: !x.isRunning,
            startTime: !x.isRunning ? new Date() : x.startTime
          } : x))} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 8, 
            background: logger.isRunning ? '#ffe0e0' : '#e0ffe0', 
            border: '1px solid #b2d8b2', 
            fontSize: 16, 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {logger.isRunning ? '⏸️ Pause' : '▶️ Start'}
        </button>

        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Target DG:
          <input 
            type="number" 
            value={logger.target} 
            min={1} 
            max={100} 
            onChange={e => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, target: Number(e.target.value) } : x))} 
            style={{ 
              marginLeft: 6, 
              width: 60, 
              padding: 4, 
              borderRadius: 6, 
              border: '1px solid #ccc',
              textAlign: 'center'
            }} 
          />
        </label>
        
        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Temp-offset:
          <input
            type="number"
            value={logger.offset}
            min={-10}
            max={10}
            step={0.5}
            onChange={e => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, offset: Number(e.target.value) } : x))}
            style={{ 
              marginLeft: 6, 
              width: 60, 
              padding: 4, 
              borderRadius: 6, 
              border: '1px solid #ccc', 
              textAlign: 'center' 
            }}
          />
        </label>
      </div>

      {/* Plot */}
      <div
        style={{
          marginBottom: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          background: "#f8f9fa",
          minHeight: 200,
        }}
      >
        {estimate.length === 0 ? (
          <div style={{ color: "#888", fontSize: 16 }}>⏳ Laster estimat...</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={[
              ...estimate.map(e => ({ time: e.time, Estimat: e.dg, Reell: null })),
              ...logger.realHistory.map(r => ({ 
                time: r.time.toLocaleString("no-NO", { weekday: "short", hour: "2-digit", minute: "2-digit" }), 
                Estimat: null, 
                Reell: r.dg 
              }))
            ]}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tick={{ fontSize: 12 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="Estimat"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="Reell"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={false}
              />
              <ReferenceLine
                y={logger.target}
                stroke="red"
                strokeDasharray="3 3"
                label="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() =>
          setLoggers((loggers) =>
            loggers.filter((x: Logger) => x.id !== logger.id)
          )
        }
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "#ffe0e0",
          border: "1px solid #d8b2b2",
          borderRadius: 8,
          padding: "4px 12px",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Slett
      </button>
    </div>
  );
}
