import React, { useState, useEffect } from "react";
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
    const { data, error } = await supabase
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
        dataTable: dbLogger.data_table ? JSON.parse(dbLogger.data_table as string) : [],
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
// Forecast: filtrer til >= nåværende hele time
async function fetchForecast(lat: number, lon: number): Promise<Point[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&forecast_days=7&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunne ikke hente værdata");
  const data = await res.json();

  const raw: Point[] = data.hourly.time.map((t: string, i: number) => ({
    time: new Date(t),
    temp: data.hourly.temperature_2m[i],
  }));

  const nowHour = floorToHour(new Date());
  // behold kun punkter fra denne timen og framover
  return raw.filter((p) => p.time >= nowHour);
}

// Henter historiske data fra from → to
async function fetchHistory(
  lat: number,
  lon: number,
  from: Date,
  to: Date
): Promise<Point[]> {
  const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&start_date=${from
    .toISOString()
    .slice(0, 10)}&end_date=${to
    .toISOString()
    .slice(0, 10)}&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Kunne ikke hente historiske data");
  const data = await res.json();

  return data.hourly.time.map((t: string, i: number) => ({
    time: new Date(t),
    temp: data.hourly.temperature_2m[i],
  }));
}

// Henter temperatur for en spesifikk tid (for akselerert tid)
async function fetchTempForTime(
  lat: number,
  lon: number,
  time: Date
): Promise<number | null> {
  // Bruk forecast API i stedet for archive API for fremtidige datoer
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();

  // Finn temperaturen for den spesifikke timen
  const targetHour = time.getHours();
  const targetDate = time.toISOString().slice(0, 10);
  
  for (let i = 0; i < data.hourly.time.length; i++) {
    const dataTime = new Date(data.hourly.time[i]);
    const dataDate = dataTime.toISOString().slice(0, 10);
    if (dataDate === targetDate && dataTime.getHours() === targetHour) {
      return data.hourly.temperature_2m[i];
    }
  }
  return null;
}

/** ===== Estimator ===== **/


// Oppdaterer real logg fra sistFetched → nå
async function refreshRealLog(logger: Logger): Promise<Logger> {
  const currentTime = new Date();
  
  // Hvis loggeren ikke har startet ennå, ikke hent data
  if (!logger.isRunning) return logger;
  
  // Hvis dette er første gang (ingen lastFetched), ikke hent historiske data
  if (!logger.lastFetched) {
    console.log('First time logging - no historical data needed');
    return {
      ...logger,
      lastFetched: currentTime,
    };
  }

  // Start fra siste fetched tid
  const from = logger.lastFetched;
  if (from >= currentTime) return logger; // ingenting nytt å hente

  console.log('Fetching history from:', from, 'to:', currentTime);
  const history = await fetchHistory(logger.lat, logger.lng, from, currentTime);
  console.log('Fetched history points:', history.length);

  // Oppdater dataTable med historiske temperaturer
  const updatedDataTable = [...logger.dataTable];
  const historyMap = new Map<number, number>();
  history.forEach(h => {
    const hourKey = floorToHour(h.time).getTime();
    historyMap.set(hourKey, h.temp);
  });

  // Oppdater tempLogg for alle punkter som har historiske data
  updatedDataTable.forEach(point => {
    const hourKey = floorToHour(point.timestamp).getTime();
    if (historyMap.has(hourKey)) {
      point.tempLogg = historyMap.get(hourKey)!;
    }
  });

  return {
    ...logger,
    dataTable: updatedDataTable,
    lastFetched: currentTime,
  };
}

export default function ImprovedMorningTab() {
  const [loggers, setLoggers] = useState<Logger[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);

  // Load loggers from database on component mount
  useEffect(() => {
    async function loadLoggers() {
      console.log('🔄 Component mounted, loading loggers from database...');
      setLoading(true);
      
      // Test connection first
      const connectionOk = await testSupabaseConnection();
      if (!connectionOk) {
        console.log('⚠️ Skipping database operations due to connection failure');
        setLoading(false);
        return;
      }
      
      const dbLoggers = await loadLoggersFromDatabase();
      setLoggers(dbLoggers);
      setLoading(false);
      console.log('✅ Component loaded, loggers state updated:', dbLoggers.length, 'loggers');
    }
    loadLoggers();
  }, []);

  // Save loggers to database whenever they change
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

      <div style={{ marginBottom: 20 }}>
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
                  lat: 60.7249,
                  lng: 9.0365,
                  target: 40,
                  offset: 0,
                  dayOffset: 0,
                  nightOffset: 0,
                  baseTemp: 0,
                  dataTable: [],
                  accumulatedDG: 0,
                  isRunning: false,
                  startTime: undefined, // Settes når loggeren starter
                },
              ]);
              setNewName("");
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
        <LoggerCard key={logger.id} logger={logger} setLoggers={setLoggers} />
      ))}
    </section>
  );
}

function LoggerCard({
  logger,
  setLoggers,
}: {
  logger: Logger;
  setLoggers: React.Dispatch<React.SetStateAction<Logger[]>>;
}) {
  const [estimatedFinish, setEstimatedFinish] = useState<Date | undefined>();
  const [loading, setLoading] = useState(false);
  const [acceleratedTime, setAcceleratedTime] = useState<Date | undefined>();
  const [isAccelerating, setIsAccelerating] = useState(false);

  // Hent forecast og oppdater dataTable
  useEffect(() => {
    async function runEstimate() {
      setLoading(true);
      try {
        const forecast = await fetchForecast(logger.lat, logger.lng);
        console.log('Forecast data:', forecast.length, 'points');
        console.log('First forecast point:', forecast[0]);
        
        // Opprett dataTable fra forecast
        const startTime = logger.startTime || new Date();
        const dataTable: DataPoint[] = [];
        
        // Beregn estimert ferdig tid først
        let cumDG = 0;
        let estimatedFinish: Date | undefined;
        let targetReached = false;
        let hoursAfterTarget = 0;
        
        for (const point of forecast) {
          const periodOffset = getOffsetForTime(point.time, logger.dayOffset, logger.nightOffset);
          const adjustedTemp = point.temp + periodOffset;
          const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
          cumDG += dgHour / 24;
          
          if (!targetReached && cumDG >= logger.target) {
            targetReached = true;
            estimatedFinish = point.time;
          }
          
          // Stopp 12 timer etter target er nådd
          if (targetReached) {
            hoursAfterTarget++;
            if (hoursAfterTarget >= 12) break;
          }
        }
        
        // Opprett dataTable kun opp til estimert ferdig + 12 timer
        forecast.forEach(point => {
          const runtime = Math.floor((point.time.getTime() - startTime.getTime()) / (1000 * 60 * 60));
          
          // Stopp hvis vi har nådd 12 timer etter target
          if (estimatedFinish && point.time > new Date(estimatedFinish.getTime() + 12 * 60 * 60 * 1000)) {
            return;
          }
          
          dataTable.push({
            timestamp: point.time,
            runtime: Math.max(0, runtime), // Ikke negativ runtime
            tempEst: point.temp,
            tempLogg: null // Vil bli oppdatert når vi får historiske data
          });
        });
        
        // Oppdater logger med ny dataTable
        setLoggers(loggers => loggers.map(l => l.id === logger.id ? {
          ...l,
          dataTable: dataTable
        } : l));
        
        setEstimatedFinish(estimatedFinish);
      } catch (err) {
        console.error("Feil ved henting av forecast:", err);
      } finally {
        setLoading(false);
      }
    }
    runEstimate();
  }, [logger.lat, logger.lng, logger.baseTemp, logger.dayOffset, logger.nightOffset, logger.target, logger.startTime]);

  // Oppdater reell logg hvis loggeren kjører
  useEffect(() => {
    if (!logger.isRunning) return;

    async function updateRealLog() {
      try {
        const updated = await refreshRealLog(logger);
        setLoggers(loggers => loggers.map(l => l.id === logger.id ? updated : l));
      } catch (err) {
        console.error("Feil ved oppdatering av reell logg:", err);
      }
    }

    updateRealLog();
    const interval = setInterval(updateRealLog, 60000); // Oppdater hvert minutt
    return () => clearInterval(interval);
  }, [logger.isRunning, logger.id]);

  // Akselerert tid simulator
  useEffect(() => {
    if (!isAccelerating || !logger.isRunning || !logger.startTime) return;

    async function accelerateTime() {
      try {
        // Øk tiden med 1 time
        const currentTime = acceleratedTime || logger.startTime;
        if (!currentTime) return;
        
        const newTime = new Date(currentTime);
        newTime.setHours(newTime.getHours() + 1);
        setAcceleratedTime(newTime);

        // Hent temperatur for den nye tiden
        const temp = await fetchTempForTime(logger.lat, logger.lng, newTime);
        
        if (temp !== null) {
          console.log(`🔍 Søker etter tidspunkt: ${newTime.toLocaleString()}`);
          console.log(`📊 DataTable har ${logger.dataTable.length} punkter`);
          
          // Oppdater dataTable med ny temperatur
          setLoggers(loggers => loggers.map(l => {
            if (l.id === logger.id) {
              let foundMatch = false;
              const updatedDataTable = l.dataTable.map(point => {
                // Match tidspunkt med 1 time toleranse (for å håndtere millisekunder)
                const timeDiff = Math.abs(point.timestamp.getTime() - newTime.getTime());
                if (timeDiff < 60 * 60 * 1000) { // 1 time i millisekunder
                  console.log(`✅ MATCH! Oppdaterer tempLogg for ${point.timestamp.toLocaleString()} med ${temp}°C`);
                  foundMatch = true;
                  return { ...point, tempLogg: temp };
                }
                return point;
              });
              
              if (!foundMatch) {
                console.log(`❌ INGEN MATCH funnet for ${newTime.toLocaleString()}`);
                console.log(`🔍 Nærmeste tidspunkt i dataTable:`);
                l.dataTable.slice(0, 5).forEach((point, i) => {
                  console.log(`  ${i}: ${point.timestamp.toLocaleString()}`);
                });
              }
              
              return { ...l, dataTable: updatedDataTable };
            }
            return l;
          }));
          
          console.log(`Akselerert tid: ${newTime.toLocaleString()}, Temp: ${temp}°C`);
        }
      } catch (err) {
        console.error("Feil ved akselerert tid:", err);
      }
    }

    const interval = setInterval(accelerateTime, 2000); // Hvert 2. sekund
    return () => clearInterval(interval);
  }, [isAccelerating, logger.isRunning, logger.startTime, logger.lat, logger.lng, acceleratedTime]);

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
          onClick={() => setLoggers(loggers => loggers.map(x => x.id === logger.id ? { 
            ...x, 
            isRunning: !x.isRunning,
            startTime: !x.isRunning ? (() => {
              const startTime = new Date();
              startTime.setMinutes(0, 0, 0); // Start fra nåværende hele time (kl 13:00)
              return startTime;
            })() : x.startTime
          } : x))} 
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

        <button 
          onClick={() => {
            if (!isAccelerating) {
              setIsAccelerating(true);
              setAcceleratedTime(logger.startTime || new Date());
            } else {
              setIsAccelerating(false);
              setAcceleratedTime(undefined);
            }
          }}
          disabled={!logger.isRunning}
          style={{ 
            padding: '8px 16px', 
            borderRadius: 8, 
            background: isAccelerating ? '#ffd700' : '#f0f0f0', 
            border: '1px solid #ccc', 
            fontSize: 14, 
            cursor: logger.isRunning ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            opacity: logger.isRunning ? 1 : 0.5
          }}
        >
          {isAccelerating ? '⏩ Akselererer...' : '⏩ Akselerer tid'}
        </button>
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
          ⏰ Tid nå: {(acceleratedTime || new Date()).toLocaleString("no-NO", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          })}
          {isAccelerating && " (AKSELERERT)"}
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
                let cumEstimatDG = 0;
                let cumReellDG = 0;
                
                const chartData = logger.dataTable.map(point => {
                  // Beregn estimat DG hvis vi har tempEst
                  if (point.tempEst !== null && logger.startTime && point.runtime > 0) {
                    const periodOffset = getOffsetForTime(point.timestamp, logger.dayOffset, logger.nightOffset);
                    const adjustedTemp = point.tempEst + periodOffset;
                    const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
                    // Legg til DG for denne timen
                    cumEstimatDG += dgHour / 24;
                  }

                  // Beregn reell DG hvis vi har tempLogg
                  if (point.tempLogg !== null && logger.startTime) {
                    const periodOffset = getOffsetForTime(point.timestamp, logger.dayOffset, logger.nightOffset);
                    const adjustedTemp = point.tempLogg + periodOffset;
                    const dgHour = Math.max(0, adjustedTemp - logger.baseTemp);
                    // Legg til DG for denne timen (kun hvis runtime > 0)
                    if (point.runtime > 0) {
                      cumReellDG += dgHour / 24;
                    }
                  }

                  return {
                    time: point.timestamp,
                    Estimat: point.runtime > 0 ? cumEstimatDG : null,
                    // Kun vis reell DG hvis vi faktisk har tempLogg data
                    Reell: (point.runtime > 0 && point.tempLogg !== null) ? cumReellDG : null
                  };
                });

                console.log('Chart data:', chartData.length, 'points');
                console.log('First chart data point:', chartData[0]);
                
                // Debug: Sjekk om vi har reell DG data
                const reellDataPoints = chartData.filter(point => point.Reell !== null);
                console.log(`📈 Reell DG datapunkter: ${reellDataPoints.length}`);
                if (reellDataPoints.length > 0) {
                  console.log('📊 Reell DG punkter:', reellDataPoints.slice(0, 3));
                }
                
                return chartData;
              })()}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="time"
                tickFormatter={fmtTick}
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                labelFormatter={(v) =>
                  new Date(v).toLocaleString("no-NO", {
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
