import React, { useState, useEffect } from "react";
import { ELGPOSTER } from "./elgposter";
import { ELGJEGERE } from "./elgjegere";

export default function DagensPosterTab() {
  const [fordeling, setFordeling] = useState<{ postIdx: number; jeger: string }[]>([]);
  const [edit, setEdit] = useState<{ [postIdx: number]: string }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta'>('alfabetisk');
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
    setShowAddFirst(false);
    setShowAddRow(false);
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
              <select value={sortBy} onChange={e => setSortBy(e.target.value as 'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta')} style={{ marginLeft: 6, fontSize: 15, padding: 3, borderRadius: 5 }}>
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
                  let arr = ELGPOSTER.map((p, idx) => ({ ...p, idx }));
                  if (sortBy === 'omrade') {
                    arr = arr.sort((a, b) => a.omrade.localeCompare(b.omrade) || (a.name || '').localeCompare(b.name || ''));
                    const grouped: Record<string, typeof arr> = {};
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
                      arr = arr.sort((a, b) => b.lat - a.lat); break;
                    case 'sor-nord':
                      arr = arr.sort((a, b) => a.lat - b.lat); break;
                    case 'ost-vest':
                      arr = arr.sort((a, b) => b.lng - a.lng); break;
                    case 'vest-ost':
                      arr = arr.sort((a, b) => a.lng - b.lng); break;
                    case 'alfabetisk':
                      arr = arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
                    case 'nummerert':
                      arr = arr.sort((a, b) => a.nr - b.nr); break;
                    case 'hytta':
                      arr = arr.sort((a, b) => {
                        const distA = Math.sqrt(Math.pow(a.lat - 60.72479028725314, 2) + Math.pow(a.lng - 9.036607137866255, 2));
                        const distB = Math.sqrt(Math.pow(b.lat - 60.72479028725314, 2) + Math.pow(b.lng - 9.036607137866255, 2));
                        return distA - distB;
                      }); break;
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
                  {selectedPosts.map(idx => <li key={idx} style={{ marginBottom: 2 }}>{ELGPOSTER[idx].name}</li>)}
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
                    <span style={{ minWidth: 120 }}>{ELGPOSTER[idx].name}</span>
                    <select value={postJeger[idx] || ''} onChange={e => handleSetJeger(idx, e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required>
                      <option value="">Velg jeger</option>
                      {ELGJEGERE.filter(j => !Object.entries(postJeger).some(([k, v]) => Number(k) !== idx && v === j.navn) || postJeger[idx] === j.navn).map(j => (
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
              let arr = ELGPOSTER.map((p, idx) => ({ ...p, idx })).filter(p => !fordeling.some(f => f.postIdx === p.idx) || addPostIdx === String(p.idx));
              switch (addSortBy) {
                case 'omrade':
                  arr = arr.sort((a, b) => a.omrade.localeCompare(b.omrade) || (a.name || '').localeCompare(b.name || '')); break;
                case 'nord-sor':
                  arr = arr.sort((a, b) => b.lat - a.lat); break;
                case 'sor-nord':
                  arr = arr.sort((a, b) => a.lat - b.lat); break;
                case 'ost-vest':
                  arr = arr.sort((a, b) => b.lng - a.lng); break;
                case 'vest-ost':
                  arr = arr.sort((a, b) => a.lng - b.lng); break;
                case 'alfabetisk':
                  arr = arr.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
                case 'nummerert':
                  arr = arr.sort((a, b) => a.nr - b.nr); break;
                case 'hytta':
                  arr = arr.sort((a, b) => {
                    const distA = Math.sqrt(Math.pow(a.lat - 60.72479028725314, 2) + Math.pow(a.lng - 9.036607137866255, 2));
                    const distB = Math.sqrt(Math.pow(b.lat - 60.72479028725314, 2) + Math.pow(b.lng - 9.036607137866255, 2));
                    return distA - distB;
                  }); break;
              }
              return arr.map(p => (
                <option key={p.nr+p.name} value={p.idx}>{p.name}</option>
              ));
            })()}
          </select>
          <select value={addJeger} onChange={e => setAddJeger(e.target.value)} style={{ fontSize: 16, padding: 6, borderRadius: 6 }} required>
            <option value="">Velg jeger</option>
            {ELGJEGERE.filter(j => !fordeling.some(f => f.jeger === j.navn) || addJeger === j.navn).map(j => (
              <option key={j.navn} value={j.navn}>{j.navn}</option>
            ))}
          </select>
          <select value={addSortBy} onChange={e => setAddSortBy(e.target.value as 'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta')} style={{ fontSize: 15, padding: 3, borderRadius: 5, marginLeft: 8 }}>
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
                const post = ELGPOSTER[f.postIdx];
                const valgt = edit[f.postIdx] ?? f.jeger;
                const jegerObj = ELGJEGERE.find(j => j.navn === valgt);
                return (
                  <tr key={post.nr+post.name}>
                    <td style={{ padding: 4, fontWeight: 700 }}>{post.name}</td>
                    <td style={{ padding: 4 }}>
                      <select value={valgt} onChange={e => setEdit(ed => ({ ...ed, [f.postIdx]: e.target.value }))} style={{ fontSize: 16, padding: 4, borderRadius: 6 }}>
                        <option value="">Velg jeger</option>
                        {ELGJEGERE.filter(j => !fordeling.some(ff => (edit[ff.postIdx] ?? ff.jeger) === j.navn && ff.postIdx !== f.postIdx) || valgt === j.navn).map(j => (
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
