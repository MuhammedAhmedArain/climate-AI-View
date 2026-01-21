import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Utensils, Droplets, ShoppingBag, Monitor } from 'lucide-react';
import { LifestyleData } from '@/lib/carbonCalculator';

interface StepLifestyleProps {
  data: LifestyleData;
  onChange: (data: LifestyleData) => void;
}

export default function StepLifestyle({ data, onChange }: StepLifestyleProps) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Diet */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Utensils className="h-5 w-5" />
          Dietary Preference
        </Label>
        <RadioGroup
          value={data.diet}
          onValueChange={(value) => onChange({ ...data, diet: value as LifestyleData['diet'] })}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { value: 'meat-heavy', label: 'Meat Heavy', desc: 'Meat daily', impact: 'Highest' },
              { value: 'balanced', label: 'Balanced', desc: 'Meat 3-4x/week', impact: 'High' },
              { value: 'vegetarian', label: 'Vegetarian', desc: 'No meat', impact: 'Low' },
              { value: 'vegan', label: 'Vegan', desc: 'No animal products', impact: 'Lowest' },
            ].map(({ value, label, desc, impact }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer hover-lift transition-all ${
                  data.diet === value
                    ? 'border-primary bg-primary/5 border-2'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onChange({ ...data, diet: value as LifestyleData['diet'] })}
              >
                <RadioGroupItem value={value} id={`diet-${value}`} className="sr-only" />
                <Label htmlFor={`diet-${value}`} className="cursor-pointer">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium mb-1">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-muted">{impact}</span>
                  </div>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Shower Frequency */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold flex items-center gap-2">
          <Droplets className="h-5 w-5" />
          Shower Frequency
        </Label>
        <RadioGroup
          value={data.showerFrequency}
          onValueChange={(value) => onChange({ ...data, showerFrequency: value as LifestyleData['showerFrequency'] })}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { value: 'every-other', label: 'Every Other Day' },
              { value: 'daily', label: 'Once Daily' },
              { value: 'twice-daily', label: 'Twice Daily' },
            ].map(({ value, label }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer transition-all ${
                  data.showerFrequency === value
                    ? 'border-secondary bg-secondary/5 border-2'
                    : 'border-border hover:border-secondary/50'
                }`}
                onClick={() => onChange({ ...data, showerFrequency: value as LifestyleData['showerFrequency'] })}
              >
                <RadioGroupItem value={value} id={`shower-${value}`} className="sr-only" />
                <Label htmlFor={`shower-${value}`} className="cursor-pointer text-center block">
                  <span className="font-medium">{label}</span>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Clothing Consumption */}
      <div className="space-y-3">
        <Label htmlFor="clothes" className="text-lg font-semibold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5" />
          New Clothes Per Month
        </Label>
        <Input
          id="clothes"
          type="number"
          min="0"
          max="50"
          placeholder="e.g., 2"
          value={data.newClothesMonthly || ''}
          onChange={(e) => onChange({ ...data, newClothesMonthly: Number(e.target.value) })}
          className="text-lg"
        />
        <p className="text-sm text-muted-foreground">
          Average new clothing items purchased per month (shirts, pants, etc.)
        </p>
      </div>

      {/* Screen Time */}
      <div className="space-y-3">
        <Label htmlFor="screen-time" className="text-lg font-semibold flex items-center gap-2">
          <Monitor className="h-5 w-5" />
          Daily Screen Time (hours)
        </Label>
        <Input
          id="screen-time"
          type="number"
          min="0"
          max="24"
          step="0.5"
          placeholder="e.g., 6"
          value={data.screenTimeDaily || ''}
          onChange={(e) => onChange({ ...data, screenTimeDaily: Number(e.target.value) })}
          className="text-lg"
        />
        <p className="text-sm text-muted-foreground">
          Combined TV, computer, and phone usage per day
        </p>
      </div>
    </div>
  );
}