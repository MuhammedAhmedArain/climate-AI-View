import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, Thermometer, Wind, TrendingUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

interface RegionItem {
  city: string;
  temperature: number | null;
  humidity: number | null;
  aqi: number | null;
  riskLevel: 'moderate' | 'high' | 'critical';
  condition: 'heat' | 'cold' | 'pollution' | 'normal';
}

interface CriticalResponse {
  updatedAt: string | null;
  regions: RegionItem[];
  pakistanStats: { avgTemp: number | null; avgAQI: number | null; maxTemp: number | null; minTemp: number | null; criticalCount: number };
}

export default function CriticalRegionsWidget() {
  const [data, setData] = useState<CriticalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const res = await apiFetch<CriticalResponse>('/api/region/critical');
        setData(res);
      } catch (e: any) {
        setError(e.message || 'Failed to load critical regions');
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const getRiskBadgeVariant = (level: string) => {
    switch (level) {
      case 'critical': return 'destructive';
      case 'high': return 'secondary';
      default: return 'default';
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical': return 'border-destructive/50 bg-destructive/5';
      case 'high': return 'border-warning/50 bg-warning/5';
      default: return 'border-primary/50 bg-primary/5';
    }
  };

  const regions = useMemo(() => {
    return (data?.regions || [])
      .slice()
      .sort((a, b) => {
        const order = { critical: 2, high: 1, moderate: 0 } as const;
        return order[b.riskLevel] - order[a.riskLevel];
      });
  }, [data]);

  return (
    <Card className="glass-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Critical Climate Regions</h2>
            <p className="text-sm text-muted-foreground">Pakistan — live via OpenWeather</p>
          </div>
        </div>
        <Badge variant="outline" className="gap-1">
          <TrendingUp className="h-3 w-3" />
          Live
        </Badge>
      </div>

      {error && (
        <div className="mb-4 text-sm text-destructive">{error}</div>
      )}

      <div className="space-y-4">
        {regions.map((region, index) => (
          <Card 
            key={region.city} 
            className={`p-4 border-2 ${getRiskColor(region.riskLevel)} hover-lift cursor-pointer transition-all animate-slide-in`}
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-semibold text-lg">{region.city}</h3>
                <Badge variant={getRiskBadgeVariant(region.riskLevel)} className="mt-1">
                  {region.riskLevel.toUpperCase()} • {region.condition}
                </Badge>
              </div>
              <div className={`p-2 rounded-full ${region.riskLevel === 'critical' ? 'bg-destructive/20 animate-pulse' : 'bg-warning/20'}`}>
                <AlertTriangle className={`h-5 w-5 ${region.riskLevel === 'critical' ? 'text-destructive' : 'text-warning'}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Thermometer className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Temperature</p>
                  <p className="text-sm font-semibold">{region.temperature ?? '—'}°C</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Wind className="h-4 w-4 text-secondary" />
                <div>
                  <p className="text-xs text-muted-foreground">Air Quality</p>
                  <p className="text-sm font-semibold">{region.aqi ?? '—'} AQI</p>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border">
        <p className="text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3 inline mr-1" />
          Data updates every 5 minutes from OpenWeather. Regions shown are prioritized by temperature and AQI severity.
        </p>
      </div>
    </Card>
  );
}