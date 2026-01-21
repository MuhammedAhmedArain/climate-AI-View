import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Flame, Zap, Recycle, Trash2 } from 'lucide-react';
import { HomeData } from '@/lib/carbonCalculator';

interface StepHomeProps {
  data: HomeData;
  onChange: (data: HomeData) => void;
}

export default function StepHome({ data, onChange }: StepHomeProps) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Heating Source */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Heating Energy Source
        </Label>
        <RadioGroup
          value={data.heatingSource}
          onValueChange={(value) => onChange({ ...data, heatingSource: value as HomeData['heatingSource'] })}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 'gas', label: 'Natural Gas', impact: 'High' },
              { value: 'electric', label: 'Electric', impact: 'Medium' },
              { value: 'oil', label: 'Oil', impact: 'Very High' },
              { value: 'renewable', label: 'Renewable', impact: 'Low' },
            ].map(({ value, label, impact }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer hover-lift transition-all ${
                  data.heatingSource === value
                    ? 'border-primary bg-primary/5 border-2'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onChange({ ...data, heatingSource: value as HomeData['heatingSource'] })}
              >
                <RadioGroupItem value={value} id={`heat-${value}`} className="sr-only" />
                <Label htmlFor={`heat-${value}`} className="cursor-pointer">
                  <div className="text-center">
                    <p className="font-medium mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground">{impact} impact</p>
                  </div>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Electricity Usage */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Electricity Usage
        </Label>
        <RadioGroup
          value={data.electricityUsage}
          onValueChange={(value) => onChange({ ...data, electricityUsage: value as HomeData['electricityUsage'] })}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'low', label: 'Low', desc: 'Energy efficient appliances' },
              { value: 'medium', label: 'Medium', desc: 'Average household' },
              { value: 'high', label: 'High', desc: 'Multiple devices, AC/heating' },
            ].map(({ value, label, desc }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer transition-all ${
                  data.electricityUsage === value
                    ? 'border-secondary bg-secondary/5 border-2'
                    : 'border-border hover:border-secondary/50'
                }`}
                onClick={() => onChange({ ...data, electricityUsage: value as HomeData['electricityUsage'] })}
              >
                <RadioGroupItem value={value} id={`elec-${value}`} className="sr-only" />
                <Label htmlFor={`elec-${value}`} className="cursor-pointer">
                  <div className="text-center">
                    <p className="font-medium mb-1">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Recycling */}
      <div className="space-y-3">
        <div className="flex items-center justify-between glass-card p-4 rounded-lg">
          <div className="flex items-center gap-3">
            <Recycle className="h-6 w-6 text-success" />
            <div>
              <Label htmlFor="recycling" className="text-base font-semibold cursor-pointer">
                Do you recycle regularly?
              </Label>
              <p className="text-sm text-muted-foreground">Reduces waste emissions by 30%</p>
            </div>
          </div>
          <Switch
            id="recycling"
            checked={data.wasteRecycling}
            onCheckedChange={(checked) => onChange({ ...data, wasteRecycling: checked })}
          />
        </div>
      </div>

      {/* Waste Production */}
      <div className="space-y-4">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Waste Production
        </Label>

        <div className="space-y-3">
          <Label htmlFor="waste-size" className="text-base">
            Typical Waste Bag Size
          </Label>
          <RadioGroup
            value={data.wasteBagSize}
            onValueChange={(value) => onChange({ ...data, wasteBagSize: value as HomeData['wasteBagSize'] })}
          >
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'small', label: 'Small', desc: '< 20L' },
                { value: 'medium', label: 'Medium', desc: '20-50L' },
                { value: 'large', label: 'Large', desc: '> 50L' },
              ].map(({ value, label, desc }) => (
                <Card
                  key={value}
                  className={`p-3 cursor-pointer transition-all ${
                    data.wasteBagSize === value
                      ? 'border-accent bg-accent/5 border-2'
                      : 'border-border hover:border-accent/50'
                  }`}
                  onClick={() => onChange({ ...data, wasteBagSize: value as HomeData['wasteBagSize'] })}
                >
                  <RadioGroupItem value={value} id={`size-${value}`} className="sr-only" />
                  <Label htmlFor={`size-${value}`} className="cursor-pointer text-center block">
                    <p className="font-medium text-sm">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </Label>
                </Card>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <Label htmlFor="waste-bags" className="text-base">
            Waste Bags Per Week
          </Label>
          <Input
            id="waste-bags"
            type="number"
            min="0"
            max="20"
            placeholder="e.g., 2"
            value={data.wasteBagsPerWeek || ''}
            onChange={(e) => onChange({ ...data, wasteBagsPerWeek: Number(e.target.value) })}
            className="text-lg"
          />
        </div>
      </div>
    </div>
  );
}