"use client";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useState } from "react";

interface Elgpost {
  name: string;
  lat: number;
  lng: number;
}

interface MapSectionProps {
  position: [number, number];
  posts: Elgpost[];
  setPosts: React.Dispatch<React.SetStateAction<Elgpost[]>>;
}

export default function MapSection({ position, posts }: MapSectionProps) {
  const [zoom, setZoom] = useState(16);
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

  return (
    <div style={{ marginBottom: 24, position: "relative" }}>
      <MapContainer
        center={position}
        zoom={zoom}
        style={{ height: 500, width: "100%" }}
        whenCreated={(map) => {
          map.on("zoomend", () => setZoom(map.getZoom()));
          setZoom(map.getZoom());
        }}
      >
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        {posts.map((post, idx) => {
          const isCabin = /hytte|elghytta/i.test(post.name);
          const icon = getDotIcon(isCabin ? "green" : "red");
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
