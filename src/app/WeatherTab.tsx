import React from "react";
import { WindArrow, weatherIcon, windDirectionText } from "./utils/weatherUtils";
import type { HourlyForecast, ForecastDay } from "./constants";

interface WeatherTabProps {
  hourly: HourlyForecast[];
  forecast: ForecastDay[];
  expand: boolean;
  setExpand: (v: boolean | ((v: boolean) => boolean)) => void;
}

export default function WeatherTab({ hourly, forecast, expand, setExpand }: WeatherTabProps) {
  return (
    <section>
      <h2 style={{ fontSize: 20, marginBottom: 8 }}>Vær for de neste 6 timene (Elghytta)</h2>
      {hourly.length === 0 ? (
        <div>Laster værmelding...</div>
      ) : (
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
            {hourly.map((h) => (
              <tr key={h.time}>
                <td style={{ padding: 4 }}>{new Date(h.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                <td style={{ padding: 4 }}>{h.temp}°C</td>
                <td style={{ padding: 4 }}>{h.windSpeed}</td>
                <td style={{ padding: 4 }}>
                  <WindArrow deg={h.windDir} />
                  {windDirectionText(h.windDir)}
                </td>
                <td style={{ padding: 4 }}>{weatherIcon(h.weatherCode)}</td>
                <td style={{ padding: 4 }}>{h.precipitation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ marginTop: 24 }}>
        <button onClick={() => setExpand((v: boolean) => !v)} style={{ padding: "6px 14px", fontSize: 15, borderRadius: 8, cursor: "pointer", marginBottom: 8 }}>
          {expand ? "Skjul 3-dagersvarsel" : "Vis 3-dagersvarsel"}
        </button>
        {expand && (
          <div>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Værmelding neste 3 dager</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: 4 }}>Dato</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Min</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Max</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Vind (m/s)</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Retning</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Vær</th>
                  <th style={{ textAlign: "left", padding: 4 }}>Nedbør (mm)</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((day) => (
                  <tr key={day.date}>
                    <td style={{ padding: 4 }}>{day.date}</td>
                    <td style={{ padding: 4 }}>{day.tempMin}°C</td>
                    <td style={{ padding: 4 }}>{day.tempMax}°C</td>
                    <td style={{ padding: 4 }}>{day.windSpeed}</td>
                    <td style={{ padding: 4 }}>
                      <WindArrow deg={day.windDir} />
                      {windDirectionText(day.windDir)}
                    </td>
                    <td style={{ padding: 4 }}>{weatherIcon(day.weatherCode)}</td>
                    <td style={{ padding: 4 }}>{day.precipitation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
