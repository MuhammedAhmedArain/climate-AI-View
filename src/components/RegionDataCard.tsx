import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface RegionDataCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  status: 'good' | 'moderate' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
  userDelta?: number | null; // contribution relative to regional baseline
  deltaUnit?: string; // optional unit for delta (%, °C, etc.)
}

export default function RegionDataCard({
  title,
  value,
  unit,
  icon: Icon,
  status,
  trend,
  userDelta = null,
  deltaUnit,
}: RegionDataCardProps) {
  const statusColors = {
    good: 'border-success/50 bg-success/5 text-success',
    moderate: 'border-primary/50 bg-primary/5 text-primary',
    warning: 'border-warning/50 bg-warning/5 text-warning',
    critical: 'border-destructive/50 bg-destructive/5 text-destructive',
  };

  const statusGlow = {
    good: 'shadow-success/20',
    moderate: 'shadow-primary/20',
    warning: 'shadow-warning/30 animate-pulse-slow',
    critical: 'shadow-destructive/40 animate-pulse-slow',
  };

  const deltaValue = userDelta ?? 0;

  return (
    <Card className={`p-6 border-2 ${statusColors[status]} ${statusGlow[status]} shadow-lg hover-lift cursor-pointer transition-all`}>
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-lg ${statusColors[status]} bg-opacity-20`}>
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <span className="text-xs font-medium px-2 py-1 rounded-full bg-background/50">
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      
      <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>
      
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      <div className="mt-2 text-sm flex items-center gap-2">
        <span className={`font-semibold ${deltaValue > 0 ? 'text-destructive' : deltaValue < 0 ? 'text-success' : 'text-muted-foreground'}`}>
          {deltaValue > 0 ? '+' : deltaValue < 0 ? '' : '±'}{Math.abs(deltaValue).toFixed(deltaValue >= 1 || deltaValue <= -1 ? 0 : 2)}{deltaUnit || ''}
        </span>
        <span className="text-muted-foreground/80">your contribution</span>
      </div>
    </Card>
  );
}