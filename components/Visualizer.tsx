import React, { useRef, useEffect } from 'react';
import { PlaybackEvent, ThemeConfig, MorseSymbol } from '../types';

interface VisualizerProps {
  isPlaying: boolean;
  events: PlaybackEvent[];
  theme: ThemeConfig;
  audioCtxRef: React.MutableRefObject<AudioContext | null>;
  startTimeRef: React.MutableRefObject<number>;
}

// Particle System Types
interface Particle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    color: string;
}

interface Star {
    x: number;
    y: number;
    size: number;
    brightness: number;
    speed: number;
}

const Visualizer: React.FC<VisualizerProps> = ({ isPlaying, events, theme, audioCtxRef, startTimeRef }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);
  const starsRef = useRef<Star[]>([]);
  const lastActiveEventIndex = useRef<number>(-1);
  const lastCursorPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize Stars once
  useEffect(() => {
      const stars: Star[] = [];
      for(let i=0; i<100; i++) {
          stars.push({
              x: Math.random(), // 0-1 relative coords
              y: Math.random(),
              size: Math.random() * 2,
              brightness: Math.random(),
              speed: (Math.random() * 0.05 + 0.01) * (Math.random() > 0.5 ? 1 : -1)
          });
      }
      starsRef.current = stars;
  }, []);

  useEffect(() => {
    // Reset state on play/stop
    if (isPlaying) {
        lastActiveEventIndex.current = -1;
        particlesRef.current = [];
    }
  }, [isPlaying]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const render = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      
      // 1. Draw Space Background
      // Gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
      gradient.addColorStop(0, '#020617'); // Very dark blue/black
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, rect.width, rect.height);

      // Stars
      ctx.fillStyle = '#ffffff';
      starsRef.current.forEach(star => {
          // Twinkle effect
          const opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 * star.speed + star.x * 10)) * 0.7;
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.arc(star.x * rect.width, star.y * rect.height, star.size, 0, Math.PI * 2);
          ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 2. Calculate Timing
      let currentTime = 0;
      if (isPlaying && audioCtxRef.current) {
         currentTime = audioCtxRef.current.currentTime - startTimeRef.current - 0.1; 
      }

      // Drawing Constants
      const trackY = rect.height / 2;
      const speed = 200; // pixels per second moving left
      const playheadX = rect.width / 2; // Playhead in CENTER for more dramatic effect

      // Enable additive blending for "glow" look
      ctx.globalCompositeOperation = 'lighter';

      // 3. Draw Timeline (Notes)
      events.forEach((event, index) => {
        if (event.type === 'note') {
            const relativeTime = event.startTime - currentTime;
            const x = playheadX + (relativeTime * speed);
            const width = Math.max(event.duration * speed - 2, 2);
            
            // Optimization: Only draw if on screen
            if (x + width > -100 && x < rect.width + 100) {
                const isActive = currentTime >= event.startTime && currentTime <= (event.startTime + event.duration);
                
                // Color logic
                ctx.fillStyle = isActive ? '#ffffff' : theme.primaryColor;
                
                // Add intense glow if active
                if (isActive) {
                    ctx.shadowColor = theme.primaryColor;
                    ctx.shadowBlur = 30;
                } else {
                    ctx.shadowColor = theme.primaryColor;
                    ctx.shadowBlur = 5;
                }

                const height = event.symbol === MorseSymbol.DASH ? 40 : 16;
                const y = trackY - height / 2;
                
                ctx.beginPath();
                ctx.roundRect(x, y, width, height, 8);
                ctx.fill();

                // Trigger Particles on Note Start
                if (isActive && index !== lastActiveEventIndex.current) {
                    lastActiveEventIndex.current = index;
                    spawnParticles(playheadX, trackY, theme.secondaryColor, theme.primaryColor);
                }
            }
        }
      });

      // 4. Draw Particles
      updateAndDrawParticles(ctx, theme);

      // 5. Draw Playhead (Center Line)
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; // Reset shadow for line
      
      // Beautiful gradient playhead
      const lineGrad = ctx.createLinearGradient(0, 0, 0, rect.height);
      lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
      lineGrad.addColorStop(0.5, theme.primaryColor);
      lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, rect.height);
      ctx.stroke();

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, events, theme, audioCtxRef, startTimeRef]);

  // Particle Logic
  const spawnParticles = (x: number, y: number, color: string, glowColor: string, count: number = 8) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 3 + 1;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1.0,
        maxLife: 1.0,
        size: Math.random() * 3 + 1,
        color,
      });
    }
  };

  const updateAndDrawParticles = (ctx: CanvasRenderingContext2D, theme: ThemeConfig) => {
    ctx.globalCompositeOperation = 'lighter'; // Additive blending

    for (let i = particlesRef.current.length - 1; i >= 0; i--) {
      const p = particlesRef.current[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.02; // Decay

      if (p.life <= 0) {
        particlesRef.current.splice(i, 1);
        continue;
      }

      ctx.fillStyle = p.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = theme.primaryColor;
      ctx.globalAlpha = p.life;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const last = lastCursorPosRef.current;
    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 20 * 20) {
        lastCursorPosRef.current = { x, y };
        return;
      }
    }
    lastCursorPosRef.current = { x, y };

    spawnParticles(x, y, theme.secondaryColor, theme.primaryColor, 10);
  };

  return (
    <div
      className="w-full relative shadow-[0_0_60px_rgba(15,23,42,0.9)] z-0 rounded-b-3xl overflow-hidden"
      onMouseMove={handleMouseMove}
    >
        {/* Vignette Overlay for cinematic feel */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10"></div>
        <canvas 
        ref={canvasRef} 
        className="w-full h-80 bg-[#020617] block"
        style={{ touchAction: 'none' }}
        />
    </div>
  );
};

export default Visualizer;
