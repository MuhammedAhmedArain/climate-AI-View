// Carbon emission calculation engine based on real-world data models
// All values in kg CO₂ per unit

interface TravelData {
  transport: 'car' | 'public' | 'bike' | 'walk';
  vehicleType?: 'petrol' | 'diesel' | 'electric' | 'hybrid';
  monthlyKm: number;
  flightFrequency: 'never' | 'rarely' | 'sometimes' | 'frequently';
}

interface HomeData {
  heatingSource: 'gas' | 'electric' | 'oil' | 'renewable';
  electricityUsage: 'low' | 'medium' | 'high';
  wasteRecycling: boolean;
  wasteBagSize: 'small' | 'medium' | 'large';
  wasteBagsPerWeek: number;
}

interface LifestyleData {
  diet: 'meat-heavy' | 'balanced' | 'vegetarian' | 'vegan';
  showerFrequency: 'daily' | 'twice-daily' | 'every-other';
  newClothesMonthly: number;
  screenTimeDaily: number;
}

// Emission factors (kg CO₂)
const EMISSION_FACTORS = {
  transport: {
    car: {
      petrol: 0.192, // per km
      diesel: 0.171,
      electric: 0.047,
      hybrid: 0.109,
    },
    public: 0.089, // per km
    bike: 0,
    walk: 0,
  },
  flights: {
    never: 0,
    rarely: 300, // per year
    sometimes: 900,
    frequently: 2400,
  },
  heating: {
    gas: 2.35, // per kWh
    electric: 0.42,
    oil: 2.96,
    renewable: 0.05,
  },
  electricity: {
    low: 150, // monthly kg CO₂
    medium: 300,
    high: 500,
  },
  waste: {
    small: 15, // per bag per week
    medium: 25,
    large: 40,
  },
  recycling: {
    multiplier: 0.7, // 30% reduction
  },
  diet: {
    'meat-heavy': 3300, // annual kg CO₂
    balanced: 2500,
    vegetarian: 1700,
    vegan: 1500,
  },
  water: {
    'twice-daily': 50, // monthly kg CO₂
    daily: 35,
    'every-other': 20,
  },
  clothing: 22, // per item
  screenTime: 0.6, // per hour daily (monthly)
};

export function calculateTravelEmissions(data: TravelData): number {
  let emissions = 0;

  // Calculate transport emissions (monthly)
  if (data.transport === 'car' && data.vehicleType) {
    emissions += data.monthlyKm * EMISSION_FACTORS.transport.car[data.vehicleType];
  } else if (data.transport === 'public') {
    emissions += data.monthlyKm * EMISSION_FACTORS.transport.public;
  }

  // Add flight emissions (monthly from annual)
  emissions += EMISSION_FACTORS.flights[data.flightFrequency] / 12;

  return Number(emissions.toFixed(2));
}

export function calculateHomeEmissions(data: HomeData): number {
  let emissions = 0;

  // Electricity usage
  emissions += EMISSION_FACTORS.electricity[data.electricityUsage];

  // Waste emissions (monthly)
  let wasteEmissions = data.wasteBagsPerWeek * 4.33 * EMISSION_FACTORS.waste[data.wasteBagSize];
  
  // Apply recycling reduction
  if (data.wasteRecycling) {
    wasteEmissions *= EMISSION_FACTORS.recycling.multiplier;
  }

  emissions += wasteEmissions;

  return Number(emissions.toFixed(2));
}

export function calculateLifestyleEmissions(data: LifestyleData): number {
  let emissions = 0;

  // Diet (monthly from annual)
  emissions += EMISSION_FACTORS.diet[data.diet] / 12;

  // Water/shower
  emissions += EMISSION_FACTORS.water[data.showerFrequency];

  // Clothing
  emissions += data.newClothesMonthly * EMISSION_FACTORS.clothing;

  // Screen time (monthly)
  emissions += data.screenTimeDaily * 30 * EMISSION_FACTORS.screenTime;

  return Number(emissions.toFixed(2));
}

export function calculateTotalEmissions(
  travel: TravelData,
  home: HomeData,
  lifestyle: LifestyleData
): {
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
} {
  const travelEmissions = calculateTravelEmissions(travel);
  const homeEmissions = calculateHomeEmissions(home);
  const lifestyleEmissions = calculateLifestyleEmissions(lifestyle);
  
  const total = travelEmissions + homeEmissions + lifestyleEmissions;
  const annualTotal = total * 12;
  
  // Global average is ~4 tons per person per year
  const globalAverage = 4000;
  const vsAverage = ((annualTotal - globalAverage) / globalAverage) * 100;
  
  let rating: 'excellent' | 'good' | 'average' | 'high' | 'very-high';
  if (annualTotal < 2500) rating = 'excellent';
  else if (annualTotal < 3500) rating = 'good';
  else if (annualTotal < 4500) rating = 'average';
  else if (annualTotal < 6000) rating = 'high';
  else rating = 'very-high';

  return {
    total: Number(total.toFixed(2)),
    breakdown: {
      travel: travelEmissions,
      home: homeEmissions,
      lifestyle: lifestyleEmissions,
    },
    annualTotal: Number(annualTotal.toFixed(2)),
    comparison: {
      vsAverage: Number(vsAverage.toFixed(1)),
      rating,
    },
  };
}

export type { TravelData, HomeData, LifestyleData };
