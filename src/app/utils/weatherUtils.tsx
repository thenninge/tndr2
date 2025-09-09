export function weatherIcon(code: number) {
  if (code === 0) return "☀️"; // Clear
  if (code === 1 || code === 2) return "🌤️"; // Mainly clear/partly cloudy
  if (code === 3) return "☁️"; // Overcast
  if (code === 45 || code === 48) return "🌫️"; // Fog
  if (code === 51 || code === 53 || code === 55) return "🌦️"; // Drizzle
  if (code === 61 || code === 63 || code === 65) return "🌧️"; // Rain
  if (code === 71 || code === 73 || code === 75) return "❄️"; // Snow
  if (code === 80 || code === 81 || code === 82) return "🌦️"; // Rain showers
  if (code === 95) return "⛈️"; // Thunderstorm
  if (code === 96 || code === 99) return "⛈️"; // Thunderstorm with hail
  return "❔";
}

export function windDirectionText(deg: number) {
  if (deg >= 337.5 || deg < 22.5) return "N";
  if (deg >= 22.5 && deg < 67.5) return "NØ";
  if (deg >= 67.5 && deg < 112.5) return "Ø";
  if (deg >= 112.5 && deg < 157.5) return "SØ";
  if (deg >= 157.5 && deg < 202.5) return "S";
  if (deg >= 202.5 && deg < 247.5) return "SV";
  if (deg >= 247.5 && deg < 292.5) return "V";
  if (deg >= 292.5 && deg < 337.5) return "NV";
  return "?";
}

export function WindArrow({ deg }: { deg: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        transform: `rotate(${deg + 90}deg)`,
        transition: "transform 0.2s",
        fontSize: 18,
        marginRight: 4,
      }}
      aria-label={`Vindretning: ${deg} grader`}
    >
      →
    </span>
  );
}
