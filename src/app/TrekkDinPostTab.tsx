import React, { useEffect, useRef, useState } from "react";
import { ELGPOSTER } from "./elgposter";
import { ELGJEGERE } from "./elgjegere";
import PostVelger from "./PostVelger";

function SpinneIkon({ spinning }: { spinning: boolean }) {
  return (
    <svg className="trekk-spin-ikon" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 1.4 19.4 7h-6.8Z" fill="currentColor" />
      <g className={spinning ? "trekk-spin-rotor is-spinning" : "trekk-spin-rotor"} fill="currentColor">
        <path d="M16 18 16 8 A10 10 0 0 1 26 18 Z" />
        <path d="M16 18 26 18 A10 10 0 0 1 16 28 Z" opacity="0.45" />
        <path d="M16 18 16 28 A10 10 0 0 1 6 18 Z" />
        <path d="M16 18 6 18 A10 10 0 0 1 16 8 Z" opacity="0.45" />
        <circle cx="16" cy="18" r="3.1" />
      </g>
    </svg>
  );
}

function JegerIkon({ callsign }: { callsign: string }) {
  const svg = { viewBox: "0 0 32 32", "aria-hidden": true as const };
  let icon: React.ReactNode = null;
  if (callsign === "Ali") {
    icon = (
      <svg {...svg} fill="currentColor">
        <path d="M15.1 1.2h1.8v29.6h-1.8z" />
        <ellipse cx="16" cy="7.2" rx="5.2" ry="2.5" />
        <ellipse cx="16" cy="13.4" rx="5.6" ry="2.7" />
        <ellipse cx="16" cy="19.8" rx="5.1" ry="2.5" />
        <ellipse cx="16" cy="26.2" rx="4.4" ry="2.3" />
      </svg>
    );
  } else if (callsign === "Rambo") {
    icon = (
      <svg {...svg} fill="currentColor">
        <path d="M1.4 13.2h7.2v3.4H3.4L1.4 21.2V13.2z" />
        <rect x="7.6" y="11.4" width="9.4" height="5.4" rx="0.6" />
        <rect x="16.2" y="12.4" width="12.2" height="2.3" rx="0.4" />
        <rect x="28.2" y="10.4" width="1.6" height="4.4" rx="0.3" />
        <path d="M10.4 16.8h3.4l-.6 8.2h-2.2l-.6-8.2z" />
        <rect x="14.8" y="16.8" width="3.6" height="7.2" rx="0.4" />
      </svg>
    );
  } else if (callsign === "Edmund") {
    icon = (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <path d="M6 27.2 14.2 19" />
        <path d="M26 27.2 17.8 19" />
        <path d="M16 4.2c1.8 3.4 5.6 5 5.6 9.6a5.6 5.6 0 0 1-11.2 0c0-3.4 2-5.4 3.2-7.2.2 2.2 1.6 3.6 3 3.6C15.4 7.6 16 4.2 16 4.2z" fill="currentColor" stroke="none" />
      </svg>
    );
  } else if (callsign === "2 Alfa") {
    icon = (
      <svg {...svg} fill="currentColor">
        <path d="M13.2 13.2 8.2 3.2 6.2 7.4 3.2 4.6 5.4 11 2.2 10.2 7.4 15.2l2.6-1.2z" />
        <path d="M18.8 13.2 23.8 3.2 25.8 7.4 28.8 4.6 26.6 11 29.8 10.2 24.6 15.2l-2.6-1.2z" />
        <ellipse cx="16" cy="17.6" rx="5.4" ry="5.6" />
        <ellipse cx="16" cy="24.6" rx="3.1" ry="3.4" />
      </svg>
    );
  } else if (callsign === "Navy") {
    icon = (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="16" cy="5.6" r="2.3" fill="currentColor" stroke="none" />
        <path d="M16 8v18" />
        <path d="M9.5 13.5h13" />
        <path d="M16 26c0 0-8.2-.2-9.4-6.4" />
        <path d="M16 26c0 0 8.2-.2 9.4-6.4" />
      </svg>
    );
  } else if (callsign === "Gjest1") {
    icon = (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M12.2 5.2h7.6V9h-7.6z" />
        <rect x="10.4" y="9" width="11.2" height="17.2" rx="3.2" />
        <path d="M10.6 15.4h10.8" />
      </svg>
    );
  } else if (callsign === "Gjest2") {
    icon = (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M12 8.2V6.4a4 4 0 0 1 8 0v1.8" />
        <rect x="8.6" y="8.2" width="14.8" height="17.2" rx="3" />
        <path d="M8.6 16.2H5.4v6.2h3.2" />
        <path d="M23.4 16.2h3.2v6.2h-3.2" />
        <path d="M8.8 15.2h14.4" />
      </svg>
    );
  } else if (callsign === "Skytter") {
    icon = (
      <svg {...svg} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="16" cy="16" r="7.2" />
        <path d="M16 2.8v6.2M16 23v6.2M2.8 16h6.2M23 16h6.2" />
      </svg>
    );
  }
  if (!icon) return null;
  return <span className="trekk-ikon">{icon}</span>;
}

function pointOnWheel(cx: number, cy: number, r: number, degFromTop: number) {
  const rad = (degFromTop * Math.PI) / 180;
  return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
}

function wedgePath(cx: number, cy: number, r: number, start: number, end: number) {
  const [x1, y1] = pointOnWheel(cx, cy, r, start);
  const [x2, y2] = pointOnWheel(cx, cy, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

function Lykkehjul({
  posts,
  rotation,
  instant,
  onSpinEnd,
}: {
  posts: { idx: number; name: string; drawn: boolean }[];
  rotation: number;
  instant: boolean;
  onSpinEnd: () => void;
}) {
  const n = posts.length;
  const cx = 100;
  const cy = 100;
  const r = 96;
  const slice = 360 / n;
  const labelSize = n <= 6 ? 7.2 : n <= 10 ? 5.6 : 4.4;

  function sliceFill(i: number, drawn: boolean) {
    if (drawn) return i % 2 === 0 ? "#8d8d8d" : "#d2d2d2";
    return i % 2 === 0 ? "#0e8a38" : "#f0b400";
  }

  return (
    <div className="trekk-wheel-stage">
      <div className="trekk-pointer" aria-hidden="true" />
      <div
        className={`trekk-rotor${instant ? " is-instant" : ""}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        onTransitionEnd={(e) => {
          if (e.propertyName !== "transform") return;
          onSpinEnd();
        }}
      >
        <svg viewBox="0 0 200 200" width="100%" height="100%" role="img" aria-label={`Lykkehjul med ${n} ${n === 1 ? "post" : "poster"}`}>
          {n === 1 ? (
            <circle cx={cx} cy={cy} r={r} fill={posts[0].drawn ? "#8d8d8d" : "#0e8a38"} />
          ) : (
            posts.map((p, i) => (
              <path
                key={p.idx}
                d={wedgePath(cx, cy, r, i * slice, (i + 1) * slice)}
                fill={sliceFill(i, p.drawn)}
                stroke="#fff"
                strokeWidth="2"
              />
            ))
          )}
          {posts.map((p, i) => {
            const mid = (i + 0.5) * slice;
            const [tx, ty] = pointOnWheel(cx, cy, n === 1 ? 62 : 68, mid);
            const fill = p.drawn ? "#1f1f1f" : (i % 2 === 0 ? "#ffffff" : "#1a1a1a");
            const maxChars = n <= 4 ? 16 : n <= 8 ? 11 : n <= 12 ? 8 : 6;
            const label = p.name.length > maxChars ? `${p.name.slice(0, maxChars - 1)}…` : p.name;
            return (
              <text
                key={`t-${p.idx}`}
                x={tx}
                y={ty}
                fill={fill}
                fontSize={labelSize}
                fontWeight="700"
                fontFamily="Arial, Helvetica, sans-serif"
                textAnchor="middle"
                dominantBaseline="middle"
                textDecoration={p.drawn ? "line-through" : undefined}
                transform={`rotate(${mid} ${tx} ${ty})`}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>
      <div className="trekk-hub" aria-hidden="true">
        <strong>{n}</strong>
        <span>{n === 1 ? "post" : "poster"}</span>
      </div>
    </div>
  );
}

export default function PostTrekkTab() {
  const [selected, setSelected] = useState(() => ELGPOSTER.map(() => false));
  const [remaining, setRemaining] = useState(() => ELGPOSTER.map((_, i) => i));
  const [spinning, setSpinning] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [instant, setInstant] = useState(true);
  const [drawn, setDrawn] = useState<{ postIdx: number; jeger: string }[]>([]);
  const pendingWinner = useRef<number | null>(null);
  const pendingJeger = useRef("");
  const spinLive = useRef(false);
  const spinFrame = useRef<number | null>(null);
  const spinTimer = useRef<number | null>(null);
  const [selectedJeger, setSelectedJeger] = useState('');
  const [showAuto, setShowAuto] = useState(false);
  const [autoJegere, setAutoJegere] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  function handlePosterConfirm(ids: number[]) {
    if (spinning) return;
    setInstant(true);
    setRotation(0);
    setShowResult(false);
    setSelected(prev => prev.map((v, i) => (remaining.includes(i) ? ids.includes(i) : v)));
    requestAnimationFrame(() => {
      const el = document.querySelector(".trekk-wheel-block");
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 110;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
  }

  function handleSpin() {
    if (!selectedJeger) return;
    if (drawn.some(d => d.jeger === selectedJeger)) return;
    const wheel = selected.map((on, idx) => on ? idx : -1).filter(idx => idx >= 0);
    const open = wheel.filter(idx => remaining.includes(idx));
    if (open.length === 0 || wheel.length === 0 || spinning) return;
    const winner = open[Math.floor(Math.random() * open.length)];
    const winnerPos = wheel.indexOf(winner);
    const slice = 360 / wheel.length;
    const center = (winnerPos + 0.5) * slice;
    const align = (360 - center) % 360;
    const spins = 5 + Math.floor(Math.random() * 2);
    const spinTo = (from: number) => {
      const min = from + spins * 360;
      const mod = ((min % 360) + 360) % 360;
      const delta = (align - mod + 360) % 360;
      return min + delta;
    };
    pendingWinner.current = winner;
    pendingJeger.current = selectedJeger;
    setShowResult(false);
    setWinnerIdx(null);
    setSpinning(true);
    if (spinFrame.current) cancelAnimationFrame(spinFrame.current);
    spinLive.current = false;
    const start = () => {
      spinLive.current = true;
      setRotation(prev => spinTo(prev));
      if (spinTimer.current) window.clearTimeout(spinTimer.current);
      spinTimer.current = window.setTimeout(() => handleSpinEnd(), 4700);
    };
    if (instant) {
      spinFrame.current = requestAnimationFrame(() => {
        setInstant(false);
        spinFrame.current = requestAnimationFrame(start);
      });
    } else {
      start();
    }
  }

  function handleSpinEnd() {
    if (!spinLive.current) return;
    spinLive.current = false;
    if (spinTimer.current) {
      window.clearTimeout(spinTimer.current);
      spinTimer.current = null;
    }
    const winner = pendingWinner.current;
    const jeger = pendingJeger.current;
    if (winner == null || !jeger) return;
    pendingWinner.current = null;
    pendingJeger.current = "";
    setSpinning(false);
    setWinnerIdx(winner);
    setShowResult(true);
    setRemaining(rem => rem.filter(i => i !== winner));
    setDrawn(d => [...d, { postIdx: winner, jeger }]);
    setSelectedJeger("");
  }

  function handleReset() {
    if (spinFrame.current) cancelAnimationFrame(spinFrame.current);
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
    pendingWinner.current = null;
    pendingJeger.current = "";
    spinLive.current = false;
    setSelected(ELGPOSTER.map(() => false));
    setRemaining(ELGPOSTER.map((_, i) => i));
    setWinnerIdx(null);
    setShowResult(false);
    setSpinning(false);
    setInstant(true);
    setRotation(0);
    setDrawn([]);
    setSelectedJeger('');
  }

  useEffect(() => () => {
    if (spinFrame.current) cancelAnimationFrame(spinFrame.current);
    if (spinTimer.current) window.clearTimeout(spinTimer.current);
  }, []);

  async function sendToDagensPoster() {
    setSending(true);
    setSendMsg(null);
    await fetch("/api/dagensposter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(drawn),
    });
    setSending(false);
    setSendMsg("Listen er lagret til Dagens poster!");
  }

  const available = remaining.filter(i => selected[i]);
  const trekkJegere = ELGJEGERE.filter(j => j.callsign !== "1 Alfa" && j.callsign !== "Fisker");
  const jegereUtenPost = trekkJegere.filter(j => !drawn.some(d => d.jeger === j.navn));

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
    setShowResult(false);
    setShowAuto(false);
    setAutoJegere([]);
  };

  const posterValg = ELGPOSTER.map((p, idx) => ({ ...p, idx }));
  const valgtePosterIds = posterValg.filter(p => selected[p.idx] && remaining.includes(p.idx)).map(p => p.idx);
  const trukneIds = posterValg.filter(p => !remaining.includes(p.idx)).map(p => p.idx);
  const spinDisabled = spinning || available.length === 0 || !selectedJeger || drawn.some(d => d.jeger === selectedJeger);
  const wheelPosts = posterValg
    .filter(p => selected[p.idx])
    .map(p => ({ idx: p.idx, name: p.name, drawn: !remaining.includes(p.idx) }));

  return (
    <section className="trekk-layout">
      <div className="trekk-main">
        <div className="trekk-tools">
          <button type="button" onClick={handleReset}>Reset</button>
          <button type="button" onClick={() => setShowAuto(v => !v)}>Auto</button>
        </div>
        <PostVelger
          posts={posterValg}
          selectedIds={valgtePosterIds}
          lockedIds={trukneIds}
          lockedLabel="Trukket"
          triggerLabel="Poster i trekket"
          onConfirm={handlePosterConfirm}
        />
        <div className="trekk-status">
          {available.length === 0
            ? (drawn.length > 0 ? "Ingen poster igjen å trekke." : "Velg poster som skal være med i trekket.")
            : `${available.length} ${available.length === 1 ? "post" : "poster"} igjen å trekke.`}
        </div>
        <div className="trekk-wheel-block">
          {wheelPosts.length > 0 ? (
            <Lykkehjul posts={wheelPosts} rotation={rotation} instant={instant} onSpinEnd={handleSpinEnd} />
          ) : (
            <p className="trekk-dock-empty">Velg poster som skal trekkes.</p>
          )}
          <div className="trekk-result" aria-live="polite">
            {showResult && winnerIdx !== null ? `Du har fått: ${ELGPOSTER[winnerIdx].name}` : spinning ? "Snurrer…" : ""}
          </div>
        </div>
        <div className="trekk-drawn">
          <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 10 }}>Trukne poster</div>
          {drawn.length === 0 ? (
            <div style={{ color: '#666' }}>Ingen poster trukket ennå.</div>
          ) : (
            <ol style={{ paddingLeft: 18, margin: 0 }}>
              {drawn.map((d, i) => {
                const post = ELGPOSTER[d.postIdx];
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
        {showAuto && (
          <div className="trekk-auto" style={{ marginTop: 24, background: '#f8faff', border: '2px solid #14301c', borderRadius: 14, padding: 16 }}>
            <div style={{ marginBottom: 8, fontWeight: 600, fontSize: 18 }}>Automatisk tildeling av poster</div>
            <div style={{ marginBottom: 8 }}>
              Velg {ELGPOSTER.map((_, idx) => selected[idx] && remaining.includes(idx) ? idx : null).filter(idx => idx !== null).length} jegere:
            </div>
            {jegereUtenPost.map(j => (
              <label key={j.navn}>
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
        <div style={{ marginTop: 16 }}>
          <button type="button" className="trekk-send" onClick={sendToDagensPoster} disabled={drawn.length === 0 || sending}>
            {sending ? 'Sender...' : 'Send liste til Dagens poster'}
          </button>
          {sendMsg && <div style={{ marginTop: 8, color: '#14301c', fontWeight: 600, background: 'rgba(255,255,255,0.88)', borderRadius: 10, padding: '8px 12px' }}>{sendMsg}</div>}
        </div>
        <div className="trekk-jegere">
          {jegereUtenPost.map(j => (
            <button
              key={j.navn}
              type="button"
              className={selectedJeger === j.navn ? "is-on" : ""}
              onClick={() => setSelectedJeger(selectedJeger === j.navn ? "" : j.navn)}
              disabled={spinning}
            >
              <JegerIkon callsign={j.callsign} />
              <span className="trekk-jeger-tekst">
                <span className="trekk-call">{j.callsign}</span>
                {j.navn !== j.callsign && <span className="trekk-navn">{j.navn}</span>}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="trekk-dock">
        <button type="button" className="trekk-spin" onClick={handleSpin} disabled={spinDisabled}>
          <SpinneIkon spinning={spinning} />
          <span>{spinning ? "Trekker..." : "Trekk post"}</span>
        </button>
      </div>
    </section>
  );
}
