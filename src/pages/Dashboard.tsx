import Navigation from '@/components/Navigation';
import RegionDataCard from '@/components/RegionDataCard';
import CriticalRegionsWidget from '@/components/CriticalRegionsWidget';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Wind, TreePine, Thermometer, Droplets, AlertTriangle, Snowflake } from 'lucide-react';
import Earth3DBackground from '@/components/Earth3DBackground';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [weather, setWeather] = useState<{ city: string; temperature: number | null; humidity: number | null; description?: string } | null>(null);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [impactKg, setImpactKg] = useState<number | null>(null);
  const [impactTrend, setImpactTrend] = useState<{ deltaPct: number; direction: 'up'|'down'|'stable' } | null>(null);
  const [indices, setIndices] = useState<{ aqi: number; forestCoverChangePct: number; temperatureAnomalyC: number; waterStressPct: number } | null>(null);
  const [series, setSeries] = useState<{ t: string | null; kg: number }[]>([]);
  const [pkStats, setPkStats] = useState<null | { avgTemp: number | null; avgAQI: number | null; maxTemp: number | null; minTemp: number | null; criticalCount: number }>(null);
  const [regionData, setRegionData] = useState<null | {
    city: string;
    region: { aqi: number; forestCoverChangePct: number; temperatureAnomalyC: number; waterStressPct: number };
    user: {
      monthlyKg: number;
      baselineMonthlyKg: number;
      ratio: number;
      contribution: {
        aqiDelta: number;
        forestDeltaPct: number;
        tempDeltaC: number;
        waterStressDeltaPct: number;
      };
    };
  }>(null);

  const fetchWeather = useCallback(async () => {
    try {
      setWeatherError(null);
      const data = await apiFetch<{ city: string; temperature: number | null; humidity: number | null; description?: string }>(
        '/api/weather'
      );
      setWeather(data);
    } catch (e: any) {
      setWeatherError(e.message || 'Failed to load weather');
    }
  }, []);

  useEffect(() => { fetchWeather(); }, [fetchWeather, user?.city]);

  const fetchImpact = useCallback(async () => {
    try {
      const imp = await apiFetch<{
        latest: { kg: number; annualTons: number; ts: string | null } | null;
        indices: { aqi: number; forestCoverChangePct: number; temperatureAnomalyC: number; waterStressPct: number } | null;
        trend: { deltaPct: number; direction: 'up'|'down'|'stable' } | null;
        history: { t: string | null; kg: number }[];
        baselineMonthlyKg: number;
      }>(
        '/api/carbon/impact'
      );
      setImpactKg(imp.latest?.kg ?? null);
      setIndices(imp.indices);
      setImpactTrend(imp.trend);
      setSeries(imp.history || []);
    } catch {
      setImpactKg(null);
      setIndices(null);
      setImpactTrend(null);
      setSeries([]);
    }
  }, []);

  const fetchRegion = useCallback(async () => {
    try {
      const data = await apiFetch<{
        city: string;
        region: { aqi: number; forestCoverChangePct: number; temperatureAnomalyC: number; waterStressPct: number };
        user: {
          monthlyKg: number;
          baselineMonthlyKg: number;
          ratio: number;
          contribution: {
            aqiDelta: number;
            forestDeltaPct: number;
            tempDeltaC: number;
            waterStressDeltaPct: number;
          };
        };
      }>(`/api/region/climate`);
      setRegionData(data);
    } catch {
      setRegionData(null);
    }
  }, []);

  const fetchCriticalStats = useCallback(async () => {
    try {
      const res = await apiFetch<{ pakistanStats: { avgTemp: number | null; avgAQI: number | null; maxTemp: number | null; minTemp: number | null; criticalCount: number } }>(`/api/region/critical`);
      setPkStats(res.pakistanStats);
    } catch {
      setPkStats(null);
    }
  }, []);

  useEffect(() => { fetchImpact(); fetchRegion(); fetchCriticalStats(); }, [fetchImpact, fetchRegion, fetchCriticalStats]);

  // Real-time update: listen for calculator completion
  useEffect(() => {
    const handler = () => { fetchImpact(); fetchRegion(); fetchCriticalStats(); };
    window.addEventListener('carbon:updated', handler);
    return () => window.removeEventListener('carbon:updated', handler);
  }, [fetchImpact, fetchRegion, fetchCriticalStats]);

  // Auto-refresh every 5 minutes for near real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      fetchImpact();
      fetchRegion();
      fetchCriticalStats();
      fetchWeather();
    }, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [fetchImpact, fetchRegion, fetchCriticalStats, fetchWeather]);

  const chartData = useMemo(() => series.map((p) => ({
    date: p.t ? new Date(p.t).toLocaleDateString() : '',
    kg: p.kg,
  })), [series]);

  const historyWithDelta = useMemo(() => {
    return series.map((p, idx) => {
      const prev = idx > 0 ? series[idx - 1].kg : null;
      let deltaPct: number | null = null;
      if (prev && prev !== 0) deltaPct = Number((((p.kg - prev) / prev) * 100).toFixed(1));
      return { t: p.t, kg: Math.round(p.kg), deltaPct };
    }).reverse(); // latest first
  }, [series]);

  return (
    <div className="min-h-screen relative">
      <Earth3DBackground opacity={0.2} />
      <div className="relative z-10">
        <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 animate-slide-in">
          <h1 className="text-4xl font-bold mb-2">Climate Dashboard</h1>
          <p className="text-muted-foreground">Real-time environmental data for your region</p>
        </div>

        {/* Climate Alert (conditional) */}
        {(() => {
          const t = weather?.temperature;
          if (t == null) return null;
          if (t >= 40) {
            return (
              <Alert className="mb-8 border-destructive bg-destructive/10 animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <AlertTitle className="text-destructive font-semibold">Heat Wave Alert</AlertTitle>
                <AlertDescription className="text-destructive/80">
                  Extreme heat detected (≥ 40°C). Stay hydrated, avoid midday sun, and check on vulnerable individuals.
                </AlertDescription>
              </Alert>
            );
          } else if (t <= 0) {
            return (
              <Alert className="mb-8 border-primary bg-primary/10 animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <Snowflake className="h-5 w-5 text-primary" />
                <AlertTitle className="text-primary font-semibold">Cold Weather Alert</AlertTitle>
                <AlertDescription className="text-primary/80">
                  Freezing conditions (≤ 0°C). Dress warmly, limit exposure, and protect pipes/plants.
                </AlertDescription>
              </Alert>
            );
          } else if (t >= 35) {
            return (
              <Alert className="mb-8 border-warning bg-warning/10 animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <AlertTriangle className="h-5 w-5 text-warning" />
                <AlertTitle className="text-warning font-semibold">Hot Conditions</AlertTitle>
                <AlertDescription className="text-warning-foreground/80">
                  High temperatures (≥ 35°C). Hydrate often and limit strenuous outdoor activity.
                </AlertDescription>
              </Alert>
            );
          } else if (t <= 5) {
            return (
              <Alert className="mb-8 border-muted bg-muted/10 animate-slide-in" style={{ animationDelay: '0.1s' }}>
                <Snowflake className="h-5 w-5 text-muted-foreground" />
                <AlertTitle className="font-semibold">Cold Conditions</AlertTitle>
                <AlertDescription className="text-muted-foreground/80">
                  Chilly weather (≤ 5°C). Layer up and keep warm when outdoors.
                </AlertDescription>
              </Alert>
            );
          }
          return null;
        })()}

        {/* Weather Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
            <h2 className="text-xl font-semibold mb-2">Current Weather{weather?.city ? ` — ${weather.city}` : ''}</h2>
            {weatherError && (
              <p className="text-destructive text-sm">{weatherError}</p>
            )}
            {!weatherError && (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-muted-foreground text-sm">Temp</div>
                  <div className="text-2xl font-bold">{weather?.temperature ?? '—'}°C</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-sm">Humidity</div>
                  <div className="text-2xl font-bold">{weather?.humidity ?? '—'}%</div>
                </div>
                <div className="col-span-3 mt-2 text-muted-foreground">
                  {weather?.description ? weather.description : '—'}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Regional Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <RegionDataCard
              title="Air Quality Index"
              value={(regionData?.region.aqi ?? indices?.aqi) ?? 0}
              icon={Wind}
              status={(regionData ? (regionData.region.aqi >= 150 ? 'critical' : regionData.region.aqi >= 100 ? 'warning' : 'moderate') : (indices ? (indices.aqi >= 150 ? 'critical' : indices.aqi >= 100 ? 'warning' : 'moderate') : 'moderate'))}
              trend={impactTrend ? (impactTrend.direction === 'up' ? 'up' : impactTrend.direction === 'down' ? 'down' : 'stable') : 'stable'}
              userDelta={regionData?.user.contribution.aqiDelta ?? null}
            />
          </div>
          
          <div className="animate-slide-in" style={{ animationDelay: '0.3s' }}>
            <RegionDataCard
              title="Forest Cover Change"
              value={(regionData?.region.forestCoverChangePct ?? indices?.forestCoverChangePct) ?? 0}
              unit="%"
              icon={TreePine}
              status={(regionData ? (regionData.region.forestCoverChangePct <= -3 ? 'critical' : regionData.region.forestCoverChangePct < 0 ? 'warning' : 'moderate') : (indices ? (indices.forestCoverChangePct <= -3 ? 'critical' : indices.forestCoverChangePct < 0 ? 'warning' : 'moderate') : 'moderate'))}
              trend={(regionData ? (regionData.region.forestCoverChangePct < 0 ? 'down' : regionData.region.forestCoverChangePct > 0 ? 'up' : 'stable') : (indices ? (indices.forestCoverChangePct < 0 ? 'down' : indices.forestCoverChangePct > 0 ? 'up' : 'stable') : 'stable'))}
              userDelta={regionData?.user.contribution.forestDeltaPct ?? null}
              deltaUnit="%"
            />
          </div>
          
          <div className="animate-slide-in" style={{ animationDelay: '0.4s' }}>
            <RegionDataCard
              title="Temperature Anomaly"
              value={(regionData?.region.temperatureAnomalyC ?? indices?.temperatureAnomalyC) ?? 0}
              unit="°C"
              icon={Thermometer}
              status={(regionData ? (regionData.region.temperatureAnomalyC >= 0.8 ? 'critical' : regionData.region.temperatureAnomalyC >= 0.5 ? 'warning' : 'moderate') : (indices ? (indices.temperatureAnomalyC >= 0.8 ? 'critical' : indices.temperatureAnomalyC >= 0.5 ? 'warning' : 'moderate') : 'moderate'))}
              trend={(regionData ? (regionData.region.temperatureAnomalyC > 0 ? 'up' : regionData.region.temperatureAnomalyC < 0 ? 'down' : 'stable') : (indices ? (indices.temperatureAnomalyC > 0 ? 'up' : indices.temperatureAnomalyC < 0 ? 'down' : 'stable') : 'stable'))}
              userDelta={regionData?.user.contribution.tempDeltaC ?? null}
              deltaUnit="°C"
            />
          </div>
          
          <div className="animate-slide-in" style={{ animationDelay: '0.5s' }}>
            <RegionDataCard
              title="Water Stress Level"
              value={(regionData?.region.waterStressPct ?? indices?.waterStressPct) ?? 0}
              unit="%"
              icon={Droplets}
              status={(regionData ? (regionData.region.waterStressPct >= 85 ? 'critical' : regionData.region.waterStressPct >= 70 ? 'warning' : 'moderate') : (indices ? (indices.waterStressPct >= 85 ? 'critical' : indices.waterStressPct >= 70 ? 'warning' : 'moderate') : 'moderate'))}
              trend={(regionData ? (regionData.region.waterStressPct > 50 ? 'up' : regionData.region.waterStressPct < 50 ? 'down' : 'stable') : (indices ? (indices.waterStressPct > 50 ? 'up' : indices.waterStressPct < 50 ? 'down' : 'stable') : 'stable'))}
              userDelta={regionData?.user.contribution.waterStressDeltaPct ?? null}
              deltaUnit="%"
            />
          </div>
        </div>

        {/* Quick Stats & Critical Regions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="glass-card p-6 animate-slide-in" style={{ animationDelay: '0.6s' }}>
            <h2 className="text-xl font-semibold mb-4">Your Impact This Month</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Carbon Footprint</span>
                <span className="text-2xl font-bold text-primary">
                  {impactKg != null ? (impactKg/1000).toFixed(2) : '—'} tons CO₂
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">vs. Last Month</span>
                <span className={`text-lg font-semibold ${impactTrend ? (impactTrend.deltaPct > 0 ? 'text-destructive' : impactTrend.deltaPct < 0 ? 'text-success' : 'text-warning') : 'text-muted-foreground'}`}>
                  {impactTrend ? `${impactTrend.deltaPct > 0 ? '+' : ''}${impactTrend.deltaPct}%` : '—'}
                </span>
              </div>
              {/* Simple spark line/mini chart */}
              {chartData.length > 1 && (
                <div className="mt-2">
                  <div className="text-sm text-muted-foreground mb-2">Monthly history (kg CO₂)</div>
                  <div style={{ height: 160 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" hide tick={{ fontSize: 10 }} />
                        <YAxis hide domain={[0, 'auto']} />
                        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(0)} kg`, 'Emissions']} />
                        <Line type="monotone" dataKey="kg" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  {/* List view of last results with deltas */}
                  <div className="mt-3 space-y-1 max-h-48 overflow-y-auto pr-1">
                    {historyWithDelta.map((row, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{row.t ? new Date(row.t).toLocaleDateString() : ''}</span>
                        <span className="font-mono">
                          {row.kg}
                          <span className={`ml-3 ${row.deltaPct == null ? 'text-muted-foreground' : row.deltaPct > 0 ? 'text-destructive' : row.deltaPct < 0 ? 'text-success' : 'text-warning'}`}>
                            {row.deltaPct == null ? '' : (row.deltaPct > 0 ? `+${row.deltaPct}%` : `${row.deltaPct}%`) }
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 animate-slide-in" style={{ animationDelay: '0.7s' }}>
            <h2 className="text-xl font-semibold mb-4">Pakistan Climate Status</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Average Temperature (PK)</span>
                <span className="text-2xl font-bold text-warning">{pkStats?.avgTemp != null ? `${pkStats.avgTemp}°C` : '—'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Average Air Quality (AQI)</span>
                <span className={`text-lg font-semibold ${pkStats?.avgAQI != null ? (pkStats.avgAQI >= 150 ? 'text-destructive' : pkStats.avgAQI >= 100 ? 'text-warning' : 'text-success') : 'text-muted-foreground'}`}>
                  {pkStats?.avgAQI != null ? pkStats.avgAQI : '—'}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm text-muted-foreground">
                <span>Extremes</span>
                <span>
                  High: {pkStats?.maxTemp != null ? `${pkStats.maxTemp}°C` : '—'} · Low: {pkStats?.minTemp != null ? `${pkStats.minTemp}°C` : '—'} · Critical regions: {pkStats?.criticalCount ?? '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="animate-slide-in" style={{ animationDelay: '0.8s' }}>
            <CriticalRegionsWidget />
          </div>
        </div>
      </main>
      </div>
    </div>
  );
}
