import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingDown, TrendingUp, Minus, Leaf, AlertCircle } from 'lucide-react';

interface ResultsSummaryProps {
  results: {
    total: number;
    breakdown: {
      travel: number;
      home: number;
      lifestyle: number;
    };
    annualTotal: number;
    comparison: {
      vsAverage: number;
      rating: 'excellent' | 'good' | 'average' | 'high' | 'very-high';
    };
  };
  onReset: () => void;
}

export default function ResultsSummary({ results, onReset }: ResultsSummaryProps) {
  const ratingConfig = {
    excellent: { color: 'bg-success', icon: Leaf, text: 'Excellent!', desc: 'Well below average' },
    good: { color: 'bg-primary', icon: TrendingDown, text: 'Good', desc: 'Below average' },
    average: { color: 'bg-warning', icon: Minus, text: 'Average', desc: 'On par with global average' },
    high: { color: 'bg-warning', icon: TrendingUp, text: 'High', desc: 'Above average' },
    'very-high': { color: 'bg-destructive', icon: AlertCircle, text: 'Very High', desc: 'Well above average' },
  };

  const config = ratingConfig[results.comparison.rating];
  const Icon = config.icon;

  const maxValue = Math.max(
    results.breakdown.travel,
    results.breakdown.home,
    results.breakdown.lifestyle
  );

  // Simple environmental equivalents and tips
  const treesPerMonthKg = 1.83; // ~22 kg/year -> ~1.83 kg/month per mature tree (rough estimate)
  const treesNeeded = Math.ceil(results.total / treesPerMonthKg);
  const tips: string[] = [];
  const most = Object.entries(results.breakdown).sort((a,b)=>b[1]-a[1])[0]?.[0];
  if (most === 'travel') tips.push('Use public transit or carpool twice a week');
  if (most === 'home') tips.push('Reduce electricity use; switch to LED and unplug idle devices');
  if (most === 'lifestyle') tips.push('Try 2 meat-free days per week and limit fast fashion');
  tips.push('Consider offsetting via verified reforestation projects');

  return (
    <div className="space-y-6 animate-slide-in">
      {/* Main Result Card */}
      <Card className="glass-card p-8 text-center">
        <div className="mb-4">
          <Badge className={`${config.color} text-white px-4 py-2 text-base`}>
            <Icon className="h-4 w-4 mr-2" />
            {config.text}
          </Badge>
        </div>

        <h2 className="text-5xl font-bold mb-2">
          {results.total.toLocaleString()}
          <span className="text-2xl text-muted-foreground ml-2">kg CO₂</span>
        </h2>
        <p className="text-xl text-muted-foreground mb-4">per month</p>

        <div className="inline-block glass p-4 rounded-lg">
          <p className="text-sm text-muted-foreground mb-1">Annual Estimate</p>
          <p className="text-3xl font-bold">
            {(results.annualTotal / 1000).toFixed(2)}
            <span className="text-lg text-muted-foreground ml-2">tons CO₂</span>
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {results.comparison.vsAverage > 0 ? (
            <TrendingUp className="h-5 w-5 text-destructive" />
          ) : results.comparison.vsAverage < 0 ? (
            <TrendingDown className="h-5 w-5 text-success" />
          ) : (
            <Minus className="h-5 w-5 text-warning" />
          )}
          <p className="text-muted-foreground">
            <span
              className={`font-semibold ${
                results.comparison.vsAverage > 0
                  ? 'text-destructive'
                  : results.comparison.vsAverage < 0
                  ? 'text-success'
                  : 'text-warning'
              }`}
            >
              {Math.abs(results.comparison.vsAverage)}%
            </span>{' '}
            {results.comparison.vsAverage > 0 ? 'above' : results.comparison.vsAverage < 0 ? 'below' : 'equal to'} global
            average
          </p>
        </div>

        <p className="text-sm text-muted-foreground mt-2">{config.desc}</p>
      </Card>

      {/* Breakdown */}
      <Card className="glass-card p-6">
        <h3 className="text-xl font-semibold mb-4">Emission Breakdown</h3>
        <div className="space-y-4">
          {[
            { key: 'travel', label: 'Travel', color: 'bg-primary' },
            { key: 'home', label: 'Home', color: 'bg-secondary' },
            { key: 'lifestyle', label: 'Lifestyle', color: 'bg-accent' },
          ].map(({ key, label, color }) => {
            const value = results.breakdown[key as keyof typeof results.breakdown];
            const percentage = (value / results.total) * 100;
            const barWidth = (value / maxValue) * 100;

            return (
              <div key={key} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{label}</span>
                  <div className="text-right">
                    <span className="font-bold">{value.toFixed(1)} kg</span>
                    <span className="text-sm text-muted-foreground ml-2">({percentage.toFixed(0)}%)</span>
                  </div>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${color} transition-all duration-1000 ease-out rounded-full`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Equivalents and Tips */}
      <Card className="glass-card p-6">
        <h3 className="text-xl font-semibold mb-4">Environmental Equivalents</h3>
        <p className="text-muted-foreground">Monthly trees needed to offset: <span className="font-bold text-primary">{treesNeeded}</span></p>
        <div className="mt-4">
          <h4 className="font-semibold mb-2">CO₂ Reduction Tips</h4>
          <ul className="list-disc pl-5 text-muted-foreground space-y-1">
            {tips.map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </div>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onReset} className="flex-1">
          Recalculate
        </Button>
        <Button variant="hero" className="flex-1">
          Get Personalized Tips
        </Button>
      </div>
    </div>
  );
}