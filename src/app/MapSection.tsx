"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useMapEvent, useMap } from "react-leaflet";
import type { Elgpost } from "./types";
import type { FallObs } from "./types";

interface MapSectionProps {
  position: [number, number];
  posts: (Elgpost & { originalIdx?: number; visBlatt?: boolean })[];
  setPosts: React.Dispatch<React.SetStateAction<Elgpost[]>>;
  dagensPosterInfo?: Array<{postIdx: number, jeger: string, callsign: string}>;
  selectedLayer?: string;
  fall?: FallObs[];
  obs?: FallObs[];
}

export default function MapSection({ position, posts, dagensPosterInfo, selectedLayer = 'satellite', fall, obs }: MapSectionProps) {
  const [zoom, setZoom] = useState(16);
  const [satOpacity, setSatOpacity] = useState(1.0);
  const [topoOpacity, setTopoOpacity] = useState(0.5);
  const [comboOrder, setComboOrder] = useState<'satFirst' | 'topoFirst'>('satFirst');

  // Subkomponent for å lytte på zoom-endringer
  function ZoomListener() {
    const map = useMap();
    useEffect(() => {
      setZoom(map.getZoom());
    }, [map]);
    useMapEvent('zoomend', () => {
      setZoom(map.getZoom());
    });
    return null;
  }

  // Dynamisk ikonstørrelse basert på zoom (mellom 10 og 22 px)
  function getDotIcon(color: string) {
    const size = Math.max(10, Math.min(22, zoom * 1.2));
    return new L.Icon({
      iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2-2}' fill='${color}' stroke='white' stroke-width='2'/%3E%3C/svg%3E`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
  }

  function getXIcon(color: string) {
    const size = Math.max(16, Math.min(28, zoom * 1.4));
    return new L.Icon({
      iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Cline x1='4' y1='4' x2='${size-4}' y2='${size-4}' stroke='${color}' stroke-width='3'/%3E%3Cline x1='${size-4}' y1='4' x2='4' y2='${size-4}' stroke='${color}' stroke-width='3'/%3E%3C/svg%3E`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
  }

  // Kartlag-URLer
  const tileLayers: Record<string, { url: string; attribution: string; maxZoom?: number; minZoom?: number; opacity?: number }> = {
    satellite: {
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Tiles &copy; Esri',
      maxZoom: 19,
      minZoom: 0,
    },
    opentopo: {
      url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: 'Kartdata: &copy; OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
      minZoom: 0,
    },
    kartverket_ortofoto: {
      url: 'http://localhost:4000/tiles/orto_for/{z}/{x}/{y}.png',
      attribution: 'Kartverket Ortofoto',
      maxZoom: 19,
      minZoom: 0,
    },
    kartverket_topo: {
      url: 'http://localhost:4000/tiles/topo2/{z}/{x}/{y}.png',
      attribution: 'Kartverket Topo',
      maxZoom: 17,
      minZoom: 0,
    },
    kartverket_hillshade: {
      url: 'http://localhost:4000/tiles/hillshade_for/{z}/{x}/{y}.png',
      attribution: 'Kartverket Hillshade',
      maxZoom: 17,
      minZoom: 0,
      opacity: 0.5,
    },
    norgeskart_ortofoto: {
      url: 'https://tiles.kartverket.no/arcgis/rest/services/Ortofoto/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Norgeskart Ortofoto',
      maxZoom: 19,
      minZoom: 0,
    },
    norgeskart_topo: {
      url: 'https://tiles.kartverket.no/arcgis/rest/services/Topografisk/MapServer/tile/{z}/{y}/{x}',
      attribution: 'Norgeskart Topo',
      maxZoom: 17,
      minZoom: 0,
    },
    combo: { url: '', attribution: 'Kun for visningslogikk' }, // brukes kun for visningslogikk
  };
  const layer = tileLayers[selectedLayer] || tileLayers.satellite;
  const showCombo = selectedLayer === 'combo';

  return (
    <div style={{ marginBottom: 24, position: "relative" }}>
      {showCombo && (
        <div style={{ marginBottom: 8, display: 'flex', gap: 24, alignItems: 'center' }}>
          <label>
            Flyfoto opacity: {satOpacity.toFixed(2)}
            <input type="range" min="0" max="1" step="0.01"
                   value={satOpacity} onChange={e => setSatOpacity(parseFloat(e.target.value))}/>
          </label>
          <label>
            Topo opacity: {topoOpacity.toFixed(2)}
            <input type="range" min="0" max="1" step="0.01"
                   value={topoOpacity} onChange={e => setTopoOpacity(parseFloat(e.target.value))}/>
          </label>
          <button onClick={() => setComboOrder(o => o === 'satFirst' ? 'topoFirst' : 'satFirst')} style={{ marginLeft: 16, padding: '6px 14px', borderRadius: 8, fontSize: 15, cursor: 'pointer' }}>
            Bytt om på lagene
          </button>
        </div>
      )}
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ height: 500, width: "100%" }}
      >
        <ZoomListener />
        {showCombo ? (
          comboOrder === 'satFirst' ? (
            <>
              <TileLayer
                attribution={tileLayers.satellite.attribution}
                url={tileLayers.satellite.url}
                maxZoom={tileLayers.satellite.maxZoom}
                minZoom={tileLayers.satellite.minZoom}
                opacity={satOpacity}
              />
              <TileLayer
                attribution={tileLayers.opentopo.attribution}
                url={tileLayers.opentopo.url}
                maxZoom={tileLayers.opentopo.maxZoom}
                minZoom={tileLayers.opentopo.minZoom}
                opacity={topoOpacity}
              />
            </>
          ) : (
            <>
              <TileLayer
                attribution={tileLayers.opentopo.attribution}
                url={tileLayers.opentopo.url}
                maxZoom={tileLayers.opentopo.maxZoom}
                minZoom={tileLayers.opentopo.minZoom}
                opacity={topoOpacity}
              />
              <TileLayer
                attribution={tileLayers.satellite.attribution}
                url={tileLayers.satellite.url}
                maxZoom={tileLayers.satellite.maxZoom}
                minZoom={tileLayers.satellite.minZoom}
                opacity={satOpacity}
              />
            </>
          )
        ) : (
          <TileLayer
            attribution={layer.attribution}
            url={layer.url}
            maxZoom={layer.maxZoom}
            minZoom={layer.minZoom}
            opacity={layer.opacity ?? 1.0}
          />
        )}
        {posts.map((post, idx) => {
          const isElghytta = post.name.trim().toUpperCase() === 'ELGHYTTA';
          const icon = post.visBlatt ? getDotIcon('blue') : getDotIcon(isElghytta ? 'green' : 'red');
          const info = dagensPosterInfo?.find(d => d.postIdx === (post.originalIdx ?? idx));
          return (
            <Marker key={idx} position={[post.lat, post.lng]} icon={icon}>
              <Popup>{info ? `${post.name} - ${info.callsign}` : post.name}</Popup>
            </Marker>
          );
        })}
        {/* Fall-markører (dus gul) */}
        {fall && fall.map((f, i) => (
          <Marker key={"fall"+i} position={[f.lat, f.lng]} icon={getXIcon('#ffe066')}>
            <Popup>
              <b>Elgfall</b><br/>
              {f.dato}<br/>
              {f.type}, {f.antall} stk<br/>
              Retning: {f.retning}
            </Popup>
          </Marker>
        ))}
        {/* Obs-markører (klar gul) */}
        {obs && obs.map((f, i) => (
          <Marker key={"obs"+i} position={[f.lat, f.lng]} icon={getXIcon('#FFD600')}>
            <Popup>
              <b>Observasjon</b><br/>
              {f.dato}<br/>
              {f.type}, {f.antall} stk<br/>
              Retning: {f.retning}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
