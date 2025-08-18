import React, { useState } from "react";
import type { Logger } from "./constants";
import DgLogger from "./page";

export default function MorningTab({ loggers, setLoggers }: { loggers: Logger[]; setLoggers: React.Dispatch<React.SetStateAction<Logger[]>> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  return (
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
          onDelete={() => setLoggers(loggers => loggers.filter((x: Logger) => x.id !== l.id))}
        />
      ))}
    </section>
  );
}
