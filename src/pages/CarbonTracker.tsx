import { useState } from 'react';
import Navigation from '@/components/Navigation';
import ProgressStepper from '@/components/ProgressStepper';
import StepTravel from '@/components/StepTravel';
import StepHome from '@/components/StepHome';
import StepLifestyle from '@/components/StepLifestyle';
import ResultsSummary from '@/components/ResultsSummary';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Calculator } from 'lucide-react';
import {
  TravelData,
  HomeData,
  LifestyleData,
  calculateTotalEmissions,
} from '@/lib/carbonCalculator';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';

const STEPS = [
  { number: 1, title: 'Travel', description: 'Transport & commute' },
  { number: 2, title: 'Home', description: 'Energy & waste' },
  { number: 3, title: 'Lifestyle', description: 'Diet & consumption' },
];

export default function CarbonTracker() {
  const [currentStep, setCurrentStep] = useState(1);
  const [showResults, setShowResults] = useState(false);

  const [travelData, setTravelData] = useState<TravelData>({
    transport: 'car',
    vehicleType: 'petrol',
    monthlyKm: 0,
    flightFrequency: 'never',
  });

  const [homeData, setHomeData] = useState<HomeData>({
    heatingSource: 'gas',
    electricityUsage: 'medium',
    wasteRecycling: false,
    wasteBagSize: 'medium',
    wasteBagsPerWeek: 0,
  });

  const [lifestyleData, setLifestyleData] = useState<LifestyleData>({
    diet: 'balanced',
    showerFrequency: 'daily',
    newClothesMonthly: 0,
    screenTimeDaily: 0,
  });

  const [results, setResults] = useState<ReturnType<typeof calculateTotalEmissions> | null>(null);
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    // Validation
    if (currentStep === 1) {
      if ((travelData.transport === 'car' || travelData.transport === 'public') && !travelData.monthlyKm) {
        toast.error('Please enter your monthly distance');
        return;
      }
      if (travelData.transport === 'car' && !travelData.vehicleType) {
        toast.error('Please select your vehicle type');
        return;
      }
    }

    if (currentStep === 2) {
      if (!homeData.wasteBagsPerWeek) {
        toast.error('Please enter waste bags per week');
        return;
      }
    }

    if (currentStep === 3) {
      if (!lifestyleData.newClothesMonthly && lifestyleData.newClothesMonthly !== 0) {
        toast.error('Please enter new clothes per month');
        return;
      }
      if (!lifestyleData.screenTimeDaily && lifestyleData.screenTimeDaily !== 0) {
        toast.error('Please enter daily screen time');
        return;
      }
    }

    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
      toast.success(`Step ${currentStep} completed!`);
    } else {
      // Final step: call backend predictor; fallback to local calc on error
      setLoading(true);
      const payload = {
        // Flatten inputs; keys should align with your model features
        transport: travelData.transport,
        vehicleType: travelData.vehicleType,
        monthlyKm: Number(travelData.monthlyKm || 0),
        flightFrequency: travelData.flightFrequency,
        heatingSource: homeData.heatingSource,
        electricityUsage: homeData.electricityUsage,
        wasteRecycling: !!homeData.wasteRecycling,
        wasteBagSize: homeData.wasteBagSize,
        wasteBagsPerWeek: Number(homeData.wasteBagsPerWeek || 0),
        diet: lifestyleData.diet,
        showerFrequency: lifestyleData.showerFrequency,
        newClothesMonthly: Number(lifestyleData.newClothesMonthly || 0),
        screenTimeDaily: Number(lifestyleData.screenTimeDaily || 0),
      } as Record<string, any>;

      try {
        const resp = await apiFetch<{ predicted: number; saved?: boolean }>(
          '/api/carbon/predict',
          { method: 'POST', body: JSON.stringify(payload) }
        );

        // Build UI results using predicted monthly total
        const localBreakdown = calculateTotalEmissions(travelData, homeData, lifestyleData);
        const total = resp.predicted;
        const annualTotal = total * 12;
        const globalAverage = 4000;
        const vsAverage = ((annualTotal - globalAverage) / globalAverage) * 100;
        let rating: 'excellent' | 'good' | 'average' | 'high' | 'very-high';
        if (annualTotal < 2500) rating = 'excellent';
        else if (annualTotal < 3500) rating = 'good';
        else if (annualTotal < 4500) rating = 'average';
        else if (annualTotal < 6000) rating = 'high';
        else rating = 'very-high';

        setResults({
          total: Number(total.toFixed(2)),
          breakdown: localBreakdown.breakdown, // show relative sources from heuristic engine
          annualTotal: Number(annualTotal.toFixed(2)),
          comparison: { vsAverage: Number(vsAverage.toFixed(1)), rating },
        });
        setShowResults(true);
        toast.success('Prediction complete' + (resp.saved ? ' and saved' : ''));
        // Notify other views (e.g., Dashboard) to refresh impact data in real-time
        try { window.dispatchEvent(new CustomEvent('carbon:updated')); } catch {}
      } catch (err: any) {
        // Fallback to local deterministic calculator
        const calculatedResults = calculateTotalEmissions(travelData, homeData, lifestyleData);
        setResults(calculatedResults);
        setShowResults(true);
        toast.error(err?.message || 'Prediction failed; showing estimated results');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleReset = () => {
    setShowResults(false);
    setCurrentStep(1);
    setTravelData({
      transport: 'car',
      vehicleType: 'petrol',
      monthlyKm: 0,
      flightFrequency: 'never',
    });
    setHomeData({
      heatingSource: 'gas',
      electricityUsage: 'medium',
      wasteRecycling: false,
      wasteBagSize: 'medium',
      wasteBagsPerWeek: 0,
    });
    setLifestyleData({
      diet: 'balanced',
      showerFrequency: 'daily',
      newClothesMonthly: 0,
      screenTimeDaily: 0,
    });
    setResults(null);
    toast.info('Calculator reset');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-primary/5">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8 animate-slide-in text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Calculator className="h-8 w-8 text-primary" />
              <h1 className="text-4xl font-bold">Carbon Footprint Calculator</h1>
            </div>
            <p className="text-muted-foreground">Precision-driven calculation based on real-world data</p>
          </div>

          {/* Progress Stepper */}
          {!showResults && (
            <div className="mb-8">
              <ProgressStepper steps={STEPS} currentStep={currentStep} />
            </div>
          )}

          {/* Form Steps or Results */}
          <Card className="glass-card p-8">
            {!showResults ? (
              <>
                {/* Step Content */}
                <div className="min-h-[500px]">
                  {currentStep === 1 && <StepTravel data={travelData} onChange={setTravelData} />}
                  {currentStep === 2 && <StepHome data={homeData} onChange={setHomeData} />}
                  {currentStep === 3 && <StepLifestyle data={lifestyleData} onChange={setLifestyleData} />}
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-3 mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1}
                    className="flex-1"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button onClick={handleNext} variant={currentStep === 3 ? 'hero' : 'default'} className="flex-1" disabled={loading}>
                    {currentStep === 3 ? (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        {loading ? 'Calculating…' : 'Calculate'}
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              results && <ResultsSummary results={results} onReset={handleReset} />
            )}
          </Card>

          {/* Info Card */}
          {!showResults && (
            <Card className="glass-card p-4 mt-6 animate-slide-in" style={{ animationDelay: '0.3s' }}>
              <p className="text-sm text-muted-foreground text-center">
                💡 All calculations are based on verified emission factors and real-world data models to provide
                accurate environmental impact estimates.
              </p>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
