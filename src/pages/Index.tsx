import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import Earth3DBackground from '@/components/Earth3DBackground';
import { Leaf, TrendingDown, Globe2, Users } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen relative overflow-hidden">
      <Earth3DBackground opacity={0.3} />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/50 to-secondary/20" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto space-y-8 animate-slide-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Leaf className="h-16 w-16 text-primary animate-float" />
            <h1 className="text-6xl md:text-7xl font-bold bg-gradient-to-r from-primary via-primary-glow to-secondary bg-clip-text text-transparent">
              Climaiview
            </h1>
          </div>
          
          <p className="text-2xl md:text-3xl text-foreground/90 font-light">
            Track, Understand, and Reduce Your Climate Impact
          </p>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands taking action against climate change. Monitor your carbon footprint, 
            explore real-time climate data, and make informed decisions for a sustainable future.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button 
              variant="hero" 
              size="lg" 
              onClick={() => navigate('/signup')}
              className="text-lg px-8 py-6"
            >
              Get Started Free
            </Button>
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => navigate('/login')}
              className="text-lg px-8 py-6 bg-background/50 backdrop-blur-sm border-primary/30 hover:bg-primary/10"
            >
              Sign In
            </Button>
          </div>

          {/* Feature Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
            <div className="glass-card p-6 hover-lift">
              <TrendingDown className="h-12 w-12 text-primary mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">Carbon Tracking</h3>
              <p className="text-muted-foreground">
                Monitor and reduce your personal carbon footprint with detailed analytics
              </p>
            </div>

            <div className="glass-card p-6 hover-lift">
              <Globe2 className="h-12 w-12 text-secondary mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">Real-time Data</h3>
              <p className="text-muted-foreground">
                Access live climate data and regional environmental insights
              </p>
            </div>

            <div className="glass-card p-6 hover-lift">
              <Users className="h-12 w-12 text-accent mb-4 mx-auto" />
              <h3 className="text-xl font-semibold mb-2">Global Community</h3>
              <p className="text-muted-foreground">
                Connect with others committed to making a positive climate impact
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;