// Globale konstanter og typer for appen

export const DEFAULT_POSITION: [number, number] = [60.72491439929582, 9.036524928167466];

export interface HourlyForecast {
  time: string;
  temp: number;
  windSpeed: number;
  windDir: number;
  weatherCode: number;
  precipitation: number;
}

export interface ForecastDay {
  date: string;
  tempMin: number;
  tempMax: number;
  windSpeed: number;
  windDir: number;
  weatherCode: number;
  precipitation: number;
}

export type Post = {
  nr: number;
  name: string;
  lat: number;
  lng: number;
  omrade: string;
};

export type TrekkData = {
  postIdx: number;
  jeger: string;
};

export type Jeger = {
  navn: string;
  callsign: string;
};

export type WeatherData = {
  post: Post;
  hourly: HourlyForecast[];
};

export type Logger = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  startTime: number | null;
  target: number;
  offset: number;
  accelerated: boolean;
  running: boolean;
  simulatedElapsed: number; // minutter
};
