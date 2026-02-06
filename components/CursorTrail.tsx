import React, { useEffect, useRef } from 'react';

interface TrailParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  size: number;
}

const CursorTrail: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const particlesRef = useRef<TrailParticle[]>([]);
  const animationRef = useRef<number>();
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);
  const mouseVelRef = useRef<{ vx: number; vy: number }>({ vx: 0, vy: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      // 로직 좌표계를 CSS 픽셀과 동일하게 맞추고 고해상도만 스케일로 처리
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const handleMove = (e: MouseEvent) => {
      // 전체 화면 기준 좌표 그대로 사용해서 커서와 정확히 맞춤
      const x = e.clientX;
      const y = e.clientY;

      const last = lastMousePosRef.current;
      if (last) {
        const dx = x - last.x;
        const dy = y - last.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          mouseVelRef.current = {
            vx: dx * 0.3,
            vy: dy * 0.3,
          };
        }
      }
      lastMousePosRef.current = { x, y };

      // 마우스 위치에서 약간 뒤로 빼서 꼬리처럼 보이게
      const offsetX = -mouseVelRef.current.vx * 0.5;
      const offsetY = -mouseVelRef.current.vy * 0.5;

      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 0.3 + 0.1; // 속도 줄임
        particlesRef.current.push({
          x: x + offsetX,
          y: y + offsetY,
          vx: Math.cos(angle) * speed + mouseVelRef.current.vx * 0.2,
          vy: Math.sin(angle) * speed + mouseVelRef.current.vy * 0.2,
          life: 1,
          size: Math.random() * 1.5 + 1,
        });
      }
    };

    window.addEventListener('mousemove', handleMove);

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) {
          particlesRef.current.splice(i, 1);
          continue;
        }

        ctx.globalAlpha = p.life;
        const gradient = ctx.createRadialGradient(
          p.x,
          p.y,
          0,
          p.x,
          p.y,
          p.size * 4
        );
        gradient.addColorStop(0, 'rgba(56,189,248,0.9)');
        gradient.addColorStop(0.5, 'rgba(168,85,247,0.7)');
        gradient.addColorStop(1, 'rgba(15,23,42,0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = 1;
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMove);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
    />
  );
};

export default CursorTrail;

