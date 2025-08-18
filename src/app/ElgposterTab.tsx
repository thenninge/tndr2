import React, { useState } from "react";
import { ELGPOSTER } from "./elgposter";

export default function ElgposterTab() {
  const [sortBy, setSortBy] = useState<'omrade'|'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'alfabetisk'|'nummerert'|'hytta'>('omrade');

  let arr = ELGPOSTER.map((p, idx) => ({ ...p, idx }));
  if (sortBy === 'omrade') {
    arr = arr.sort((a, b) => a.omrade.localeCompare(b.omrade) || a.name.localeCompare(b.name));
  } else {
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
        arr = arr.sort((a, b) => a.name.localeCompare(b.name)); break;
      case 'nummerert':
        arr = arr.sort((a, b) => a.nr - b.nr); break;
      case 'hytta':
        arr = arr.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.lat - 60.72479028725314, 2) + Math.pow(a.lng - 9.036607137866255, 2));
          const distB = Math.sqrt(Math.pow(b.lat - 60.72479028725314, 2) + Math.pow(b.lng - 9.036607137866255, 2));
          return distA - distB;
        }); break;
    }
  }

  // Område-gruppering for visning
  let grouped: { [omrade: string]: typeof arr } = {};
  if (sortBy === 'omrade') {
    arr.forEach(p => {
      if (!grouped[p.omrade]) grouped[p.omrade] = [];
      grouped[p.omrade].push(p);
    });
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Elgposter</h2>
      <div style={{ marginBottom: 14 }}>
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
      <div style={{ maxWidth: 900 }}>
        {sortBy === 'omrade' ? (
          Object.entries(grouped).map(([omrade, posts]) => (
            <div key={omrade} style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#444', marginBottom: 4 }}>{omrade}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, columns: 2, gap: '0 32px' }}>
                {posts.map(p => (
                  <li key={p.nr+p.name} style={{ marginBottom: 2, fontSize: 16, breakInside: 'avoid' }}>
                    <span style={{ fontWeight: 400, marginRight: 8 }}>{p.name}</span>
                    <span style={{ color: '#888', fontSize: 15 }}>({p.nr})</span>
                  </li>
                ))}
              </ul>
            </div>
          ))
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, columns: 2, gap: '0 32px' }}>
            {arr.map(p => (
              <li key={p.nr+p.name} style={{ marginBottom: 2, fontSize: 16, breakInside: 'avoid' }}>
                <span style={{ fontWeight: 400, marginRight: 8 }}>{p.name}</span>
                <span style={{ color: '#888', fontSize: 15 }}>({p.nr})</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
