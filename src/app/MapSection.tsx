"use client";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useState } from "react";

interface MapSectionProps {
  position: [number, number];
  onClose?: () => void;
  addPostMode?: boolean;
  posts: { name: string; lat: number; lng: number }[];
  setPosts: React.Dispatch<React.SetStateAction<{ name: string; lat: number; lng: number }[]>>;
  onPostAdded?: () => void;
  arbitraryPointMode?: boolean;
  onArbitraryPointSelected?: (latlng: { lat: number; lng: number }) => void;
  arbitraryPoint?: { lat: number; lng: number } | null;
}

function MapClickHandler({ onMapClick, addPostMode, arbitraryPointMode, onArbitraryPointSelected }: {
  onMapClick: (e: any) => void,
  addPostMode: boolean,
  arbitraryPointMode?: boolean,
  onArbitraryPointSelected?: (latlng: { lat: number; lng: number }) => void,
}) {
  useMapEvents({
    click: (e) => {
      if (arbitraryPointMode && onArbitraryPointSelected) {
        onArbitraryPointSelected(e.latlng);
      } else if (addPostMode) {
        onMapClick(e);
      }
    },
  });
  return null;
}

// Rød dot-ikon for elgposter
const redDotIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Ccircle cx='9' cy='9' r='7' fill='red' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});
// Hus/hytte-ikon for ELGHYTTA
const cabinIcon = new L.Icon({
  iconUrl: "/window.svg",
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  popupAnchor: [0, -28],
});
// Grønn dot-ikon for hytta
const greenDotIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18'%3E%3Ccircle cx='9' cy='9' r='7' fill='green' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -9],
});

export default function MapSection({ position, onClose, addPostMode, posts, setPosts, onPostAdded, arbitraryPointMode, onArbitraryPointSelected, arbitraryPoint }: MapSectionProps) {
  const [zoom, setZoom] = useState(16);
  // Dynamisk ikonstørrelse basert på zoom (mellom 10 og 22 px)
  function getDotIcon(color: string, isCabin: boolean) {
    const size = Math.max(10, Math.min(22, zoom * 1.2));
    return new L.Icon({
      iconUrl: `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E%3Ccircle cx='${size/2}' cy='${size/2}' r='${size/2-2}' fill='${color}' stroke='white' stroke-width='2'/%3E%3C/svg%3E`,
      iconSize: [size, size],
      iconAnchor: [size/2, size/2],
      popupAnchor: [0, -size/2],
    });
  }

  function handleMapClick(e: any) {
    const { lat, lng } = e.latlng;
    const name = window.prompt("Navn på post:");
    if (name && name.trim()) {
      setPosts((prev) => [...prev, { name: name.trim(), lat, lng }]);
      if (onPostAdded) onPostAdded();
    }
  }

  function handleMarkerClick(idx: number) {
    if (window.confirm("Slette denne posten?")) {
      setPosts((prev) => prev.filter((_, i) => i !== idx));
    }
  }

  return (
    <div style={{ marginBottom: 24, position: "relative" }}>
      {onClose && (
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 8, right: 8, zIndex: 1000, padding: "4px 10px", borderRadius: 6, background: "#eee", border: "1px solid #ccc", cursor: "pointer" }}
        >
          Lukk
        </button>
      )}
      <MapContainer center={position} zoom={zoom} style={{ height: 500, width: "100%" }}
        whenCreated={(map) => {
          map.on('zoomend', () => setZoom(map.getZoom()));
          setZoom(map.getZoom());
          // Fix for marker icons in leaflet + next
          // @ts-ignore
          delete L.Icon.Default.prototype._getIconUrl;
          // @ts-ignore
          L.Icon.Default.mergeOptions({
            iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
            iconUrl: require('leaflet/dist/images/marker-icon.png'),
            shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
          });
        }}
      >
        <TileLayer
          attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {/* Marker for alle poster med navn som label */}
        {posts.map((post, idx) => {
          const isCabin = /hytte|elghytta/i.test(post.name);
          const icon = getDotIcon(isCabin ? 'green' : 'red', isCabin);
          return (
            <Marker key={idx} position={[post.lat, post.lng]} icon={icon}>
              <Popup>{post.name}</Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
