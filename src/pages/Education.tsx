import Navigation from '@/components/Navigation';
import { Card } from '@/components/ui/card';
import { BookOpen, Video, FileText } from 'lucide-react';

export default function Education() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/5 to-accent/5">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8 animate-slide-in text-center">
            <h1 className="text-4xl font-bold mb-2">Climate Education</h1>
            <p className="text-muted-foreground">Learn about climate change and sustainable living</p>
          </div>

          {/* Coming Soon Card */}
          <Card className="glass-card p-12 text-center animate-slide-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex justify-center gap-4 mb-6">
              <div className="p-4 rounded-full bg-primary/10 animate-float" style={{ animationDelay: '0s' }}>
                <Video className="h-8 w-8 text-primary" />
              </div>
              <div className="p-4 rounded-full bg-secondary/10 animate-float" style={{ animationDelay: '0.5s' }}>
                <BookOpen className="h-8 w-8 text-secondary" />
              </div>
              <div className="p-4 rounded-full bg-accent/10 animate-float" style={{ animationDelay: '1s' }}>
                <FileText className="h-8 w-8 text-accent" />
              </div>
            </div>
            
            <h2 className="text-2xl font-bold mb-3">Rich Educational Content Coming Soon</h2>
            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Access curated video content, interactive resources, and comprehensive guides 
              on understanding climate change and adopting sustainable practices.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              <div className="glass p-6 rounded-lg hover-lift cursor-pointer">
                <Video className="h-6 w-6 text-primary mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Video Library</h3>
                <p className="text-sm text-muted-foreground">
                  Curated educational videos with hover animations
                </p>
              </div>
              
              <div className="glass p-6 rounded-lg hover-lift cursor-pointer">
                <BookOpen className="h-6 w-6 text-secondary mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Interactive Guides</h3>
                <p className="text-sm text-muted-foreground">
                  Step-by-step resources for sustainable living
                </p>
              </div>
              
              <div className="glass p-6 rounded-lg hover-lift cursor-pointer">
                <FileText className="h-6 w-6 text-accent mb-3 mx-auto" />
                <h3 className="font-semibold mb-2">Research Papers</h3>
                <p className="text-sm text-muted-foreground">
                  Latest climate science and data analysis
                </p>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
