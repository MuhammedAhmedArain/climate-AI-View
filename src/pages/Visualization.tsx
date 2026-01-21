import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { Globe2, TrendingUp } from 'lucide-react';
import InteractiveClimateGlobe from '@/components/InteractiveClimateGlobe';
import Earth3DBackground from '@/components/Earth3DBackground';

export default function Visualization() {
  return (
    <div className="min-h-screen relative">
      <Earth3DBackground opacity={0.15} />
      <div className="relative z-10">
        <Navigation />
        
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8 animate-slide-in text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Globe2 className="h-10 w-10 text-primary animate-float" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  Interactive Climate Globe
                </h1>
              </div>
              <p className="text-muted-foreground text-lg">
                Explore real-time climate data across the world
              </p>
            </div>

            {/* Interactive Globe */}
            <div className="mb-12 animate-slide-in" style={{ animationDelay: '0.1s' }}>
              <InteractiveClimateGlobe />
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="glass-card p-6 animate-slide-in" style={{ animationDelay: '0.2s' }}>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Globe2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Interactive Exploration</h3>
                    <p className="text-sm text-muted-foreground">
                      Click on any marker to view detailed climate data for that region. 
                      The globe rotates automatically and you can zoom, pan, and explore freely.
                    </p>
                  </div>
                </div>
              </Card>

              <Card className="glass-card p-6 animate-slide-in" style={{ animationDelay: '0.3s' }}>
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-secondary/10">
                    <TrendingUp className="h-6 w-6 text-secondary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-2">Real-time Insights</h3>
                    <p className="text-sm text-muted-foreground">
                      View temperature anomalies, air quality indices, humidity levels, 
                      and risk assessments for major regions around the world.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
