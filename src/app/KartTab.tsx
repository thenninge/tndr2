import React, { useState } from "react";
import dynamic from "next/dynamic";
import { ELGPOSTER } from "./elgposter";
import type { Elgpost } from "./types";
import { FallObs } from "./types";

const MapSection = dynamic(() => import("./MapSection"), { ssr: false });

interface KartTabProps {
  postsToShow: Elgpost[];
  setElgposter: (posts: Elgpost[]) => void;
  DEFAULT_POSITION: [number, number];
  kartVisning: 'alle' | 'dagens';
  setKartVisning: (v: 'alle' | 'dagens') => void;
  dagensPosterInfo?: Array<{ postIdx: number; jeger: string; callsign: string }>;
  showFallInMap: boolean;
  setShowFallInMap: (v: boolean) => void;
  showObsInMap: boolean;
  setShowObsInMap: (v: boolean) => void;
  fallObs: FallObs[];
  mapLayer: string;
  setMapLayer: (v: string) => void;
}

export default function KartTab({
  postsToShow,
  setElgposter,
  DEFAULT_POSITION,
  kartVisning,
  setKartVisning,
  dagensPosterInfo,
  showFallInMap,
  setShowFallInMap,
  showObsInMap,
  setShowObsInMap,
  fallObs,
  mapLayer,
  setMapLayer,
}: KartTabProps) {
  // Ny state for visning
  const [showPoster, setShowPoster] = useState(true);
  const [showTrekkruter, setShowTrekkruter] = useState(false); // Forberedt, ikke i bruk ennå

  // Riktig filtrering:
  const filteredPosts: Elgpost[] = showPoster ? (kartVisning === 'alle' ? ELGPOSTER : postsToShow) : [];

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Kart</h2>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ fontWeight: 400, fontSize: 15 }}>
          <input type="radio" checked={kartVisning === 'alle'} onChange={() => setKartVisning('alle')} style={{ marginRight: 6 }} />
          Alle poster
        </label>
        <label style={{ fontWeight: 400, fontSize: 15 }}>
          <input type="radio" checked={kartVisning === 'dagens'} onChange={() => setKartVisning('dagens')} style={{ marginRight: 6 }} />
          Dagens poster
        </label>
        <label style={{ fontWeight: 400, fontSize: 15, marginLeft: 18 }}>
          <input type="checkbox" checked={showPoster} onChange={e => setShowPoster(e.target.checked)} style={{ marginRight: 6 }} />
          Vis poster
        </label>
        <label style={{ fontWeight: 400, fontSize: 15, marginLeft: 18, opacity: 0.7 }}>
          <input type="checkbox" checked={showTrekkruter} onChange={e => setShowTrekkruter(e.target.checked)} style={{ marginRight: 6 }} disabled />
          Vis trekkruter (kommer)
        </label>
        <label style={{ fontWeight: 400, fontSize: 15, marginLeft: 18 }}>
          <input type="checkbox" checked={showFallInMap} onChange={e => setShowFallInMap(e.target.checked)} style={{ marginRight: 6 }} />
          Vis fall
        </label>
        <label style={{ fontWeight: 400, fontSize: 15, marginLeft: 18 }}>
          <input type="checkbox" checked={showObsInMap} onChange={e => setShowObsInMap(e.target.checked)} style={{ marginRight: 6 }} />
          Vis obs.
        </label>
        <label style={{ fontWeight: 400, fontSize: 15, marginLeft: 18 }}>
          Kartlag:
          <select value={mapLayer} onChange={e => setMapLayer(e.target.value)} style={{ marginLeft: 6, fontSize: 15, padding: 3, borderRadius: 5 }}>
            <option value="satellite">Flyfoto</option>
            <option value="opentopo">Topografisk</option>
            <option value="combo">Flyfoto+topo</option>
          </select>
        </label>
      </div>
      <div style={{ height: 600, width: '100%', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px #0001' }}>
        <MapSection
          position={DEFAULT_POSITION}
          posts={filteredPosts}
          setPosts={setElgposter}
          dagensPosterInfo={dagensPosterInfo}
          selectedLayer={mapLayer}
          fall={showFallInMap ? fallObs.filter(f => f.kategori === 'fall') : []}
          obs={showObsInMap ? fallObs.filter(f => f.kategori === 'obs') : []}
        />
      </div>
    </section>
  );
}
