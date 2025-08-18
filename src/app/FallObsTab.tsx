import React, { useState } from "react";
import type { FallObs } from "./types";

export default function FallObsTab({ jegere, fallObs, setFallObs, loading }: {
  jegere: { navn: string; callsign: string }[];
  fallObs: FallObs[];
  setFallObs: (f: FallObs[]) => void;
  loading: boolean;
}) {
  const [error, setError] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editFall, setEditFall] = useState<{
    dato: string; lat: string; lng: string; type: string; retning: string; antall: string; kategori: 'fall' | 'obs'; person: string;
  } | null>(null);
  // Nytt skjema for å legge til
  const [nyFall, setNyFall] = useState<{
    dato: string; lat: string; lng: string; type: string; retning: string; antall: string; kategori: 'fall' | 'obs'; person: string;
  }>({ dato: '', lat: '', lng: '', type: '', retning: '', antall: '', kategori: 'fall', person: '' });

  async function handleSaveEdit(idx: number) {
    if (!editFall || !editFall.dato || !editFall.lat || !editFall.lng || !editFall.type || !editFall.retning || !editFall.antall || !editFall.kategori) {
      setError('Fyll ut alle felter');
      return;
    }
    const ny = [...fallObs];
    ny[idx] = {
      dato: editFall.dato,
      lat: Number(editFall.lat),
      lng: Number(editFall.lng),
      type: editFall.type,
      retning: editFall.retning,
      antall: Number(editFall.antall),
      kategori: editFall.kategori,
      person: editFall.person || ''
    };
    setFallObs(ny);
    setEditIdx(null);
    setEditFall(null);
    // Lagring til supabase skjer i parent
  }
  async function handleDelete(idx: number) {
    const ny = fallObs.filter((_, i) => i !== idx);
    setFallObs(ny);
    setEditIdx(null);
    setEditFall(null);
    // Lagring til supabase skjer i parent
  }
  function handleAddFall(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!nyFall.dato || !nyFall.lat || !nyFall.lng || !nyFall.type || !nyFall.retning || !nyFall.antall || !nyFall.kategori) {
      setError('Fyll ut alle felter');
      return;
    }
    const nytt: FallObs = {
      dato: nyFall.dato,
      lat: Number(nyFall.lat),
      lng: Number(nyFall.lng),
      type: nyFall.type,
      retning: nyFall.retning,
      antall: Number(nyFall.antall),
      kategori: nyFall.kategori,
      person: nyFall.person || ''
    };
    setFallObs([nytt, ...fallObs]);
    setNyFall({ dato: '', lat: '', lng: '', type: '', retning: '', antall: '', kategori: 'fall', person: '' });
  }
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Logg elgfall og observasjoner</h2>
      <form onSubmit={handleAddFall} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 14, background: '#fafdff', border: '1px solid #dde', borderRadius: 8, padding: 10 }}>
        <input type="date" value={nyFall.dato} onChange={e => setNyFall(f => ({ ...f, dato: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 120 }} required />
        <input type="number" step="any" placeholder="Lat" value={nyFall.lat} onChange={e => setNyFall(f => ({ ...f, lat: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} required />
        <input type="number" step="any" placeholder="Lng" value={nyFall.lng} onChange={e => setNyFall(f => ({ ...f, lng: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} required />
        <input type="text" placeholder="Type (f.eks. Okse)" value={nyFall.type} onChange={e => setNyFall(f => ({ ...f, type: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} required />
        <input type="text" placeholder="Retning" value={nyFall.retning} onChange={e => setNyFall(f => ({ ...f, retning: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} required />
        <input type="number" placeholder="Antall" value={nyFall.antall} onChange={e => setNyFall(f => ({ ...f, antall: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 70 }} required />
        <select value={nyFall.kategori} onChange={e => setNyFall(f => ({ ...f, kategori: e.target.value as 'fall' | 'obs' }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }}>
          <option value="obs">Observasjon</option>
          <option value="fall">Fall</option>
        </select>
        <input type="text" placeholder="Skytter/observatør" value={nyFall.person} onChange={e => setNyFall(f => ({ ...f, person: e.target.value }))} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 110 }} />
        <button type="submit" style={{ padding: '6px 14px', borderRadius: 7, background: '#e0ffe0', border: '1px solid #b2d8b2', fontSize: 15, cursor: 'pointer' }}>Legg til</button>
      </form>
      {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Laster...</div> : (
        <div style={{ background: '#f8f8ff', border: '1px solid #b2d8f6', borderRadius: 12, padding: 18, marginTop: 12, boxShadow: '0 2px 8px #0001', maxWidth: 900, marginLeft: 'auto', marginRight: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 17 }}>
            <thead>
              <tr style={{ background: '#e0eaff' }}>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Dato</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Lat</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Lng</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Type</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Retning</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Antall</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Kategori</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}>Skytter/observatør</th>
                <th style={{ position: 'sticky', top: 0, zIndex: 1, padding: 8, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {fallObs.map((f, i) => (
                editIdx === i && editFall ? (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fafdff' : '#f0f6fa' }}>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="date" value={editFall.dato} onChange={e => setEditFall(ef => ef ? { ...ef, dato: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 120 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" step="any" value={editFall.lat} onChange={e => setEditFall(ef => ef ? { ...ef, lat: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" step="any" value={editFall.lng} onChange={e => setEditFall(ef => ef ? { ...ef, lng: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="text" value={editFall.type} onChange={e => setEditFall(ef => ef ? { ...ef, type: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="text" value={editFall.retning} onChange={e => setEditFall(ef => ef ? { ...ef, retning: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="number" value={editFall.antall} onChange={e => setEditFall(ef => ef ? { ...ef, antall: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 70 }} /></td>
                    <td style={{ padding: 8, textAlign: 'right' }}>
                      <select value={editFall.kategori} onChange={e => setEditFall(ef => ef ? { ...ef, kategori: e.target.value as 'fall' | 'obs' } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 90 }}>
                        <option value="obs">Observasjon</option>
                        <option value="fall">Fall</option>
                      </select>
                    </td>
                    <td style={{ padding: 8, textAlign: 'right' }}><input type="text" value={editFall.person} onChange={e => setEditFall(ef => ef ? { ...ef, person: e.target.value ?? "" } : ef)} style={{ fontSize: 15, padding: 4, borderRadius: 5, width: 110 }} /></td>
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
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.retning.charAt(0).toUpperCase() + f.retning.slice(1).toLowerCase()}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.antall}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.kategori === 'fall' ? 'Fall' : 'Observasjon'}</td>
                    <td style={{ padding: 8, textAlign: 'right' }}>{f.person || ''}</td>
                    <td style={{ padding: 8, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => { setEditIdx(i); setEditFall({
                        dato: f.dato,
                        lat: f.lat.toString(),
                        lng: f.lng.toString(),
                        type: f.type,
                        retning: f.retning,
                        antall: f.antall.toString(),
                        kategori: f.kategori,
                        person: f.person || ''
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
