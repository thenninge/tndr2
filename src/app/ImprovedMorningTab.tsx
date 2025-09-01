import React, { useState, useEffect, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from '../utils/supabaseClient';

/** ===== Types ===== **/
interface Point {
  time: Date;
  temp: number;
}

interface DataPoint {
  timestamp: Date;
  runtime: number;  // Timer fra start (0 til start-tid, deretter 1, 2, 3...)
  tempEst: number | null;
  tempLogg: number | null;
}

interface Logger {
  id: string;
  name: string;
  lat: number;
  lng: number;
  target: number;   // mål for DG
  offset: number;   // beholdt som i din versjon (brukes som baseTemp under)
  dayOffset: number;
  nightOffset: number;
  baseTemp: number;
  dataTable: DataPoint[];  // Ny tabell-struktur
  accumulatedDG: number;
  lastFetched?: Date;
  isRunning: boolean;
  startTime?: Date;
}

/** ===== Database Functions ===== **/
// Test Supabase connection
async function testSupabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing Supabase connection...');
    const { error } = await supabase
      .from('morning_loggers')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ Supabase connection failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
}

// LocalStorage fallback functions
function saveLoggersToLocalStorage(loggers: Logger[]): void {
  try {
    localStorage.setItem('morning_loggers', JSON.stringify(loggers));
    console.log('💾 Saved loggers to localStorage:', loggers.length, 'loggers');
  } catch (error) {
    console.error('❌ Error saving to localStorage:', error);
  }
}

function loadLoggersFromLocalStorage(): Logger[] {
  try {
    const stored = localStorage.getItem('morning_loggers');
    if (stored) {
      const loggers = JSON.parse(stored);
      console.log('📱 Loaded loggers from localStorage:', loggers.length, 'loggers');
      
      // Convert date strings back to Date objects
      return loggers.map((logger: Record<string, unknown>) => ({
        ...logger,
        lastFetched: logger.lastFetched ? new Date(logger.lastFetched as string) : undefined,
        startTime: logger.startTime ? new Date(logger.startTime as string) : undefined,
        dataTable: (logger.dataTable as Array<Record<string, unknown>>)?.map((point: Record<string, unknown>) => ({
          ...point,
          timestamp: new Date(point.timestamp as string)
        })) || []
      }));
    }
    return [];
  } catch (error) {
    console.error('❌ Error loading from localStorage:', error);
    return [];
  }
}

async function loadLoggersFromDatabase(): Promise<Logger[]> {
  try {
    console.log('🔄 Loading loggers from database...');
    const { data, error } = await supabase
      .from('morning_loggers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error loading loggers:', error);
      return [];
    }

    console.log('✅ Loaded loggers from database:', data?.length || 0, 'loggers');
    // Convert database format to Logger interface
    return (data || []).map((dbLogger: Record<string, unknown>) => ({
        id: dbLogger.id as string,
        name: dbLogger.name as string,
        lat: dbLogger.lat as number,
        lng: dbLogger.lng as number,
        target: dbLogger.target as number,
        offset: dbLogger.temp_offset as number,
        dayOffset: dbLogger.day_offset as number,
        nightOffset: dbLogger.night_offset as number,
        baseTemp: dbLogger.base_temp as number,
        dataTable: dbLogger.data_table ? (() => {
          const parsed = JSON.parse(dbLogger.data_table as string);
          // Convert timestamp strings back to Date objects and ensure runtime is a number
          return parsed.map((point: Record<string, unknown>) => ({
            ...point,
            timestamp: new Date(point.timestamp as string),
            runtime: Number(point.runtime),
            tempEst: point.tempEst !== null ? Number(point.tempEst) : null,
            tempLogg: point.tempLogg !== null ? Number(point.tempLogg) : null
          }));
        })() : [],
        accumulatedDG: (dbLogger.accumulated_dg as number) || 0,
        lastFetched: dbLogger.last_fetched ? new Date(dbLogger.last_fetched as string) : undefined,
        isRunning: (dbLogger.is_running as boolean) || false,
        startTime: dbLogger.start_time ? new Date(dbLogger.start_time as string) : undefined,
      }));
  } catch (error) {
    console.error('Error loading loggers:', error);
    return [];
  }
}

async function saveLoggerToDatabase(logger: Logger): Promise<boolean> {
  try {
    console.log('💾 Saving logger to database:', logger.name);
    const { error } = await supabase
      .from('morning_loggers')
      .upsert({
        id: logger.id,
        name: logger.name,
        lat: logger.lat,
        lng: logger.lng,
        target: logger.target,
        temp_offset: logger.offset,
        day_offset: logger.dayOffset,
        night_offset: logger.nightOffset,
        base_temp: logger.baseTemp,
        data_table: JSON.stringify(logger.dataTable),
        accumulated_dg: logger.accumulatedDG,
        last_fetched: logger.lastFetched?.toISOString(),
        is_running: logger.isRunning,
        start_time: logger.startTime?.toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Error saving logger:', error);
      return false;
    }
    console.log('✅ Successfully saved logger:', logger.name);
    return true;
  } catch (error) {
    console.error('❌ Error saving logger:', error);
    return false;
  }
}

async function deleteLoggerFromDatabase(loggerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('morning_loggers')
      .delete()
      .eq('id', loggerId);

    if (error) {
      console.error('Error deleting logger:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting logger:', error);
    return false;
  }
}

// Global settings functions for last_real_update
async function getLastRealUpdate(): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from('global_settings')
      .select('last_real_update')
      .eq('id', 'default')
      .single();

    if (error) {
      console.error('❌ Error getting last_real_update:', error);
      console.log('⚠️ global_settings table might not exist yet, returning null');
      return null;
    }

    return data?.last_real_update ? new Date(data.last_real_update) : null;
  } catch (error) {
    console.error('❌ Error getting last_real_update:', error);
    console.log('⚠️ global_settings table might not exist yet, returning null');
    return null;
  }
}

async function updateLastRealUpdate(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('global_settings')
      .upsert({
        id: 'default',
        last_real_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (error) {
      console.error('❌ Error updating last_real_update:', error);
      console.log('⚠️ global_settings table might not exist yet, skipping update');
      return false;
    }

    console.log('✅ Updated last_real_update to:', new Date().toISOString());
    return true;
  } catch (error) {
    console.error('❌ Error updating last_real_update:', error);
    console.log('⚠️ global_settings table might not exist yet, skipping update');
    return false;
  }
}

/** ===== Helpers ===== **/
function floorToHour(d: Date) {
  const x = new Date(d);
  x.setMinutes(0, 0, 0);
  return x;
}

function fmtTick(d: Date | string) {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("no-NO", {
    weekday: "short",
    hour: "2-digit",
  });
}

// Hjelpefunksjon for å finne riktig offset basert på klokkeslett
function getOffsetForTime(time: Date, dayOffset: number, nightOffset: number): number {
  const hour = time.getHours();
  // Dag: 10:00-19:59 (kl 10-20)
  // Natt: 20:00-09:59 (kl 20-10)
  if (hour >= 10 && hour < 20) {
    return dayOffset;
  } else {
    return nightOffset;
  }
}

/** ===== Open-Meteo fetchers ===== **/


// Forecast: filtrer til >= nåværende hele time (WeatherAPI.com for mørningslogg)
async function fetchForecast(lat: number, lon: number): Promise<Point[]> {
  const url = `https://api.weatherapi.com/v1/forecast.json?key=a38ce2793c8946aebd2195626250109&q=${lat},${lon}&days=7&aqi=no`;
  console.log(`🌍 [fetchForecast] Calling WeatherAPI.com: ${url}`);
  
  const res = await fetch(url);
  console.log(`🌍 [fetchForecast] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ [fetchForecast] API error: ${res.status} ${res.statusText}`, errorText);
    throw new Error(`Kunne ikke hente værdata fra WeatherAPI.com: ${res.status} ${res.statusText}`);
  }
  
  const data = await res.json();
  console.log(`✅ [fetchForecast] Successfully fetched data with ${data.forecast?.forecastday?.length || 0} forecast days`);

  if (!data.forecast || !data.forecast.forecastday) {
    throw new Error("Ugyldig data-struktur fra WeatherAPI.com");
  }

  const raw: Point[] = [];
  const today = new Date();
  

  // Process each forecast day
  data.forecast.forecastday.forEach((forecastDay: { date: string; hour?: Array<{ time: string; temp_c: number }> }) => {
    if (forecastDay.hour) {
      forecastDay.hour.forEach((hour: { time: string; temp_c: number }) => {
        try {
          // WeatherAPI.com returns hour.time as "2025-08-31 00:00" format
          // We need to extract just the time part (HH:MM)
          let timeString;
          if (hour.time.includes(' ')) {
            // If hour.time contains space, extract just the time part
            const timePart = hour.time.split(' ')[1]; // Get "00:00" part
            timeString = `${forecastDay.date}T${timePart}`;
          } else {
            // If hour.time is just "00:00", use it directly
            timeString = `${forecastDay.date}T${hour.time}`;
          }
          
          const hourTime = new Date(timeString);
          
          // Debug: log the time parsing
          if (!isNaN(hourTime.getTime())) {
            console.log(`🔍 [Forecast] Parsing time: "${timeString}" -> ${hourTime.toISOString()}, valid: true`);
            raw.push({
              time: hourTime,
              temp: hour.temp_c,
            });
          } else {
            console.error(`❌ [Forecast] Invalid time format: "${timeString}" from hour:`, hour);
          }
        } catch (error) {
          console.error(`❌ [Forecast] Error parsing time for hour:`, hour, 'Error:', error);
        }
      });
    }
  });

  const nowHour = floorToHour(new Date());
  // behold kun punkter fra denne timen og framover
  return raw.filter((p) => p.time >= nowHour);
}



// New function to fetch today's data (including past hours) - WeatherAPI.com for mørningslogg
async function fetchTodayData(lat: number, lon: number, specificDate?: Date): Promise<Point[]> {
  const targetDate = specificDate || new Date();
  const dateStr = targetDate.toISOString().slice(0, 10);
  
  const url = `https://api.weatherapi.com/v1/forecast.json?key=a38ce2793c8946aebd2195626250109&q=${lat},${lon}&days=1&aqi=no`;
  console.log(`🌍 [fetchTodayData] Calling WeatherAPI.com: ${url}`);
  
  const res = await fetch(url);
  console.log(`🌍 [fetchTodayData] Response status: ${res.status} ${res.statusText}`);
  
  if (!res.ok) {
    const errorText = await res.text();
    console.error(`❌ [fetchTodayData] API error: ${res.status} ${res.statusText}`, errorText);
    throw new Error("Kunne ikke hente dagens værdata fra WeatherAPI.com");
  }
  
  const data = await res.json();
  console.log(`✅ [fetchTodayData] Successfully fetched data with ${data.forecast?.forecastday?.length || 0} forecast days`);

  if (!data.forecast || !data.forecast.forecastday || data.forecast.forecastday.length === 0) {
    throw new Error("Ugyldig data-struktur fra WeatherAPI.com");
  }

  const forecastDay = data.forecast.forecastday[0];
  if (!forecastDay.hour) {
    throw new Error("Ingen timebaserte data fra WeatherAPI.com");
  }

  const raw: Point[] = forecastDay.hour.map((hour: { time: string; temp_c: number }) => {
    try {
      // WeatherAPI.com returns hour.time as "2025-08-31 00:00" format
      // We need to extract just the time part (HH:MM)
      let timeString;
      if (hour.time.includes(' ')) {
        // If hour.time contains space, extract just the time part
        const timePart = hour.time.split(' ')[1]; // Get "00:00" part
        timeString = `${dateStr}T${timePart}`;
      } else {
        // If hour.time is just "00:00", use it directly
        timeString = `${dateStr}T${hour.time}`;
      }
      
      const parsedTime = new Date(timeString);
      
      // Debug: log the time parsing
      if (!isNaN(parsedTime.getTime())) {
        console.log(`🔍 [Today] Parsing time: "${timeString}" -> ${parsedTime.toISOString()}, valid: true`);
        return {
          time: parsedTime,
          temp: hour.temp_c,
        };
      } else {
        console.error(`❌ [Today] Invalid time format: "${timeString}" from hour:`, hour);
        return null;
      }
    } catch (error) {
      console.error(`❌ [Today] Error parsing time for hour:`, hour, 'Error:', error);
      return null;
    }
  }).filter(Boolean); // Remove null entries

  // Return all of the target date's data (including past hours)
  return raw.filter((p) => {
    const pointDate = new Date(p.time);
    pointDate.setHours(0, 0, 0, 0);
    return pointDate.getTime() === targetDate.getTime();
  });
}

// Cache for API calls to avoid rate limiting
const apiCache = new Map<string, { data: Point[], timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hour cache
const API_RATE_LIMIT = 1000; // 1 second between API calls
let lastApiCall = 0;

// New function to fetch real temperature data based on last_real_update
async function fetchRealTemperatureData(lat: number, lon: number, loggerStartTime?: Date): Promise<Point[]> {
  try {
    console.log('🔄 Fetching real temperature data...');
    
    // Get last_real_update from database
    const lastRealUpdate = await getLastRealUpdate();
    const now = new Date();
    
    // Determine the start time for historical data
    // If we have a logger start time, use that as the minimum
    // Otherwise use last_real_update or 24 hours back
    let from: Date;
    
    if (loggerStartTime) {
      // Use logger start time as the earliest point
      from = loggerStartTime;
      console.log(`📅 Using logger start time as from: ${from.toISOString()}`);
    } else if (lastRealUpdate) {
      from = lastRealUpdate;
      console.log(`📅 Using last_real_update as from: ${from.toISOString()}`);
    } else {
      // Fallback to 24 hours back
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      console.log(`📅 No last_real_update found, using 24 hours back: ${from.toISOString()}`);
    }
    
    console.log(`📅 Current time: ${now.toISOString()}`);
    
    // With WeatherAPI.com, we can fetch historical data up to the previous hour
    
    const temperatureData: Point[] = [];
    
    // With WeatherAPI.com, we can fetch historical data up to the previous hour
    // So we fetch from start time up to the previous hour
    const previousHour = new Date(now);
    previousHour.setHours(previousHour.getHours() - 1, 59, 59, 999);
    
    if (from < previousHour) {
      console.log(`📅 Fetching historical data from ${from.toISOString()} to ${previousHour.toISOString()}`);
      
      const historicalData = await fetchHistory(lat, lon, from, previousHour);
      temperatureData.push(...historicalData);
      console.log(`✅ Fetched ${historicalData.length} historical temperature points`);
    } else {
      console.log(`📅 Logger started too recently (${from.toISOString()}), no historical data needed`);
    }
    
    // Get today's data (including past hours) to fill any remaining gaps
    console.log(`📅 Fetching today's data to fill remaining gaps`);
    
    const todayData = await fetchTodayData(lat, lon);
    
    // Include data up to and including current hour to avoid gaps
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);
    const filteredTodayData = todayData.filter(point => point.time <= currentHour);
    
    console.log(`📅 Current time: ${now.toISOString()}, Current hour: ${currentHour.toISOString()}`);
    console.log(`📊 Today's data points: ${todayData.length}, Filtered to current hour: ${filteredTodayData.length}`);
    
    temperatureData.push(...filteredTodayData);
    console.log(`✅ Fetched ${filteredTodayData.length} today's temperature points`);
    
    console.log(`✅ Total: ${temperatureData.length} temperature points from ${from.toISOString()} to ${now.toISOString()}`);
    
    return temperatureData;
  } catch (error) {
    console.error('❌ Error fetching real temperature data:', error);
    throw error;
  }
}



// Henter historiske data fra WeatherAPI.com for mørningslogg (støtter data opp til noen timer siden)
async function fetchHistory(
  lat: number,
  lon: number,
  from: Date,
  to: Date
): Promise<Point[]> {
  try {
    const cacheKey = `weatherapi_${lat},${lon},${from.toISOString().slice(0, 10)},${to.toISOString().slice(0, 10)}`;
    const now = Date.now();
    
    // Check cache first
    const cached = apiCache.get(cacheKey);
    console.log(`🔍 Checking WeatherAPI cache for key: ${cacheKey}`);
    console.log(`🔍 Cache hit: ${cached ? 'YES' : 'NO'}, age: ${cached ? Math.round((now - cached.timestamp) / 1000 / 60) : 'N/A'} minutes`);
    
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`📦 Using cached WeatherAPI data for: ${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}`);
      return cached.data;
    }
    
    // Rate limiting: wait if we called API too recently
    const timeSinceLastCall = now - lastApiCall;
    if (timeSinceLastCall < API_RATE_LIMIT) {
      const waitTime = API_RATE_LIMIT - timeSinceLastCall;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before WeatherAPI call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    lastApiCall = Date.now();
    
    // WeatherAPI.com supports historical data up to a few hours ago
    const points: Point[] = [];
    const currentDate = new Date(from);
    
    while (currentDate <= to) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      const url = `https://api.weatherapi.com/v1/history.json?key=a38ce2793c8946aebd2195626250109&q=${lat},${lon}&dt=${dateStr}`;
      
      console.log(`🌍 Fetching historical data from WeatherAPI.com for date: ${dateStr}`);
      
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`❌ WeatherAPI.com error for ${dateStr}: ${res.status} ${res.statusText}`);
        // Continue with next date instead of failing completely
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      const data = await res.json();
      
      if (!data.forecast || !data.forecast.forecastday || data.forecast.forecastday.length === 0) {
        console.error(`❌ Invalid data structure from WeatherAPI.com for ${dateStr}:`, data);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      const forecastDay = data.forecast.forecastday[0];
      if (!forecastDay.hour) {
        console.error(`❌ No hourly data from WeatherAPI.com for ${dateStr}`);
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
      
      // Extract hourly temperature data
      const hourlyData = forecastDay.hour.map((hour: { time: string; temp_c: number }) => {
        try {
          // WeatherAPI.com returns hour.time as "2025-08-31 00:00" format
          // We need to extract just the time part (HH:MM)
          let timeString;
          if (hour.time.includes(' ')) {
            // If hour.time contains space, extract just the time part
            const timePart = hour.time.split(' ')[1]; // Get "00:00" part
            timeString = `${dateStr}T${timePart}`;
          } else {
            // If hour.time is just "00:00", use it directly
            timeString = `${dateStr}T${hour.time}`;
          }
          
          const parsedTime = new Date(timeString);
          
          // Debug: log the time parsing
          if (!isNaN(parsedTime.getTime())) {
            console.log(`🔍 Parsing time: "${timeString}" -> ${parsedTime.toISOString()}, valid: true`);
            return {
              time: parsedTime,
              temp: hour.temp_c,
            };
          } else {
            console.error(`❌ Invalid time format: "${timeString}" from hour:`, hour);
            return null;
          }
        } catch (error) {
          console.error(`❌ Error parsing time for hour:`, hour, 'Error:', error);
          return null;
        }
      }).filter(Boolean); // Remove null entries
      
      points.push(...hourlyData);
      console.log(`✅ Fetched ${hourlyData.length} valid temperature points for ${dateStr}`);
      
      // Move to next date
      currentDate.setDate(currentDate.getDate() + 1);
      
      // Small delay to be respectful to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Cache the result
    apiCache.set(cacheKey, { data: points, timestamp: now });
    
    console.log(`✅ Successfully fetched ${points.length} total historical temperature points from WeatherAPI.com`);
    return points;
  } catch (error) {
    console.error('❌ Error fetching historical data from WeatherAPI.com:', error);
    throw error;
  }
}



// Henter temperatur for en spesifikk tid (for akselerert tid) - WeatherAPI.com for mørningslogg
async function fetchTempForTime(
  lat: number,
  lon: number,
  time: Date
): Promise<number | null> {
  // Bruk forecast API fra WeatherAPI.com
  const url = `https://api.weatherapi.com/v1/forecast.json?key=a38ce2793c8946aebd2195626250109&q=${lat},${lon}&days=7&aqi=no`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  if (!data.forecast || !data.forecast.forecastday) {
    return null;
  }

  // Finn temperaturen for den spesifikke timen
  const targetHour = time.getHours();
  const targetDate = time.toISOString().slice(0, 10);
  
  for (const forecastDay of data.forecast.forecastday) {
    if (forecastDay.date === targetDate && forecastDay.hour) {
      for (const hour of forecastDay.hour) {
        const hourTime = new Date(`${forecastDay.date}T${hour.time}`);
        if (hourTime.getHours() === targetHour) {
          return hour.temp_c;
        }
      }
    }
  }
  return null;
}

/** ===== Estimator ===== **/


// These functions will be defined inside the component to access state

export default function ImprovedMorningTab() {
  const [loggers, setLoggers] = useState<Logger[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  
  const [customStartTime, setCustomStartTime] = useState<string>("");

  // Load loggers from database on component mount and periodically
  useEffect(() => {
    async function loadLoggers() {
      console.log('🔄 Loading loggers from database...');
      setLoading(true);
      
      // Test connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        console.log('⚠️ Skipping database operations due to connection failure, falling back to localStorage');
        const localStorageLoggers = loadLoggersFromLocalStorage();
        setLoggers(localStorageLoggers);
        saveLoggersToLocalStorage(localStorageLoggers); // Save to localStorage as fallback
      } else {
        const dbLoggers = await loadLoggersFromDatabase();
        
        // Oppdater lastFetched for kjørende logger som har gammel lastFetched
        const updatedLoggers = dbLoggers.map(logger => {
          if (logger.isRunning && logger.lastFetched) {
            const hoursSinceLastFetch = (new Date().getTime() - logger.lastFetched.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastFetch > 24) {
              console.log(`🔄 Logger ${logger.name} was running but lastFetched is ${hoursSinceLastFetch.toFixed(1)} hours old, updating...`);
              return {
                ...logger,
                lastFetched: new Date(new Date().getTime() - 60 * 60 * 1000) // 1 time tilbake
              };
            }
          }
          return logger;
        });
        
        setLoggers(updatedLoggers);
        saveLoggersToLocalStorage(updatedLoggers); // Save to localStorage as fallback
      }
      setLoading(false);
      console.log('✅ Component loaded, loggers state updated');
    }
    
    // Load immediately
    loadLoggers();
  }, []);

  // Auto-save loggers to database when they change
  useEffect(() => {
    if (loggers.length > 0) {
      console.log('💾 Auto-saving loggers to database...');
      const saveAllLoggers = async () => {
        for (const logger of loggers) {
          await saveLoggerToDatabase(logger);
        }
        console.log('✅ All loggers auto-saved to database');
      };
      saveAllLoggers();
    }
  }, [loggers]);
  
  // New function to update real temperature data for all running loggers
  const updateRealTemperatureData = useCallback(async (): Promise<boolean> => {
    try {
      console.log('🔄 Updating real temperature data for all running loggers...');
      
      // Get all running loggers
      const runningLoggers = loggers.filter(logger => logger.isRunning);
      
      if (runningLoggers.length === 0) {
        console.log('ℹ️ No running loggers found, skipping update');
        return true;
      }
      
      console.log(`📊 Found ${runningLoggers.length} running loggers`);
      
      // Use the first logger's location (all loggers share same lat/lng)
      const firstLogger = runningLoggers[0];
      const lat = firstLogger.lat;
      const lon = firstLogger.lng;
      
      console.log(`📍 Using location: ${lat}, ${lon} for all loggers`);
      
      // Fetch real temperature data based on logger start time
      // Use the earliest start time among all running loggers
      const earliestStartTime = runningLoggers.reduce((earliest, logger) => {
        if (!logger.startTime) return earliest;
        if (!earliest) return logger.startTime;
        return logger.startTime < earliest ? logger.startTime : earliest;
      }, null as Date | null);
      
      const temperatureData = await fetchRealTemperatureData(lat, lon, earliestStartTime || undefined);
      
      if (temperatureData.length === 0) {
        console.log('⚠️ No temperature data received, skipping update');
        return false;
      }
      
      console.log(`🌡️ Received ${temperatureData.length} temperature points`);
      
      // Create temperature map for efficient lookup
      const tempMap = new Map<number, number>();
      temperatureData.forEach(point => {
        const hourKey = floorToHour(point.time).getTime();
        tempMap.set(hourKey, point.temp);
      });
      
      // Update all running loggers with the same temperature data
      const updatedLoggers = loggers.map(logger => {
        if (!logger.isRunning) {
          return logger; // Skip non-running loggers
        }
        
        console.log(`🔄 Updating logger: ${logger.name}`);
        
        // Only update tempLogg for points that don't already have historical data
        // This prevents overwriting historical data that was already set in createDataTableOnStart
        const updatedDataTable = logger.dataTable.map(point => {
          const hourKey = floorToHour(point.timestamp).getTime();
          if (tempMap.has(hourKey) && point.tempLogg === null) {
            // Only update if tempLogg is null (meaning it's forecast data that needs real data)
            return {
              ...point,
              tempLogg: tempMap.get(hourKey)!
            };
          }
          return point;
        });
        
        return {
          ...logger,
          dataTable: updatedDataTable,
          lastFetched: new Date() // Update lastFetched for this logger
        };
      });
      
      // Update state
      setLoggers(updatedLoggers);
      
      // Save all updated loggers to database
      for (const logger of updatedLoggers) {
        if (logger.isRunning) {
          await saveLoggerToDatabase(logger);
        }
      }
      
      // Update last_real_update in database AFTER successful update
      const updateSuccess = await updateLastRealUpdate();
      
      if (updateSuccess) {
        console.log('✅ Successfully updated real temperature data for all running loggers');
        return true;
      } else {
        console.error('❌ Failed to update last_real_update in database');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Error updating real temperature data:', error);
      return false;
    }
  }, [loggers, setLoggers]);



  // Legacy function for backward compatibility (now calls the new function)
  // const refreshRealLog = async (logger: Logger): Promise<Logger> => {
  //   console.log(`🔄 [refreshRealLog] Called for logger ${logger.name} - redirecting to new updateRealTemperatureData function`);
    
  //   // Call the new function to update all running loggers
  //   const success = await updateRealTemperatureData();
    
  //   if (success) {
  //     // Return the updated logger from the current state
  //     const updatedLogger = loggers.find(l => l.id === logger.id);
  //     return updatedLogger || logger;
  //   } else {
  //     // Return original logger if update failed
  //     return logger;
  //   }
  // };
  
  useEffect(() => {
    console.log('🔄 useEffect triggered - loading:', loading, 'loggers.length:', loggers.length);
    if (!loading) {
      if (loggers.length > 0) {
        const saveAllLoggers = async () => {
          console.log('💾 Saving all loggers to database...');
          for (const logger of loggers) {
            await saveLoggerToDatabase(logger);
          }
          console.log('✅ All loggers saved to database');
        };
        saveAllLoggers();
        saveLoggersToLocalStorage(loggers); // Also save to localStorage
      } else {
        console.log('📝 No loggers to save (empty array)');
      }
    }
  }, [loggers, loading]);

  return (
    <section>
      <h2 style={{ fontSize: 24, marginBottom: 16, color: "#333" }}>
        🥩 Forbedret Mørning
      </h2>

      <div style={{ marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center' }}>
        <button
          onClick={() => setShowAdd((v) => !v)}
          style={{
            padding: "12px 24px",
            borderRadius: 8,
            background: "#e0eaff",
            border: "1px solid #b2d8b2",
            fontSize: 16,
            cursor: "pointer",
            fontWeight: "bold",
          }}
        >
          ➕ Legg til ny mørningslogg
        </button>
        

      </div>

      {showAdd && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (newName.trim()) {
              setLoggers((l) => [
                ...l,
                {
                  id: Date.now() + Math.random() + "",
                  name: newName.trim(),
                  lat: 59.91, // Elghytta coordinates
                  lng: 10.75,
                  target: 40,
                  offset: 0,
                  dayOffset: 0,
                  nightOffset: 0,
                  baseTemp: 3,
                  dataTable: [],
                  accumulatedDG: 0,
                  isRunning: false,
                  startTime: customStartTime ? new Date(customStartTime) : undefined,
                },
              ]);
              setNewName("");
              setCustomStartTime("");
              setShowAdd(false);
            }
          }}
          style={{
            marginBottom: 20,
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Navn på mørningslogg"
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #bbb",
              fontSize: 16,
              width: 200,
            }}
            required
          />
          <input
            type="datetime-local"
            value={customStartTime}
            onChange={(e) => setCustomStartTime(e.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              border: "1px solid #bbb",
              fontSize: 16,
              width: 250,
            }}
          />
          <button
            type="submit"
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#e0ffe0",
              border: "1px solid #b2d8b2",
              fontSize: 15,
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ✅ Opprett
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setNewName("");
              setCustomStartTime("");
            }}
            style={{
              padding: "10px 20px",
              borderRadius: 8,
              background: "#ffe0e0",
              border: "1px solid #d8b2b2",
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            ❌ Avbryt
          </button>
        </form>
      )}



      {loggers.length === 0 && (
        <div
          style={{
            color: "#888",
            marginBottom: 12,
            textAlign: "center",
            padding: 40,
            background: "#f9f9f9",
            borderRadius: 8,
            border: "1px dashed #ccc",
          }}
        >
          📝 Ingen mørningslogger opprettet ennå.
        </div>
      )}

      {loggers.map((logger) => (
        <LoggerCard 
          key={logger.id} 
          logger={logger} 
          setLoggers={setLoggers}
          updateRealTemperatureData={updateRealTemperatureData}
        />
      ))}
    </section>
  );
}

function LoggerCard({
  logger,
  setLoggers,
  updateRealTemperatureData,
}: {
  logger: Logger;
  setLoggers: React.Dispatch<React.SetStateAction<Logger[]>>;
  updateRealTemperatureData: () => Promise<boolean>;
}) {
  const [estimatedFinish, setEstimatedFinish] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);



  // Opprett dataTable når loggeren starter (startTime settes) eller når dataTable mangler
  useEffect(() => {
    console.log(`🔍 [useEffect] Checking logger ${logger.name}: startTime=${logger.startTime}, dataTable.length=${logger.dataTable?.length || 0}`);
    console.log(`🔍 [useEffect] Full logger object:`, logger);
    
    if (!logger.startTime) {
      console.log(`❌ [useEffect] No startTime for logger ${logger.name}, skipping`);
      return; // Kun hvis vi har startTime
    }
    
    // Sjekk om dataTable mangler eller er tom
    if (logger.dataTable && logger.dataTable.length > 0) {
      console.log(`✅ [useEffect] dataTable already exists for logger ${logger.name} with ${logger.dataTable.length} points, skipping`);
      return; // dataTable eksisterer allerede
    }
    
    console.log(`🔄 [useEffect] Creating dataTable for logger ${logger.name} (startTime exists but dataTable is missing/empty)`);
    
    async function createDataTableOnStart() {
      setLoading(true);
      try {
        console.log(`🎯 [createDataTableOnStart] Target: ${logger.target} DG, StartTime: ${logger.startTime}`);
        
        const dataTable: DataPoint[] = [];
        
        // Determine if this is a new logger (started today) or existing logger (started before today)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const startDate = new Date(logger.startTime!);
        startDate.setHours(0, 0, 0, 0);
        
        const isNewLogger = startDate >= today;
        console.log(`📅 Logger started: ${startDate.toISOString().slice(0, 10)}, Today: ${today.toISOString().slice(0, 10)}, Is new logger: ${isNewLogger}`);
        
        if (isNewLogger) {
          // For new loggers (started today), combine today's data + forecast data
          console.log('🆕 New logger - combining today\'s data + forecast data');
          
          // Get today's data (including past hours)
          let todayData: Point[] = [];
          try {
            console.log(`🔍 [fetchTodayData] Starting API call for lat: ${logger.lat}, lon: ${logger.lng}`);
            todayData = await fetchTodayData(logger.lat, logger.lng);
            console.log('✅ Today\'s data for new logger:', todayData.length, 'points');
          } catch (error) {
            console.error('❌ Error fetching today\'s data:', error);
            console.error('❌ Error details:', {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : 'No stack trace',
              lat: logger.lat,
              lon: logger.lng
            });
            todayData = [];
          }
          
          // Get forecast data (future hours)
          let forecast: Point[] = [];
          try {
            console.log(`🔍 [fetchForecast] Starting API call for lat: ${logger.lat}, lon: ${logger.lng}`);
            forecast = await fetchForecast(logger.lat, logger.lng);
            console.log('✅ Forecast data for new logger:', forecast.length, 'points');
          } catch (error) {
            console.error('❌ Error fetching forecast data:', error);
            console.error('❌ Error details:', {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : 'No stack trace',
              lat: logger.lat,
              lon: logger.lng
            });
            forecast = [];
          }
          
          // Combine today's data and forecast data
          const allData = [...todayData, ...forecast];
          console.log('Combined data for new logger:', allData.length, 'total points');
          
          // Calculate estimated finish time
          let cumDG = 0;
          let estimatedFinish: Date | undefined;
          let targetReached = false;
          let hoursAfterTarget = 0;
          
          console.log(`🔍 [createDataTableOnStart] Starting DG calculation for target: ${logger.target} DG`);
          console.log(`🔍 [createDataTableOnStart] baseTemp: ${logger.baseTemp}, dayOffset: ${logger.dayOffset}, nightOffset: ${logger.nightOffset}`);
          
          for (const point of allData) {
            if (point.time >= logger.startTime!) {
              const periodOffset = getOffsetForTime(point.time, logger.dayOffset, logger.nightOffset);
              const adjustedTemp = point.temp + periodOffset;
              const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
              const oldCumDG = cumDG;
              cumDG += dgHour / 24;
              
              if (point.time.getTime() % (60 * 60 * 1000) === 0) { // Log every hour
                console.log(`🔍 [createDataTableOnStart] ${point.time.toLocaleString()}: temp=${point.temp}°C, offset=${periodOffset}°C, adjusted=${adjustedTemp}°C, dgHour=${dgHour.toFixed(3)} DG, cumDG: ${oldCumDG.toFixed(3)} → ${cumDG.toFixed(3)} DG`);
              }
            }
            
            if (!targetReached && cumDG >= logger.target) {
              targetReached = true;
              estimatedFinish = point.time;
              console.log(`🎯 [createDataTableOnStart] Target ${logger.target} DG reached at ${point.time.toLocaleString()}, cumDG: ${cumDG.toFixed(2)}`);
            }
            
            if (targetReached) {
              hoursAfterTarget++;
              if (hoursAfterTarget >= 12) break;
            }
          }
          
          console.log(`🔍 [createDataTableOnStart] Final cumDG: ${cumDG.toFixed(3)} DG, target: ${logger.target} DG, targetReached: ${targetReached}`);
          
          // Create dataTable with combined data
          allData.forEach(point => {
            const runtime = Math.floor((point.time.getTime() - logger.startTime!.getTime()) / (1000 * 60 * 60));
            
            if (estimatedFinish && point.time > new Date(estimatedFinish.getTime() + 12 * 60 * 60 * 1000)) {
              return;
            }
            
            // Determine if this is historical data, today's data, or forecast data
            const now = new Date();
            const currentHour = new Date(now);
            currentHour.setMinutes(0, 0, 0);
            const pointDate = new Date(point.time);
            pointDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const isHistorical = pointDate.getTime() < today.getTime();
            const isTodayData = pointDate.getTime() === today.getTime() && point.time <= currentHour;
    
            
            // For new loggers, we want to show forecast data for future hours to enable DG estimation
            // So we'll use tempEst for future hours and tempLogg for past/current hours
            // But we need to be more generous with what we consider "forecast" data
            const isFutureHour = point.time > currentHour;
            
            // Ensure runtime is valid for DG calculation
            const validRuntime = point.time >= logger.startTime! ? Math.max(0, runtime) : 0;
            
            dataTable.push({
              timestamp: floorToHour(point.time),
              runtime: validRuntime,
              tempEst: isFutureHour ? point.temp : null, // All future hours have tempEst for DG estimation
              tempLogg: (isHistorical || isTodayData) ? point.temp : null // Historical and today's data has tempLogg
            });
          });
          
          setEstimatedFinish(estimatedFinish);
        } else {
          // For existing loggers (started before today), combine historical + forecast data
          console.log('📊 Existing logger - combining historical + forecast data');
          
          // Get historical data from start time to yesterday
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          yesterday.setHours(23, 59, 59, 999);
          
          let historicalData: Point[] = [];
          try {
            console.log(`🔍 [fetchHistory] Starting API call for lat: ${logger.lat}, lon: ${logger.lng}, from: ${logger.startTime!.toISOString()}, to: ${yesterday.toISOString()}`);
            historicalData = await fetchHistory(logger.lat, logger.lng, logger.startTime!, yesterday);
            console.log(`✅ Historical data: ${historicalData.length} points from ${logger.startTime!.toISOString()} to ${yesterday.toISOString()}`);
          } catch (error) {
            console.error('❌ Error fetching historical data:', error);
            console.error('❌ Error details:', {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : 'No stack trace',
              lat: logger.lat,
              lon: logger.lng,
              from: logger.startTime!.toISOString(),
              to: yesterday.toISOString()
            });
            historicalData = [];
          }
          
          // Get forecast data from today onwards
          let forecast: Point[] = [];
          try {
            console.log(`🔍 [fetchForecast] Starting API call for lat: ${logger.lat}, lon: ${logger.lng}`);
            forecast = await fetchForecast(logger.lat, logger.lng);
            console.log(`✅ Forecast data: ${forecast.length} points from today onwards`);
          } catch (error) {
            console.error('❌ Error fetching forecast data:', error);
            console.error('❌ Error details:', {
              message: error instanceof Error ? error.message : 'Unknown error',
              stack: error instanceof Error ? error.stack : 'No stack trace',
              lat: logger.lat,
              lon: logger.lng
            });
            forecast = [];
          }
          
          // Combine historical and forecast data
          const allData = [...historicalData, ...forecast];
          console.log(`📊 Combined data: ${allData.length} total points`);
          
          // Calculate estimated finish time using combined data
          let cumDG = 0;
          let estimatedFinish: Date | undefined;
          let targetReached = false;
          let hoursAfterTarget = 0;
          
          console.log(`🔍 [createDataTableOnStart] Starting DG calculation for target: ${logger.target} DG`);
          console.log(`🔍 [createDataTableOnStart] baseTemp: ${logger.baseTemp}, dayOffset: ${logger.dayOffset}, nightOffset: ${logger.nightOffset}`);
          
          for (const point of allData) {
            if (point.time >= logger.startTime!) {
              const periodOffset = getOffsetForTime(point.time, logger.dayOffset, logger.nightOffset);
              const adjustedTemp = point.temp + periodOffset;
              const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
              const oldCumDG = cumDG;
              cumDG += dgHour / 24;
              
              if (point.time.getTime() % (60 * 60 * 1000) === 0) { // Log every hour
                console.log(`🔍 [createDataTableOnStart] ${point.time.toLocaleString()}: temp=${point.temp}°C, offset=${periodOffset}°C, adjusted=${adjustedTemp}°C, dgHour=${dgHour.toFixed(3)} DG, cumDG: ${oldCumDG.toFixed(3)} → ${cumDG.toFixed(3)} DG`);
              }
            }
            
            if (!targetReached && cumDG >= logger.target) {
              targetReached = true;
              estimatedFinish = point.time;
              console.log(`🎯 [createDataTableOnStart] Target ${logger.target} DG reached at ${point.time.toLocaleString()}, cumDG: ${cumDG.toFixed(2)}`);
            }
            
            if (targetReached) {
              hoursAfterTarget++;
              if (hoursAfterTarget >= 12) break;
            }
          }
          
          console.log(`🔍 [createDataTableOnStart] Final cumDG: ${cumDG.toFixed(3)} DG, target: ${logger.target} DG, targetReached: ${targetReached}`);
          
          // Create dataTable with combined data
          allData.forEach(point => {
            const runtime = Math.floor((point.time.getTime() - logger.startTime!.getTime()) / (1000 * 60 * 60));
            
            if (estimatedFinish && point.time > new Date(estimatedFinish.getTime() + 12 * 60 * 60 * 1000)) {
              return;
            }
            
            // Determine if this is historical or forecast data
            const isHistorical = point.time <= yesterday;
            const now = new Date();
            const currentHour = new Date(now);
            currentHour.setMinutes(0, 0, 0);
            const isFutureHour = point.time > currentHour;
            
            // For historical data, we need to handle runtime differently
            // Historical data should show tempLogg for past hours, tempEst for future hours
            // But we need to ensure runtime is valid for DG calculation
            const validRuntime = point.time >= logger.startTime! ? Math.max(0, runtime) : 0;
            
            dataTable.push({
              timestamp: floorToHour(point.time),
              runtime: validRuntime,
              tempEst: isFutureHour ? point.temp : null, // All future hours have tempEst for DG estimation
              tempLogg: isHistorical ? point.temp : null // Historical data has tempLogg
            });
          });
          
          setEstimatedFinish(estimatedFinish);
        }
        
        // Calculate total accumulated DG from historical data
        let totalAccumulatedDG = 0;
        for (const point of dataTable) {
          if (point.tempLogg !== null && point.timestamp >= logger.startTime!) {
            const periodOffset = getOffsetForTime(point.timestamp, logger.dayOffset, logger.nightOffset);
            const adjustedTemp = point.tempLogg + periodOffset;
            const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
            totalAccumulatedDG += dgHour / 24;
          }
        }
        
        console.log(`📊 [createDataTableOnStart] Total accumulated DG from historical data: ${totalAccumulatedDG.toFixed(2)}`);
        
        // Update logger with new dataTable and accumulated DG
        const updatedLogger = {
          ...logger,
          dataTable: dataTable,
          accumulatedDG: totalAccumulatedDG
        };
        
        // Update logger with new dataTable
        setLoggers(loggers => loggers.map(l => l.id === logger.id ? updatedLogger : l));
        
        console.log(`✅ [createDataTableOnStart] Successfully created dataTable with ${dataTable.length} points for logger ${logger.name}`);
        
      } catch (err) {
        console.error("Feil ved opprettelse av dataTable ved start:", err);
      } finally {
        setLoading(false);
      }
    }
    
    createDataTableOnStart();
  }, [logger.startTime, logger.id, logger.dataTable?.length, logger.name, logger.lat, logger.lng, logger.target, logger.dayOffset, logger.nightOffset, logger.baseTemp]);

  // Beregn estimatedFinish når dataTable endres (for eksisterende logger)
  useEffect(() => {
    if (!logger.dataTable || logger.dataTable.length === 0 || !logger.startTime) {
      return;
    }
    
    // Beregn estimatedFinish fra eksisterende dataTable
    let cumDG = 0;
    let estimatedFinish: Date | undefined;
    
    for (const point of logger.dataTable) {
      if (point.tempEst !== null && point.runtime > 0) {
        const periodOffset = getOffsetForTime(point.timestamp, logger.dayOffset, logger.nightOffset);
        const adjustedTemp = point.tempEst + periodOffset;
        const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
        cumDG += dgHour / 24;
        
        if (cumDG >= logger.target && !estimatedFinish) {
          estimatedFinish = point.timestamp;
          console.log(`🎯 [useEffect] Calculated estimatedFinish from dataTable: ${estimatedFinish.toLocaleString()}, cumDG: ${cumDG.toFixed(2)}`);
          break;
        }
      }
    }
    
    setEstimatedFinish(estimatedFinish);
  }, [logger.dataTable, logger.startTime, logger.target, logger.dayOffset, logger.nightOffset, logger.baseTemp, logger.id]);

  // Rate limiting for refreshRealLog to avoid too many API calls
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const REFRESH_COOLDOWN = 2 * 60 * 1000; // 2 minutes between refreshes (reduced from 5 minutes)

  // Oppdater reell logg hvis loggeren kjører eller har startTime (eksisterende logger)
  useEffect(() => {
    if (!logger.startTime) return; // Kun hvis vi har startTime

    console.log(`🔄 [useEffect] refreshRealLog triggered for logger ${logger.name}: startTime=${logger.startTime?.toLocaleString()}, isRunning=${logger.isRunning}, lastFetched=${logger.lastFetched?.toLocaleString() || 'null'}`);

    async function updateRealLog() {
      const now = Date.now();
      // Allow first run (when lastRefreshTime is 0) or if cooldown has passed
      if (lastRefreshTime > 0 && (now - lastRefreshTime < REFRESH_COOLDOWN)) {
        console.log(`⏳ [updateRealLog] Skipping refresh for ${logger.name} - cooldown active (${Math.round((REFRESH_COOLDOWN - (now - lastRefreshTime)) / 1000)}s remaining)`);
        return;
      }
      
      try {
        console.log(`🔄 [updateRealLog] Calling updateRealTemperatureData for ${logger.name}`);
        setLastRefreshTime(now);
        
        // Call the actual update function
        const success = await updateRealTemperatureData();
        if (success) {
          console.log(`✅ [updateRealLog] Successfully updated real temperature data for ${logger.name}`);
        } else {
          console.log(`❌ [updateRealLog] Failed to update real temperature data for ${logger.name}`);
        }
      } catch (err) {
        console.error("Feil ved oppdatering av reell logg:", err);
      }
    }

    // Kjør umiddelbart for eksisterende logger
    updateRealLog();
    
    // Sett opp interval kun hvis loggeren kjører (med lengre interval)
    if (logger.isRunning) {
      const interval = setInterval(updateRealLog, 300000); // Oppdater hvert 5. minutt i stedet for hvert minutt
      return () => clearInterval(interval);
    }
  }, [logger.isRunning, logger.id, logger.startTime, logger.dataTable?.length, lastRefreshTime, updateRealTemperatureData, logger.name]);



  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
        background: "#fafcff",
        position: "relative",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 12, fontSize: 18, color: "#333" }}>
        {logger.name}
      </h3>

      {/* Controls */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button 
          onClick={() => {
            const newIsRunning = !logger.isRunning;
            let newStartTime: Date | undefined;
            
            if (!logger.isRunning) {
              // Starting the logger
              if (logger.startTime) {
                // Use existing startTime if it's already set
                newStartTime = logger.startTime;
                console.log(`🚀 [Start Button] Using existing startTime for ${logger.name}: ${newStartTime.toLocaleString()}`);
              } else {
                // Set to current hour if no startTime
                const startTime = new Date();
                startTime.setMinutes(0, 0, 0);
                newStartTime = startTime;
                console.log(`🚀 [Start Button] Setting new startTime for ${logger.name}: ${startTime.toLocaleString()}`);
              }
            } else {
              // Pausing the logger, keep existing startTime
              newStartTime = logger.startTime;
            }
            
            console.log(`🚀 [Start Button] ${logger.name}: isRunning=${newIsRunning}, startTime=${newStartTime?.toLocaleString() || 'null'}`);
            
            setLoggers(loggers => loggers.map(x => x.id === logger.id ? { 
              ...x, 
              isRunning: newIsRunning,
              startTime: newStartTime
            } : x));
          }} 
          style={{ 
            padding: '8px 16px', 
            borderRadius: 8, 
            background: logger.isRunning ? '#ffe0e0' : '#e0ffe0', 
            border: '1px solid #b2d8b2', 
            fontSize: 16, 
            cursor: 'pointer',
            fontWeight: 'bold'
          }}
        >
          {logger.isRunning ? '⏸️ Pause' : '▶️ Start'}
        </button>

        {/* Debug: Custom Start Time */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '12px' }}>
          <span style={{ color: '#666' }}>Debug Start:</span>
          <input
            type="date"
            value={(() => {
              if (!logger.startTime) return '';
              const date = new Date(logger.startTime);
              return date.toISOString().split('T')[0];
            })()}
            onChange={(e) => {
              if (e.target.value) {
                const newDate = new Date(e.target.value);
                newDate.setHours(12, 0, 0, 0); // Sett til kl 12:00
                console.log(`🔧 [Debug] Setting custom start date for ${logger.name}: ${newDate.toLocaleString()}`);
                setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, startTime: newDate } : x));
              }
            }}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '100px'
            }}
          />
          <input
            type="time"
            value={(() => {
              if (!logger.startTime) return '12:00';
              const date = new Date(logger.startTime);
              return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
            })()}
            onChange={(e) => {
              if (e.target.value && logger.startTime) {
                const [hours, minutes] = e.target.value.split(':').map(Number);
                const newStartTime = new Date(logger.startTime);
                newStartTime.setHours(hours, minutes, 0, 0);
                console.log(`🔧 [Debug] Setting custom start time for ${logger.name}: ${newStartTime.toLocaleString()}`);
                setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, startTime: newStartTime } : x));
              }
            }}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '70px'
            }}
          />
          <button
            onClick={() => {
              // Reset to current time
              const now = new Date();
              now.setMinutes(0, 0, 0);
              console.log(`🔧 [Debug] Resetting start time to current time for ${logger.name}: ${now.toLocaleString()}`);
              setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, startTime: now } : x));
            }}
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: '#f0f0f0',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Reset
          </button>
          <button
            onClick={async () => {
              if (logger.startTime) {
                console.log(`🔄 [Debug] Regenerating dataTable for ${logger.name} with start time: ${logger.startTime.toLocaleString()}`);
                // Trigger regeneration of dataTable
                setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, dataTable: [] } : x));
                // The useEffect will automatically regenerate the dataTable
              }
            }}
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              background: '#e0f0ff',
              border: '1px solid #b2d8ff',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Regenerate dataTable with new start time"
          >
            🔄
          </button>
        </div>

        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Target DG:
          <input 
            type="number" 
            value={logger.target} 
            min={1} 
            max={100} 
            onChange={e => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, target: Number(e.target.value) } : x))} 
            style={{ 
              marginLeft: 6, 
              width: 60, 
              padding: 4, 
              borderRadius: 6, 
              border: '1px solid #ccc',
              textAlign: 'center'
            }} 
          />
        </label>
        
        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Dag offset (10-20):
          <input
            type="number"
            value={logger.dayOffset}
            min={-10}
            max={10}
            step={0.5}
            onChange={e => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, dayOffset: Number(e.target.value) } : x))}
            style={{ 
              marginLeft: 6, 
              width: 60, 
              padding: 4, 
              borderRadius: 6, 
              border: '1px solid #ccc', 
              textAlign: 'center' 
            }}
          />
        </label>
        
        <label style={{ fontSize: 15, display: 'flex', alignItems: 'center' }}>
          Natt offset (20-10):
          <input
            type="number"
            value={logger.nightOffset}
            min={-10}
            max={10}
            step={0.5}
            onChange={e => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { ...x, nightOffset: Number(e.target.value) } : x))}
            style={{ 
              marginLeft: 6, 
              width: 60, 
              padding: 4, 
              borderRadius: 6, 
              border: '1px solid #ccc', 
              textAlign: 'center' 
            }}
          />
        </label>


      </div>

      {/* Estimated Finish and Current Time */}
      <div style={{ 
        marginBottom: 12, 
        padding: '8px 12px', 
        background: '#e8f4fd', 
        borderRadius: 6, 
        border: '1px solid #b3d9ff',
        fontSize: 14,
        color: '#0066cc',
        fontWeight: 'bold',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>
          {estimatedFinish && (
            <>🎯 Estimert ferdig: {estimatedFinish.toLocaleString("no-NO", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}</>
          )}
        </span>
        <span>
          ⏰ Tid nå: {new Date().toLocaleString("no-NO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>



      {/* Plot */}
      <div
        style={{
          marginBottom: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 20,
          background: "#f8f9fa",
          minHeight: 220,
        }}
      >
        {loading ? (
          <div style={{ color: "#888", fontSize: 16 }}>⏳ Laster estimat...</div>
        ) : !logger.dataTable || logger.dataTable.length === 0 ? (
          <div style={{ color: "#888", fontSize: 16 }}>
            Ingen data tilgjengelig.
            <br />
            <small style={{ fontSize: 12, color: "#666" }}>
              Debug: dataTable={logger.dataTable ? logger.dataTable.length : 'null'}, 
              startTime={logger.startTime ? logger.startTime.toLocaleString() : 'null'},
              isRunning={logger.isRunning.toString()}
            </small>
            <br />
            <button 
              onClick={() => {
                console.log('🔍 Full logger object:', logger);
                console.log('🔍 dataTable:', logger.dataTable);
                console.log('🔍 startTime:', logger.startTime);
                console.log('🔍 Triggering createDataTableOnStart manually...');
                
                // Manually trigger the dataTable creation
                if (logger.startTime) {
                  console.log('🔍 Logger has startTime, checking why dataTable is empty...');
                  console.log('🔍 Logger lat/lng:', logger.lat, logger.lng);
                  console.log('🔍 Logger target:', logger.target);
                }
              }}
              style={{
                marginTop: 8,
                padding: '4px 8px',
                fontSize: 11,
                background: '#f0f0f0',
                border: '1px solid #ccc',
                borderRadius: 4,
                cursor: 'pointer'
              }}
            >
              Debug Logger
            </button>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart
              data={(() => {
                // Bruk dataTable for plotting
                if (!logger.dataTable || logger.dataTable.length === 0) {
                  return [];
                }

                // Beregn akkumulerte DG for hver tidspunkt
                // Start alltid på 0 DG
                let cumEstimatDG = 0;
                let cumReellDG = 0;
                
                // Først beregn total historisk DG for å vite hvor forecast skal starte
                let totalHistoricalDG = 0;
                for (const point of logger.dataTable) {
                  if (point.tempLogg !== null && point.timestamp >= logger.startTime!) {
                    const periodOffset = getOffsetForTime(point.timestamp, logger.dayOffset, logger.nightOffset);
                    const adjustedTemp = point.tempLogg + periodOffset;
                    const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
                    totalHistoricalDG += dgHour / 24;
                  }
                }
                
                console.log(`📊 Total historical DG: ${totalHistoricalDG.toFixed(2)}`);
                
                // Filter out points before startTime to ensure chart starts at the right point
                const filteredDataTable = logger.dataTable.filter(point => 
                  logger.startTime ? point.timestamp >= logger.startTime : true
                );
                
                const chartData = filteredDataTable.map(point => {
                  try {
                    // Konverter timestamp til Date hvis det er en streng
                    const timestamp = point.timestamp instanceof Date ? point.timestamp : new Date(point.timestamp);
                    
                    // Sikre at runtime er et tall
                    const runtime = Number(point.runtime) || 0;
                    
                    // Beregn estimat DG hvis vi har tempEst
                    if (point.tempEst !== null && logger.startTime) {
                      const periodOffset = getOffsetForTime(timestamp, logger.dayOffset, logger.nightOffset);
                      const adjustedTemp = point.tempEst + periodOffset;
                      const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
                      // Legg til DG for denne timen (kun hvis tidspunktet er etter start)
                      if (timestamp >= logger.startTime) {
                        cumEstimatDG += dgHour / 24;
                      }
                    }

                    // Beregn reell DG hvis vi har tempLogg
                    if (point.tempLogg !== null && logger.startTime) {
                      const periodOffset = getOffsetForTime(timestamp, logger.dayOffset, logger.nightOffset);
                      const adjustedTemp = point.tempLogg + periodOffset;
                      const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
                      // Legg til DG for denne timen (kun hvis tidspunktet er etter start)
                      if (timestamp >= logger.startTime) {
                        cumReellDG += dgHour / 24;
                      }
                    }

                    return {
                      timestamp: timestamp,
                      // Vis forecast for alle fremtidige timer (fra nåværende time og framover)
                      Estimat: (logger.startTime && timestamp >= logger.startTime && point.tempEst !== null) ? (totalHistoricalDG + cumEstimatDG) : null,
                      // Kun vis reell DG hvis vi faktisk har tempLogg data og tidspunktet er etter start
                      Reell: (logger.startTime && timestamp >= logger.startTime && point.tempLogg !== null) ? cumReellDG : null
                    };
                  } catch (error) {
                    console.error('Error processing chart data point:', error, point);
                                      return {
                    timestamp: new Date(),
                    Estimat: null,
                    Reell: null
                  };
                  }
                });

                console.log('Chart data:', chartData.length, 'points');
                console.log('First chart data point:', chartData[0]);
                
                // Debug: Sjekk om vi har reell DG data
                const reellDataPoints = chartData.filter(point => point.Reell !== null);
                console.log(`📈 Reell DG datapunkter: ${reellDataPoints.length}`);
                if (reellDataPoints.length > 0) {
                  console.log('📊 Reell DG punkter:', reellDataPoints.slice(0, 3));
                }
                
                // Debug: Sjekk estimat DG data
                const estimatDataPoints = chartData.filter(point => point.Estimat !== null);
                console.log(`🔮 Estimat DG datapunkter: ${estimatDataPoints.length}`);
                if (estimatDataPoints.length > 0) {
                  console.log('🔮 Estimat DG punkter:', estimatDataPoints.slice(0, 3));
                }
                
                // Debug: Sjekk dataTable for tempLogg data
                const tempLoggData = logger.dataTable.filter(point => point.tempLogg !== null);
                console.log(`🌡️ DataTable tempLogg datapunkter: ${tempLoggData.length}`);
                if (tempLoggData.length > 0) {
                  console.log('🌡️ TempLogg punkter:', tempLoggData.slice(0, 3).map(p => ({
                    timestamp: p.timestamp,
                    tempLogg: p.tempLogg,
                    runtime: p.runtime
                  })));
                }
                
                // Debug: Sjekk dataTable for tempEst data
                const tempEstData = logger.dataTable.filter(point => point.tempEst !== null);
                console.log(`🌡️ DataTable tempEst datapunkter: ${tempEstData.length}`);
                if (tempEstData.length > 0) {
                  console.log('🌡️ TempEst punkter:', tempEstData.slice(0, 3).map(p => ({
                    timestamp: p.timestamp,
                    tempEst: p.tempEst,
                    runtime: p.runtime
                  })));
                }
                
                // Debug: Sjekk runtime verdier
                const runtimeData = logger.dataTable.slice(0, 5).map(p => ({
                  timestamp: p.timestamp,
                  runtime: p.runtime,
                  tempEst: p.tempEst,
                  tempLogg: p.tempLogg
                }));
                console.log('🔍 Runtime debugging:', runtimeData);
                
                // Debug: Sjekk om chartData har gyldige verdier
                const validChartData = chartData.filter(point => 
                  point.Estimat !== null || point.Reell !== null
                );
                console.log(`✅ Gyldige chart datapunkter: ${validChartData.length}`);
                
                // Hvis vi ikke har gyldige data, returner en fallback
                if (validChartData.length === 0) {
                  console.warn('⚠️ Ingen gyldige chart data, returnerer fallback');
                  return [{
                    timestamp: new Date(),
                    Estimat: 0,
                    Reell: 0
                  }];
                }
                
                return chartData;
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="timestamp"
                tickFormatter={fmtTick}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(timestamp) =>
                  new Date(timestamp).toLocaleString("no-NO", {
                    weekday: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                formatter={(v: number, name: string) => [`${v.toFixed(1)} DG`, name]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="Estimat"
                stroke="#8884d8"
                strokeWidth={2}
                dot={false}
                name="Estimat"
              />
              <Line
                type="monotone"
                dataKey="Reell"
                stroke="#82ca9d"
                strokeWidth={2}
                dot={false}
                name="Reell"
              />
              <ReferenceLine
                y={logger.target}
                stroke="red"
                strokeDasharray="3 3"
                label="Target"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={async () => {
          // Delete from database first
          await deleteLoggerFromDatabase(logger.id);
          // Then remove from local state
          setLoggers((loggers) =>
            loggers.filter((x: Logger) => x.id !== logger.id)
          );
        }}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          background: "#ffe0e0",
          border: "1px solid #d8b2b2",
          borderRadius: 8,
          padding: "4px 12px",
          fontSize: 15,
          cursor: "pointer",
        }}
      >
        Slett
      </button>
    </div>
  );
}
