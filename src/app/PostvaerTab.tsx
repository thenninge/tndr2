import React, { useState, useEffect } from "react";
import { ELGPOSTER } from "./elgposter";
import PostVelger from "./PostVelger";
import { WindArrow, weatherIcon, windDirectionText } from "./utils/weatherUtils";

type Hour = { time: string; temp: number; windSpeed: number; windDir: number; weatherCode: number; precipitation: number };

export default function PostvaerTab() {
  const [selectedPosts, setSelectedPosts] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("postvaer_selectedPosts");
      if (saved) return JSON.parse(saved);
    }
    return ELGPOSTER.map(() => false);
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("postvaer_selectedPosts", JSON.stringify(selectedPosts));
    }
  }, [selectedPosts]);
  const [timeOption, setTimeOption] = useState('6timer');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [weatherData, setWeatherData] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("postvaer_weatherData");
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("postvaer_weatherData", JSON.stringify(weatherData));
    }
  }, [weatherData]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'omrade'|'alfabetisk'>('alfabetisk');

  async function fetchWeatherForPosts() {
    setLoading(true);
    const posts = ELGPOSTER.filter((_, i) => selectedPosts[i]);
    const now = new Date();
    let from: Date, to: Date;
    if (timeOption === '6timer') {
      from = new Date(now);
      to = new Date(now); to.setHours(to.getHours() + 6);
    } else if (timeOption === 'imorgen1') {
      from = new Date(now); from.setDate(from.getDate() + 1); from.setHours(7,0,0,0);
      to = new Date(from); to.setHours(12,0,0,0);
    } else if (timeOption === 'imorgen2') {
      from = new Date(now); from.setDate(from.getDate() + 1); from.setHours(12,0,0,0);
      to = new Date(from); to.setHours(16,0,0,0);
    } else {
      from = new Date(customFrom);
      to = new Date(customTo);
    }
    const results = await Promise.all(posts.map(async post => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${post.lat}&longitude=${post.lng}&hourly=temperature_2m,windspeed_10m,winddirection_10m,weathercode,precipitation&timezone=auto&start_date=${from.toISOString().slice(0,10)}&end_date=${to.toISOString().slice(0,10)}`;
      const res = await fetch(url);
      const data = await res.json();
      // Filtrer hourly på valgt tidsrom
      const hours = (data.hourly?.time || []).map((t: string, idx: number) => ({
        time: t,
        temp: data.hourly.temperature_2m[idx],
        windSpeed: data.hourly.windspeed_10m[idx],
        windDir: data.hourly.winddirection_10m[idx],
        weatherCode: data.hourly.weathercode[idx],
        precipitation: data.hourly.precipitation[idx],
      })).filter((h: Hour) => {
        const ht = new Date(h.time);
        return ht >= from && ht <= to;
      });
      return { post, hourly: hours };
    }));
    setWeatherData(results);
    setLoading(false);
  }

  // Sorteringslogikk
  const sortedWeatherData = [...weatherData];
  if (sortBy === 'nord-sor') {
    sortedWeatherData.sort((a, b) => b.post.lat - a.post.lat);
  } else if (sortBy === 'sor-nord') {
    sortedWeatherData.sort((a, b) => a.post.lat - b.post.lat);
  } else if (sortBy === 'ost-vest') {
    sortedWeatherData.sort((a, b) => b.post.lng - a.post.lng);
  } else if (sortBy === 'vest-ost') {
    sortedWeatherData.sort((a, b) => a.post.lng - b.post.lng);
  } else if (sortBy === 'omrade') {
    const omradeOrder = ["Strupen", "Høgemyr/GN", "Marstein", "Søndre", "Røytjern"];
    sortedWeatherData.sort((a, b) => {
      const areaA = omradeOrder.indexOf(a.post.omrade);
      const areaB = omradeOrder.indexOf(b.post.omrade);
      if (areaA === -1 && areaB === -1) return a.post.nr - b.post.nr;
      if (areaA === -1) return 1;
      if (areaB === -1) return -1;
      if (areaA !== areaB) return areaA - areaB;
      return a.post.nr - b.post.nr;
    });
  } else if (sortBy === 'alfabetisk') {
    sortedWeatherData.sort((a, b) => a.post.name.localeCompare(b.post.name, 'nb', { sensitivity: 'base' }));
  }

  function handleClearSelection() {
    setSelectedPosts(ELGPOSTER.map(() => false));
    setWeatherData([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("postvaer_selectedPosts");
      localStorage.removeItem("postvaer_weatherData");
    }
  }

  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Postvær</h2>
      <div style={{ marginBottom: 16 }}>
        <PostVelger
          posts={ELGPOSTER.map((p, idx) => ({ ...p, idx }))}
          selectedIds={selectedPosts.map((on: boolean, idx: number) => on ? idx : -1).filter((idx: number) => idx >= 0)}
          onConfirm={(ids) => setSelectedPosts(ELGPOSTER.map((_, i) => ids.includes(i)))}
          triggerLabel="Poster"
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <b>Sorter etter:</b>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as 'nord-sor'|'sor-nord'|'ost-vest'|'vest-ost'|'omrade'|'alfabetisk')} style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #bbb', fontSize: 15 }}>
            <option value="nord-sor">Nord → Sør</option>
            <option value="sor-nord">Sør → Nord</option>
            <option value="ost-vest">Øst → Vest</option>
            <option value="vest-ost">Vest → Øst</option>
            <option value="omrade">Område</option>
            <option value="alfabetisk">Alfabetisk</option>
          </select>
        </div>
        <button onClick={handleClearSelection} style={{ marginLeft: 12, padding: '8px 18px', borderRadius: 8, background: '#ffe0e0', border: '1px solid #d8b2b2', fontSize: 16, cursor: 'pointer' }}>Slett valg</button>
      </div>
      <div style={{ marginBottom: 16 }}>
        <b>Velg tidsrom:</b>
        <div style={{ display: 'flex', gap: 18, marginTop: 6, marginBottom: 6 }}>
          <label><input type="radio" name="timeopt" value="6timer" checked={timeOption==='6timer'} onChange={e=>setTimeOption(e.target.value)} /> 6 timer fra nå</label>
          <label><input type="radio" name="timeopt" value="imorgen1" checked={timeOption==='imorgen1'} onChange={e=>setTimeOption(e.target.value)} /> I morgen 07–12</label>
          <label><input type="radio" name="timeopt" value="imorgen2" checked={timeOption==='imorgen2'} onChange={e=>setTimeOption(e.target.value)} /> I morgen 12–16</label>
          <label><input type="radio" name="timeopt" value="custom" checked={timeOption==='custom'} onChange={e=>setTimeOption(e.target.value)} /> Sett tidsrom</label>
        </div>
        {timeOption === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input type="datetime-local" value={customFrom} onChange={e=>setCustomFrom(e.target.value)} />
            <span>til</span>
            <input type="datetime-local" value={customTo} onChange={e=>setCustomTo(e.target.value)} />
          </div>
        )}
      </div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={fetchWeatherForPosts} disabled={selectedPosts.every((v: boolean) => !v) || loading || (timeOption==='custom' && (!customFrom || !customTo))} style={{ padding: '8px 18px', borderRadius: 8, background: '#e0eaff', border: '1px solid #b2d8b2', fontSize: 16, cursor: 'pointer' }}>Hent værmelding</button>
      </div>
      {loading && <div>Laster værdata...</div>}
      {sortedWeatherData.length > 0 && sortedWeatherData.map(({post, hourly}) => (
        <div key={post.name} style={{ marginBottom: 28 }}>
          <h3 style={{ fontSize: 17, marginBottom: 6 }}>{post.name}</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 4 }}>Tid</th>
                <th style={{ textAlign: "left", padding: 4 }}>Temp</th>
                <th style={{ textAlign: "left", padding: 4 }}>Vind (m/s)</th>
                <th style={{ textAlign: "left", padding: 4 }}>Retning</th>
                <th style={{ textAlign: "left", padding: 4 }}>Vær</th>
                <th style={{ textAlign: "left", padding: 4 }}>Nedbør (mm)</th>
              </tr>
            </thead>
            <tbody>
              {hourly.map((h: import("./constants").HourlyForecast) => (
                <tr key={h.time}>
                  <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                  <td style={{ padding: 4 }}>{h.temp}°C</td>
                  <td style={{ padding: 4 }}>{(h.windSpeed / 3.6).toFixed(1)}</td>
                  <td style={{ padding: 4 }}><WindArrow deg={h.windDir} /> {windDirectionText(h.windDir)}</td>
                  <td style={{ padding: 4 }}>{weatherIcon(h.weatherCode)}</td>
                  <td style={{ padding: 4 }}>{h.precipitation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
