import React, { useState } from "react";
import { ELGPOSTER } from "./elgposter";
import { ELGJEGERE } from "./elgjegere";

export default function PostTrekkTab() {
  const [selected, setSelected] = useState(() => ELGPOSTER.map(() => false));
  const [remaining, setRemaining] = useState(() => ELGPOSTER.map((_, i) => i));
  const [spinning, setSpinning] = useState(false);
  const [winnerIdx, setWinnerIdx] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [spinName, setSpinName] = useState('');
  const [expanderOpen, setExpanderOpen] = useState(false);
  const [drawn, setDrawn] = useState<{ postIdx: number; jeger: string }[]>([]);
  const [selectedJeger, setSelectedJeger] = useState('');
  const [sortBy, setSortBy] = useState<'alfabetisk'|'original'>('alfabetisk');
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
      if (ticks > 15) {
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
  const antallValgtePoster = selected.filter(Boolean).length;
  const antallValgteJegere = autoJegere.length;

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
    </section>
  );
}
