"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { ELGPOSTER } from "./elgposter";
import { ELGJEGERE } from "./elgjegere";
import type { Elgpost } from "./types";

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

function DgLogger({ name, lat, lng, onDelete }: { name: string; lat: number; lng: number; onDelete?: () => void }) {
  const [running, setRunning] = useState(false);
  const [accelerated, setAccelerated] = useState(false);
  const [dgSum, setDgSum] = useState(0);
  const [dgHistory, setDgHistory] = useState<{ t: number; sum: number; temp: number }[]>([]); // t: simulert minutt
  const [showReset, setShowReset] = useState(false);
  const [currentTemp, setCurrentTemp] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [simTime, setSimTime] = useState(0); // i minutter
  const [target, setTarget] = useState(40);
  const [offset, setOffset] = useState(0);
  const [showDelete, setShowDelete] = useState(false);

  // Hent temperatur for gitt tidspunkt fra API
  async function fetchTempForTime(dt: Date) {
    const iso = dt.toISOString().slice(0, 13) + ':00'; // timeoppløsning
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m&timezone=auto&start_date=${iso.slice(0,10)}&end_date=${iso.slice(0,10)}`;
    const res = await fetch(url);
    const data = await res.json();
    // Finn nærmeste time
    const idx = data.hourly?.time?.findIndex((t: string) => t.startsWith(iso));
    return idx !== -1 ? data.hourly.temperature_2m[idx] : null;
  }

  useEffect(() => {
    if (!running) return;
    timerRef.current = setInterval(async () => {
      setSimTime((prev) => prev + (accelerated ? 60 : 15)); // 1 time eller 15 min
      const now = new Date();
      now.setMinutes(now.getMinutes() + (simTime + (accelerated ? 60 : 15)));
      let temp = null;
      if (accelerated) {
        temp = await fetchTempForTime(now);
      } else {
        temp = await fetchTempForTime(now);
      }
      if (temp === null) temp = 10;
      temp = temp + offset;
      setCurrentTemp(temp);
      setDgHistory((prev) => {
        const t = prev.length > 0 ? prev[prev.length - 1].t + (accelerated ? 60 : 15) : 0;
        const dg = temp / (accelerated ? 24 : 96);
        const sum = (prev.length > 0 ? prev[prev.length - 1].sum : 0) + dg;
        setDgSum(sum);
        return [...prev, { t, sum, temp }];
      });
    }, accelerated ? 1000 : 4000); // 1 sek = 1 time, 4 sek = 15 min
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [running, accelerated, simTime, lat, lng, offset]);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  function handleReset() {
    setShowReset(false);
    setRunning(false);
    setDgSum(0);
    setDgHistory([]);
    setSimTime(0);
    setCurrentTemp(null);
  }

  function DgGraph({ data, target = 40 }: { data: { t: number; sum: number; temp: number }[]; target?: number }) {
    if (data.length === 0) return <div>Ingen data ennå.</div>;
    const width = 400, height = 180, pad = 32;
    const maxX = Math.max(...data.map(d => d.t), 96 * 15); // minst ett døgn
    const maxY = Math.max(...data.map(d => d.sum), target);
    const points = data.map(d => {
      const x = pad + (d.t / maxX) * (width - 2 * pad);
      const y = height - pad - (d.sum / maxY) * (height - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    const targetY = height - pad - (target / maxY) * (height - 2 * pad);
    return (
      <svg width={width} height={height} style={{ background: '#f8f8ff', borderRadius: 12, border: '1px solid #ddd', marginBottom: 12 }}>
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#888" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#888" strokeWidth={1} />
        <line x1={pad} y1={targetY} x2={width - pad} y2={targetY} stroke="#e55" strokeDasharray="4 4" />
        <polyline fill="none" stroke="#2a7" strokeWidth={2.5} points={points} />
        <text x={pad - 8} y={height - pad + 16} fontSize={13} textAnchor="end">0</text>
        <text x={pad - 8} y={targetY - 2} fontSize={13} textAnchor="end">{target}</text>
        <text x={pad - 8} y={pad + 6} fontSize={13} textAnchor="end">{maxY.toFixed(1)}</text>
        <text x={pad} y={height - pad + 24} fontSize={13} textAnchor="middle">0</text>
        <text x={width - pad} y={height - pad + 24} fontSize={13} textAnchor="middle">{maxX} min</text>
      </svg>
    );
  }

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 18, marginBottom: 24, background: '#fafcff', position: 'relative' }}>
      {onDelete && (
        <button onClick={() => setShowDelete(true)} style={{ position: 'absolute', top: 10, right: 10, background: '#ffe0e0', border: '1px solid #d8b2b2', borderRadius: 8, padding: '4px 12px', fontSize: 15, cursor: 'pointer' }}>Slett</button>
      )}
      {showDelete && (
        <div style={{ position: 'absolute', top: 38, right: 10, background: '#fffbe0', border: '1px solid #eed', borderRadius: 8, padding: 12, zIndex: 10 }}>
          <div style={{ marginBottom: 8 }}>Vil du slette?</div>
          <button onClick={() => { setShowDelete(false); onDelete && onDelete(); }} style={{ marginRight: 8, padding: '4px 12px', borderRadius: 8, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 14, cursor: 'pointer' }}>Ja</button>
          <button onClick={() => setShowDelete(false)} style={{ padding: '4px 12px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 14, cursor: 'pointer' }}>Nei</button>
        </div>
      )}
      <h3 style={{ margin: 0, marginBottom: 8 }}>{name}</h3>
      <div style={{ marginBottom: 8, display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 15 }}>
          <input type="checkbox" checked={accelerated} onChange={e => setAccelerated(e.target.checked)} style={{ marginRight: 6 }} />
          Akselerert tid (simulering)
        </label>
        <label style={{ fontSize: 15 }}>
          Target døgngrader:
          <input type="number" value={target} min={1} max={100} onChange={e => setTarget(Number(e.target.value))} style={{ marginLeft: 6, width: 60, padding: 3, borderRadius: 6, border: '1px solid #ccc' }} />
        </label>
        <label style={{ fontSize: 15 }}>
          Temp-offset:
          <input type="number" value={offset} min={-10} max={10} step={1} onChange={e => setOffset(Number(e.target.value))} style={{ marginLeft: 6, width: 60, padding: 3, borderRadius: 6, border: '1px solid #ccc' }} />
        </label>
      </div>
      <div style={{ marginBottom: 8 }}>
        <button onClick={() => setRunning(v => !v)} style={{ padding: '8px 18px', borderRadius: 8, background: running ? '#ffe0e0' : '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginRight: 12 }}>{running ? 'Pause' : 'Start'}</button>
        <button onClick={() => setShowReset(true)} style={{ padding: '8px 18px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 16, cursor: 'pointer' }}>Nullstill</button>
      </div>
      {showReset && (
        <div style={{ background: '#fffbe0', border: '1px solid #eed', borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <div style={{ marginBottom: 8 }}>Er du sikker på at du vil nullstille måleren?</div>
          <button onClick={handleReset} style={{ marginRight: 12, padding: '6px 16px', borderRadius: 8, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 15, cursor: 'pointer' }}>Ja, nullstill</button>
          <button onClick={() => setShowReset(false)} style={{ padding: '6px 16px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Nei</button>
        </div>
      )}
      <div style={{ marginBottom: 12 }}>Akkumulert døgngrad: <b>{dgSum.toFixed(2)}</b></div>
      {dgHistory.length > 0 && (
        <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
          Timer: {(() => {
            const last = dgHistory[dgHistory.length - 1];
            const totalMin = last.t;
            const days = Math.floor(totalMin / 1440);
            const hours = Math.floor((totalMin % 1440) / 60);
            const mins = totalMin % 60;
            return `${days}:${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
          })()}
        </div>
      )}
      <DgGraph data={dgHistory} target={target} />
      {dgHistory.length > 0 && (
        <>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
            Sist hentet: {(() => {
              const last = dgHistory[dgHistory.length - 1];
              const now = new Date();
              now.setMinutes(now.getMinutes() + last.t);
              return now.toLocaleString([], { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: '2-digit' });
            })()}
          </div>
        </>
      )}
      <div style={{ fontSize: 13, color: '#888' }}>Temperatur: {currentTemp !== null ? `${currentTemp.toFixed(1)}°C` : 'ukjent'} (offset: {offset >= 0 ? '+' : ''}{offset})</div>
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
  const [selectedJegere, setSelectedJegere] = useState(() => ELGJEGERE.map(() => true));
  const [autoResult, setAutoResult] = useState<{ post: Post; jeger: Jeger }[]>([]);

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

  function handleToggleJeger(idx: number) {
    setSelectedJegere(sel => sel.map((v, i) => i === idx ? !v : v));
  }
  function handleTrekkAuto() {
    const valgteJegere = ELGJEGERE.filter((_, i) => selectedJegere[i]);
    const ledigePoster = [...posts];
    const trekk: { post: Post; jeger: Jeger }[] = [];
    valgteJegere.forEach(jeger => {
      if (ledigePoster.length === 0) return;
      const idx = Math.floor(Math.random() * ledigePoster.length);
      const post = ledigePoster.splice(idx, 1)[0];
      trekk.push({ post, jeger });
    });
    setAutoResult(trekk);
  }

  const available = remaining.filter(i => selected[i]);
  const numSelected = selected.filter(Boolean).length;
  const jegereUtenPost = ELGJEGERE.filter(j => !drawn.some(d => d.jeger === j.navn));

  return (
    <section style={{ display: 'flex', alignItems: 'flex-start', gap: 32 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>Trekk din post!</h2>
        <div style={{ marginBottom: 12 }}>
          <button onClick={handleReset} style={{ padding: '6px 16px', borderRadius: 8, background: '#eee', border: '1px solid #bbb', fontSize: 15, cursor: 'pointer', marginBottom: 8 }}>Nullstill</button>
        </div>
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => setExpanderOpen(v => !v)} style={{ padding: '7px 16px', borderRadius: 8, background: '#f4f8ff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginBottom: 8 }}>
            Velg poster ({numSelected} valgt{numSelected === 1 ? '' : 'e'}) {expanderOpen ? '▲' : '▼'}
          </button>
          {expanderOpen && (
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
          )}
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>Hvem er du?</div>
          <select value={selectedJeger} onChange={e => setSelectedJeger(e.target.value)} style={{ padding: '7px 16px', borderRadius: 8, border: '1px solid #bbb', fontSize: 16, marginBottom: 8, minWidth: 160 }}>
            <option value="">Velg navn</option>
            {jegereUtenPost.map(j => (
              <option key={j.navn} value={j.navn}>{j.navn} ({j.callsign})</option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: 18 }}>
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
        {available.length === 0 && (
          <div style={{ color: '#888', marginTop: 10 }}>Ingen poster igjen å trekke.</div>
        )}
        {/* Flytt autotrekk-knapp og panel hit */}
        <div style={{ marginTop: 24 }}>
          <button onClick={() => setShowAuto(v => !v)} style={{ alignSelf: 'flex-start', padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginTop: 8 }}>Autotrekk</button>
          {showAuto && (
            <div style={{ background: '#f8faff', border: '1px solid #dde', borderRadius: 10, padding: 16, marginTop: 8, marginBottom: 8, maxWidth: 500 }}>
              <b>Velg jegere:</b>
              <ul style={{ listStyle: 'none', padding: 0, columns: 2, maxWidth: 400 }}>
                {ELGJEGERE.map((j, idx) => (
                  <li key={j.navn} style={{ marginBottom: 4 }}>
                    <label style={{ cursor: 'pointer', fontSize: 16 }}>
                      <input type="checkbox" checked={selectedJegere[idx]} onChange={() => handleToggleJeger(idx)} style={{ marginRight: 7 }} />
                      {j.navn} ({j.callsign})
                    </label>
                  </li>
                ))}
              </ul>
              <b>Velg poster:</b>
              <ul style={{ listStyle: 'none', padding: 0, columns: 2, maxWidth: 400 }}>
                {posts.map((p, idx) => (
                  <li key={p.name} style={{ marginBottom: 4 }}>
                    <label style={{ cursor: 'pointer', fontSize: 16 }}>
                      <input type="checkbox" checked={selected[idx]} onChange={() => handleToggle(idx)} style={{ marginRight: 7 }} />
                      {p.name}
                    </label>
                  </li>
                ))}
              </ul>
              <button
                onClick={handleTrekkAuto}
                disabled={ELGJEGERE.filter((_, i) => selectedJegere[i]).length !== posts.filter((_, i) => selected[i]).length}
                style={{ padding: '8px 18px', borderRadius: 8, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer', marginTop: 8 }}>
                Trekk auto
              </button>
              {ELGJEGERE.filter((_, i) => selectedJegere[i]).length !== posts.filter((_, i) => selected[i]).length && (
                <div style={{ color: '#c33', marginTop: 6 }}>Du må velge like mange jegere og poster!</div>
              )}
              {autoResult.length > 0 && (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 19, marginTop: 10 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: 4 }}>Post</th>
                      <th style={{ textAlign: 'left', padding: 4 }}>Callsign</th>
                    </tr>
                  </thead>
                  <tbody>
                    {autoResult.map((r, i) => (
                      <tr key={i}>
                        <td style={{ padding: 4, fontWeight: 700 }}>{r.post.name}</td>
                        <td style={{ padding: 4, color: '#4a90e2', fontWeight: 600 }}>{r.jeger.callsign}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
      <div style={{ minWidth: 220, maxWidth: 340, background: '#f8faff', border: '1px solid #dde', borderRadius: 10, padding: 16, boxShadow: '0 2px 8px #0001' }}>
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
  const [selectedPosts, setSelectedPosts] = useState(() => ELGPOSTER.map(() => false));
  const [expanderOpen, setExpanderOpen] = useState(false);
  const [timeOption, setTimeOption] = useState('6timer');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [weatherData, setWeatherData] = useState<WeatherData[]>([]); // [{post, hourly:[], daily:[]}, ...]
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState('alfabetisk');

  // Sorter ELGPOSTER alfabetisk for visning
  const sortedIdx = ELGPOSTER
    .map((p, i) => ({ name: p.name, idx: i }))
    .sort((a, b) => sortBy === 'alfabetisk' ? a.name.localeCompare(b.name) : a.idx - b.idx)
    .map(x => x.idx);

  function handleToggle(idx: number) {
    setSelectedPosts(sel => sel.map((v, i) => i === idx ? !v : v));
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
        <button onClick={fetchWeatherForPosts} disabled={selectedPosts.every(v=>!v) || loading || (timeOption==='custom' && (!customFrom || !customTo))} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Hent værmelding</button>
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
                  <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}</td>
                  <td style={{ padding: 4 }}>{h.temp}°C</td>
                  <td style={{ padding: 4 }}>{h.precipitation}</td>
                  <td style={{ padding: 4 }}><WindArrow deg={h.weatherCode} /> {h.weatherCode}° ({windDirectionText(h.weatherCode)})</td>
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
            <th style={{ textAlign: 'left', padding: 4 }}>Avstand fra hytta (m)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sortedPosts.map((post, idx) => (
            <tr key={post.nr+post.name+post.lat+post.lng}>
              <td style={{ padding: 4 }}>{post.nr}</td>
              <td style={{ padding: 4 }}>{post.name}</td>
              <td style={{ padding: 4 }}>{post.omrade}</td>
              <td style={{ padding: 4 }}>{ELGHYTTA ? Math.round(distFromHytta(post)) : '–'}</td>
              <td style={{ padding: 4 }}><button onClick={()=>handleDelete(posts.indexOf(post))} style={{ padding: '3px 10px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 14, cursor: 'pointer' }}>Slett</button></td>
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
    const ny = posts.map((p, idx) => ({ postIdx: idx, jeger: edit[idx] ?? (fordeling.find(f => f.postIdx === idx)?.jeger || "") }));
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ny),
    });
    setFordeling(ny);
    setEdit({});
    setSaving(false);
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Dagens poster</h2>
      {loading ? <div>Laster...</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 18 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: 4 }}>Post</th>
              <th style={{ textAlign: 'left', padding: 4 }}>Jeger</th>
              <th style={{ textAlign: 'left', padding: 4 }}>Callsign</th>
            </tr>
          </thead>
          <tbody>
            {posts.map((post, idx) => {
              const valgt = edit[idx] ?? (fordeling.find(f => f.postIdx === idx)?.jeger || "");
              const jegerObj = jegere.find(j => j.navn === valgt);
              return (
                <tr key={post.nr+post.name}>
                  <td style={{ padding: 4, fontWeight: 700 }}>{post.name}</td>
                  <td style={{ padding: 4 }}>
                    <select value={valgt} onChange={e => setEdit(ed => ({ ...ed, [idx]: e.target.value }))} style={{ fontSize: 16, padding: 4, borderRadius: 6 }}>
                      <option value="">Velg jeger</option>
                      {jegere.map(j => <option key={j.navn} value={j.navn}>{j.navn}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 4, color: '#4a90e2', fontWeight: 600 }}>{jegerObj?.callsign || ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <button onClick={save} disabled={saving} style={{ marginTop: 16, padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Lagre dagens poster</button>
      <div style={{ marginTop: 18, color: '#888', fontSize: 15 }}>Alle på jaktlaget ser denne listen.</div>
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
  const [loggers, setLoggers] = useState<{ id: string; name: string; lat: number; lng: number }[]>([]);
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

  // Delt elgpost-liste for hele appen
  const [elgposter, setElgposter] = useState(() => [...ELGPOSTER]);
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

  // SVG-graf for døgngrad
  function DgGraph({ data, target = 40 }: { data: { t: number; sum: number }[]; target?: number }) {
    if (data.length === 0) return <div>Ingen data ennå.</div>;
    const width = 400, height = 180, pad = 32;
    const maxX = Math.max(...data.map(d => d.t), 96 * 15); // minst ett døgn
    const maxY = Math.max(...data.map(d => d.sum), target);
    const points = data.map(d => {
      const x = pad + (d.t / maxX) * (width - 2 * pad);
      const y = height - pad - (d.sum / maxY) * (height - 2 * pad);
      return `${x},${y}`;
    }).join(' ');
    // Target-linje
    const targetY = height - pad - (target / maxY) * (height - 2 * pad);
    return (
      <svg width={width} height={height} style={{ background: '#f8f8ff', borderRadius: 12, border: '1px solid #ddd', marginBottom: 12 }}>
        {/* Akser */}
        <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="#888" strokeWidth={1} />
        <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="#888" strokeWidth={1} />
        {/* Target-linje */}
        <line x1={pad} y1={targetY} x2={width - pad} y2={targetY} stroke="#e55" strokeDasharray="4 4" />
        {/* Graf-linje */}
        <polyline fill="none" stroke="#2a7" strokeWidth={2.5} points={points} />
        {/* Y-akse labels */}
        <text x={pad - 8} y={height - pad + 16} fontSize={13} textAnchor="end">0</text>
        <text x={pad - 8} y={targetY - 2} fontSize={13} textAnchor="end">{target}</text>
        <text x={pad - 8} y={pad + 6} fontSize={13} textAnchor="end">{maxY.toFixed(1)}</text>
        {/* X-akse labels */}
        <text x={pad} y={height - pad + 24} fontSize={13} textAnchor="middle">0</text>
        <text x={width - pad} y={height - pad + 24} fontSize={13} textAnchor="middle">{maxX} min</text>
      </svg>
    );
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

  return (
    <div style={{ width: "100%", maxWidth: 600, margin: "0 auto", padding: 24 }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Sanbekken IT & Drift</h1>
      </header>
      <Tabs tabs={["Vær", "Postvær", "Trekk din post!", "Dagens poster", "Mørning", "Elgposter", "Kart"]} current={activeTab} onChange={setActiveTab} />
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
                    <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ padding: 4 }}>{h.temp}°C</td>
                    <td style={{ padding: 4 }}>{h.windSpeed}</td>
                    <td style={{ padding: 4 }}>
                      <WindArrow deg={h.windDir} />
                      {h.windDir}° ({windDirectionText(h.windDir)})
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
                          {day.windDir}° ({windDirectionText(day.windDir)})
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
      {activeTab === "Mørning" && (
        <section>
          <h2 style={{ fontSize: 20, marginBottom: 8 }}>Mørning</h2>
          <div style={{ marginBottom: 18 }}>
            <button onClick={() => setShowAdd(v => !v)} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Legg til ny logg</button>
          </div>
          {showAdd && (
            <form onSubmit={e => { e.preventDefault(); if (newName.trim()) { setLoggers(l => [...l, { id: Date.now() + Math.random() + '', name: newName.trim(), lat: 60.7249, lng: 9.0365 }]); setNewName(''); setShowAdd(false); } }} style={{ marginBottom: 18, display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Navn på logg" style={{ padding: 7, borderRadius: 7, border: '1px solid #bbb', fontSize: 16, width: 180 }} required />
              <button type="submit" style={{ padding: '7px 16px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Opprett</button>
              <button type="button" onClick={() => { setShowAdd(false); setNewName(''); }} style={{ padding: '7px 16px', borderRadius: 7, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 15, cursor: 'pointer' }}>Avbryt</button>
            </form>
          )}
          {loggers.length === 0 && <div style={{ color: '#888', marginBottom: 12 }}>Ingen logger opprettet ennå.</div>}
          {loggers.map(l => (
            <DgLogger key={l.id} name={l.name} lat={l.lat} lng={l.lng} onDelete={() => setLoggers(loggers => loggers.filter(x => x.id !== l.id))} />
          ))}
        </section>
      )}
      {activeTab === "Elgposter" && (
        <ElgposterTab posts={posts} setPosts={setPosts} />
      )}
      {activeTab === "Kart" && (
        <div style={{ margin: '0 auto', maxWidth: 900 }}>
          <MapSection
            position={DEFAULT_POSITION}
            posts={elgposter}
            setPosts={setElgposter}
          />
        </div>
      )}
    </div>
  );
}
