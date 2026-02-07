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

// 문자별 모스 블록 색상 팔레트 (모스 코드가 바뀔 때마다 색이 바뀌도록)
const NOTE_PALETTE = [
  '#38bdf8', '#a78bfa', '#f472b6', '#34d399', '#fbbf24',
  '#60a5fa', '#c084fc', '#fb7185', '#2dd4bf', '#facc15',
  '#22d3ee', '#818cf8', '#f97316', '#4ade80', '#e879f9',
];

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

    // Handle high DPI - 컨테이너 크기에 맞춤
    const dpr = window.devicePixelRatio || 1;
    const updateSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };
    
    updateSize();
    window.addEventListener('resize', updateSize);

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      ctx.clearRect(0, 0, width, height);
      
      // 1. Draw Space Background
      // Gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#020617'); // Very dark blue/black
      gradient.addColorStop(1, '#0f172a');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Stars
      ctx.fillStyle = '#ffffff';
      starsRef.current.forEach(star => {
          // Twinkle effect
          const opacity = 0.3 + Math.abs(Math.sin(Date.now() * 0.001 * star.speed + star.x * 10)) * 0.7;
          ctx.globalAlpha = opacity;
          ctx.beginPath();
          ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2);
          ctx.fill();
      });
      ctx.globalAlpha = 1.0;

      // 2. Calculate Timing
      let currentTime = 0;
      if (isPlaying && audioCtxRef.current) {
         currentTime = audioCtxRef.current.currentTime - startTimeRef.current - 0.1; 
      }

      // 비주얼라이저 정중앙: height 비율로 좌표 계산 (고정 픽셀 대신)
      const centerY = height / 2;
      const baseSpeed = 200; // pixels per second
      // 데스크톱 큰 화면: 타임라인 전체가 보이도록 스케일 (잘림 방지). 모바일은 baseSpeed 유지.
      let totalDuration = 0;
      events.forEach((ev) => {
        if (ev.type === 'note') {
          const end = ev.startTime + ev.duration;
          if (end > totalDuration) totalDuration = end;
        }
      });
      // 플레이헤드 오른쪽 절반만 사용 → 큰 창에서도 모스 블록이 잘리지 않도록
      const rightHalf = width * 0.48;
      const speed = totalDuration > 0 && rightHalf > 0 && baseSpeed * totalDuration > rightHalf
        ? rightHalf / totalDuration
        : baseSpeed;
      const playheadX = width / 2; // Playhead in CENTER
      // 라벨·트랙 모두 height 비율로 → 작은 창에서도 중앙 부근에 유지
      const labelRadius = Math.min(80, height * 0.25);
      const trackOffsetFromCenter = height * 0.12; // 예: 60px 대신 ~12% 높이
      const labelY = centerY; // 문자 정확히 중앙
      const trackY = centerY + trackOffsetFromCenter; // 모스 타임라인은 중앙 아래(비율)
      const labelFontSize = Math.min(40, Math.max(20, height * 0.12));

      // Enable additive blending for "glow" look
      ctx.globalCompositeOperation = 'lighter';

      // 문자 순서대로 색 할당 (문자가 바뀔 때마다 아름답게 색 변경)
      const charColorMap: Record<string, string> = {};
      let colorIndex = 0;
      events.forEach((ev) => {
        const c = ev.char ?? '';
        if (c && charColorMap[c] === undefined) {
          charColorMap[c] = NOTE_PALETTE[colorIndex % NOTE_PALETTE.length];
          colorIndex++;
        }
      });

      // 3. Draw Timeline (Notes)
      events.forEach((event, index) => {
        if (event.type === 'note') {
            const relativeTime = event.startTime - currentTime;
            const x = playheadX + (relativeTime * speed);
            const noteWidth = Math.max(event.duration * speed - 2, 2);
            
            // Optimization: Only draw if on screen
            const rect = canvas.getBoundingClientRect();
            if (x + noteWidth > -100 && x < rect.width + 100) {
                const isActive = currentTime >= event.startTime && currentTime <= (event.startTime + event.duration);
                const noteColor = event.char ? (charColorMap[event.char] ?? theme.primaryColor) : theme.primaryColor;
                
                ctx.fillStyle = isActive ? '#ffffff' : noteColor;
                if (isActive) {
                    ctx.shadowColor = noteColor;
                    ctx.shadowBlur = 30;
                } else {
                    ctx.shadowColor = noteColor;
                    ctx.shadowBlur = 5;
                }

                const noteHeight = event.symbol === MorseSymbol.DASH
                  ? Math.max(16, height * 0.12)
                  : Math.max(8, height * 0.05);
                const y = trackY - noteHeight / 2;
                
                ctx.beginPath();
                ctx.roundRect(x, y, noteWidth, noteHeight, 8);
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

      // 5. Draw current character label (정확히 비주얼라이저 세로 중앙)
      const activeIndex = lastActiveEventIndex.current;
      if (activeIndex >= 0 && activeIndex < events.length) {
        const active = events[activeIndex];
        const charLabel = active.char ?? '';
        if (charLabel) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const glowGradient = ctx.createRadialGradient(
            playheadX,
            labelY,
            0,
            playheadX,
            labelY,
            labelRadius
          );
          glowGradient.addColorStop(0, theme.primaryColor.replace(')', ',0.4)').replace('rgb', 'rgba'));
          glowGradient.addColorStop(1, 'rgba(15,23,42,0)');
          ctx.fillStyle = glowGradient;
          ctx.beginPath();
          ctx.arc(playheadX, labelY, labelRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = `600 ${labelFontSize}px "Space Mono", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = theme.primaryColor;
          ctx.shadowBlur = 25;
          ctx.fillStyle = '#e5f4ff';
          ctx.fillText(charLabel, playheadX, labelY);
          ctx.restore();
        }
      }

      // 6. Draw Playhead (Center Line)
      ctx.globalCompositeOperation = 'source-over';
      ctx.shadowBlur = 0; // Reset shadow for line
      
      // Beautiful gradient playhead
      const lineGrad = ctx.createLinearGradient(0, 0, 0, height);
      lineGrad.addColorStop(0, 'rgba(255,255,255,0)');
      lineGrad.addColorStop(0.5, theme.primaryColor);
      lineGrad.addColorStop(1, 'rgba(255,255,255,0)');
      
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      requestRef.current = requestAnimationFrame(render);
    };

    requestRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateSize);
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
      className="relative w-full h-full shadow-[0_0_60px_rgba(15,23,42,0.9)] overflow-hidden"
      onMouseMove={handleMouseMove}
    >
        {/* Vignette Overlay for cinematic feel */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.4)_100%)] z-10"></div>
        <canvas 
        ref={canvasRef} 
        className="w-full h-full bg-[#020617] block"
        style={{ touchAction: 'none' }}
        />
    </div>
  );
};

export default Visualizer;
