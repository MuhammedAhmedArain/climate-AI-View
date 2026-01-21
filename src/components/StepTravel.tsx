import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Car, Bus, Bike, Footprints, Plane } from 'lucide-react';
import { TravelData } from '@/lib/carbonCalculator';

interface StepTravelProps {
  data: TravelData;
  onChange: (data: TravelData) => void;
}

export default function StepTravel({ data, onChange }: StepTravelProps) {
  return (
    <div className="space-y-6 animate-slide-in">
      {/* Transport Mode */}
      <div className="space-y-3">
        <Label className="text-lg font-semibold">Primary Transportation</Label>
        <RadioGroup
          value={data.transport}
          onValueChange={(value) => onChange({ ...data, transport: value as TravelData['transport'] })}
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: 'car', icon: Car, label: 'Car' },
              { value: 'public', icon: Bus, label: 'Public Transit' },
              { value: 'bike', icon: Bike, label: 'Bicycle' },
              { value: 'walk', icon: Footprints, label: 'Walking' },
            ].map(({ value, icon: Icon, label }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer hover-lift transition-all ${
                  data.transport === value
                    ? 'border-primary bg-primary/5 border-2'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => onChange({ ...data, transport: value as TravelData['transport'] })}
              >
                <RadioGroupItem value={value} id={value} className="sr-only" />
                <Label htmlFor={value} className="cursor-pointer flex flex-col items-center gap-2">
                  <Icon className={`h-8 w-8 ${data.transport === value ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="text-sm font-medium">{label}</span>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>

      {/* Vehicle Type (if car selected) */}
      {data.transport === 'car' && (
        <div className="space-y-3 animate-slide-in">
          <Label className="text-base font-semibold">Vehicle Type</Label>
          <RadioGroup
            value={data.vehicleType}
            onValueChange={(value) => onChange({ ...data, vehicleType: value as TravelData['vehicleType'] })}
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'petrol', label: 'Petrol' },
                { value: 'diesel', label: 'Diesel' },
                { value: 'hybrid', label: 'Hybrid' },
                { value: 'electric', label: 'Electric' },
              ].map(({ value, label }) => (
                <Card
                  key={value}
                  className={`p-3 cursor-pointer transition-all ${
                    data.vehicleType === value
                      ? 'border-secondary bg-secondary/5 border-2'
                      : 'border-border hover:border-secondary/50'
                  }`}
                  onClick={() => onChange({ ...data, vehicleType: value as TravelData['vehicleType'] })}
                >
                  <RadioGroupItem value={value} id={`vehicle-${value}`} className="sr-only" />
                  <Label htmlFor={`vehicle-${value}`} className="cursor-pointer text-center block">
                    <span className="text-sm font-medium">{label}</span>
                  </Label>
                </Card>
              ))}
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Monthly Distance */}
      {(data.transport === 'car' || data.transport === 'public') && (
        <div className="space-y-3 animate-slide-in">
          <Label htmlFor="monthly-km" className="text-base font-semibold">
            Monthly Distance (km)
          </Label>
          <Input
            id="monthly-km"
            type="number"
            min="0"
            placeholder="e.g., 500"
            value={data.monthlyKm || ''}
            onChange={(e) => onChange({ ...data, monthlyKm: Number(e.target.value) })}
            className="text-lg"
          />
          <p className="text-sm text-muted-foreground">Average commute + other trips per month</p>
        </div>
      )}

      {/* Flight Frequency */}
      <div className="space-y-3">
        <Label className="text-base font-semibold flex items-center gap-2">
          <Plane className="h-5 w-5" />
          Flight Frequency
        </Label>
        <RadioGroup
          value={data.flightFrequency}
          onValueChange={(value) => onChange({ ...data, flightFrequency: value as TravelData['flightFrequency'] })}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { value: 'never', label: 'Never', desc: 'No flights' },
              { value: 'rarely', label: 'Rarely', desc: '1-2 per year' },
              { value: 'sometimes', label: 'Sometimes', desc: '3-5 per year' },
              { value: 'frequently', label: 'Frequently', desc: '6+ per year' },
            ].map(({ value, label, desc }) => (
              <Card
                key={value}
                className={`p-4 cursor-pointer transition-all ${
                  data.flightFrequency === value
                    ? 'border-accent bg-accent/5 border-2'
                    : 'border-border hover:border-accent/50'
                }`}
                onClick={() => onChange({ ...data, flightFrequency: value as TravelData['flightFrequency'] })}
              >
                <RadioGroupItem value={value} id={`flight-${value}`} className="sr-only" />
                <Label htmlFor={`flight-${value}`} className="cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                  </div>
                </Label>
              </Card>
            ))}
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}