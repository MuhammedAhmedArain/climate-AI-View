import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Thermometer, Droplets, Wind, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';

interface ClimateData {
  region: string;
  temperature: number;
  humidity: number;
  airQuality: number;
  riskLevel: 'low' | 'moderate' | 'high' | 'critical';
  coordinates: [number, number];
}

const climateDataPoints: ClimateData[] = [
  { region: 'Lahore, Punjab', temperature: 27.5, humidity: 62, airQuality: 298, riskLevel: 'critical', coordinates: [74.3587, 31.5204] },
  { region: 'Karachi, Sindh', temperature: 28.9, humidity: 71, airQuality: 267, riskLevel: 'critical', coordinates: [67.0099, 24.8607] },
  { region: 'Islamabad, Capital', temperature: 24.3, humidity: 58, airQuality: 189, riskLevel: 'high', coordinates: [73.0479, 33.6844] },
  { region: 'Peshawar, KPK', temperature: 25.8, humidity: 55, airQuality: 223, riskLevel: 'high', coordinates: [71.5249, 34.0151] },
  { region: 'Quetta, Balochistan', temperature: 18.7, humidity: 42, airQuality: 178, riskLevel: 'high', coordinates: [66.9750, 30.1798] },
  { region: 'Faisalabad, Punjab', temperature: 28.2, humidity: 64, airQuality: 287, riskLevel: 'critical', coordinates: [73.0824, 31.4180] },
  { region: 'Multan, Punjab', temperature: 29.1, humidity: 59, airQuality: 312, riskLevel: 'critical', coordinates: [71.4708, 30.1575] },
  { region: 'Hyderabad, Sindh', temperature: 29.5, humidity: 68, airQuality: 245, riskLevel: 'critical', coordinates: [68.3578, 25.3924] },
  { region: 'Rawalpindi, Punjab', temperature: 25.6, humidity: 61, airQuality: 201, riskLevel: 'high', coordinates: [73.0169, 33.5651] },
  { region: 'Gujranwala, Punjab', temperature: 27.8, humidity: 63, airQuality: 276, riskLevel: 'critical', coordinates: [74.1883, 32.1617] },
  { region: 'Gilgit, GB', temperature: 15.2, humidity: 48, airQuality: 134, riskLevel: 'moderate', coordinates: [74.3094, 35.9208] },
  { region: 'Muzaffarabad, AJK', temperature: 20.4, humidity: 65, airQuality: 156, riskLevel: 'moderate', coordinates: [73.4709, 34.3700] },
];

export default function InteractiveClimateGlobe() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapboxToken, setMapboxToken] = useState('');
  const [isMapInitialized, setIsMapInitialized] = useState(false);
  const [selectedData, setSelectedData] = useState<ClimateData | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);

  const initializeMap = () => {
    if (!mapContainer.current || !mapboxToken) {
      toast.error('Please enter your Mapbox token first');
      return;
    }

    try {
      mapboxgl.accessToken = mapboxToken;
      
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        projection: { name: 'globe' },
        zoom: 5.5,
        center: [69.3451, 30.3753],
        pitch: 0,
      });

      map.current.addControl(
        new mapboxgl.NavigationControl({
          visualizePitch: true,
        }),
        'top-right'
      );

      map.current.on('style.load', () => {
        map.current?.setFog({
          color: 'rgb(20, 30, 50)',
          'high-color': 'rgb(30, 50, 100)',
          'horizon-blend': 0.1,
          'space-color': 'rgb(10, 15, 30)',
          'star-intensity': 0.6,
        });

        // Add climate data markers
        climateDataPoints.forEach((data) => {
          const riskColors = {
            low: '#22c55e',
            moderate: '#f59e0b',
            high: '#ef4444',
            critical: '#dc2626',
          };

          const el = document.createElement('div');
          el.className = 'climate-marker';
          el.style.width = '24px';
          el.style.height = '24px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = riskColors[data.riskLevel];
          el.style.border = '3px solid rgba(255, 255, 255, 0.8)';
          el.style.cursor = 'pointer';
          el.style.boxShadow = `0 0 20px ${riskColors[data.riskLevel]}`;
          el.style.transition = 'all 0.3s ease';
          
          el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.5)';
          });
          
          el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
          });

          const marker = new mapboxgl.Marker(el)
            .setLngLat(data.coordinates)
            .addTo(map.current!);

          el.addEventListener('click', () => {
            setSelectedData(data);
            map.current?.flyTo({
              center: data.coordinates,
              zoom: 4,
              duration: 2000,
            });
          });

          markers.current.push(marker);
        });
      });

      // Rotation animation
      let userInteracting = false;
      const secondsPerRevolution = 180;
      const maxSpinZoom = 4;

      function spinGlobe() {
        if (!map.current) return;
        
        const zoom = map.current.getZoom();
        if (!userInteracting && zoom < maxSpinZoom) {
          const distancePerSecond = 360 / secondsPerRevolution;
          const center = map.current.getCenter();
          center.lng -= distancePerSecond / 60;
          map.current.easeTo({ center, duration: 1000, easing: (n) => n });
        }
      }

      map.current.on('mousedown', () => { userInteracting = true; });
      map.current.on('mouseup', () => { userInteracting = false; spinGlobe(); });
      map.current.on('touchend', () => { userInteracting = false; spinGlobe(); });
      map.current.on('moveend', () => { spinGlobe(); });

      spinGlobe();
      setIsMapInitialized(true);
      toast.success('Globe initialized! Click on markers to see climate data');
    } catch (error) {
      toast.error('Invalid Mapbox token. Please check and try again.');
      console.error('Mapbox initialization error:', error);
    }
  };

  useEffect(() => {
    return () => {
      markers.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, []);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-success';
      case 'moderate': return 'text-warning';
      case 'high': return 'text-destructive';
      case 'critical': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {!isMapInitialized && (
        <Card className="glass-card p-6">
          <h3 className="text-lg font-semibold mb-4">Setup Required</h3>
          <p className="text-sm text-muted-foreground mb-4">
            To use the interactive globe, you need a free Mapbox account. 
            Get your public token at{' '}
            <a 
              href="https://account.mapbox.com/access-tokens/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              mapbox.com
            </a>
          </p>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Enter your Mapbox public token (pk.)"
              value={mapboxToken}
              onChange={(e) => setMapboxToken(e.target.value)}
              className="flex-1 bg-background/50"
            />
            <Button onClick={initializeMap} variant="hero">
              Initialize Globe
            </Button>
          </div>
        </Card>
      )}

      <div className="relative">
        <div 
          ref={mapContainer} 
          className="w-full h-[600px] rounded-lg shadow-2xl border border-primary/20"
          style={{ 
            background: 'linear-gradient(to bottom, rgb(10, 15, 30), rgb(20, 30, 50))',
          }}
        />
        
        {selectedData && (
          <Card className="absolute top-4 left-4 glass-card p-6 max-w-sm animate-slide-in">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-xl font-bold">{selectedData.region}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedData(null)}
                className="h-6 w-6"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Thermometer className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Temperature</p>
                  <p className="text-lg font-semibold">{selectedData.temperature}°C</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Droplets className="h-5 w-5 text-blue-400" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Humidity</p>
                  <p className="text-lg font-semibold">{selectedData.humidity}%</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Wind className="h-5 w-5 text-secondary" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Air Quality Index</p>
                  <p className="text-lg font-semibold">{selectedData.airQuality}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <AlertTriangle className={`h-5 w-5 ${getRiskColor(selectedData.riskLevel)}`} />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Risk Level</p>
                  <p className={`text-lg font-semibold capitalize ${getRiskColor(selectedData.riskLevel)}`}>
                    {selectedData.riskLevel}
                  </p>
                </div>
              </div>
            </div>
          </Card>
        )}

        {isMapInitialized && (
          <Card className="absolute bottom-4 left-4 glass-card p-4">
            <p className="text-sm font-medium mb-2">Climate Risk Levels</p>
            <div className="flex gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success" />
                <span>Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-destructive" />
                <span>High/Critical</span>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}