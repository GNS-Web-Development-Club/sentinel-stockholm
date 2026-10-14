import { useEffect, useRef } from 'react';
import type { Behavioral } from '../../types';
import { ModalityCard } from '../ModalityCard';

interface Props {
  bio: Behavioral;
}

export function BioMotionCard({ bio }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth * dpr;
    const H = c.clientHeight * dpr;
    c.width = W;
    c.height = H;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    const t0 = performance.now();
    const trail: { x: number; y: number }[] = [];
    const isAnom = bio.signature !== 'normal';
    const drawColor = isAnom ? 'rgba(168,50,42,0.9)' : 'rgba(47,107,58,0.9)';
    const render = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.fillStyle = 'rgba(236,231,219,0.22)';
      ctx.fillRect(0, 0, W, H);
      let cx, cy;
      if (bio.signature === 'normal') {
        cx = W * 0.3 + Math.sin(t * 1.5) * W * 0.18;
        cy = H * 0.5 + Math.cos(t * 1.5) * H * 0.32;
      } else if (bio.signature === 'convulsion') {
        cx = W * 0.5 + Math.sin(t * 8) * W * 0.25 + (Math.random() - 0.5) * W * 0.06;
        cy = H * 0.5 + Math.cos(t * 9) * H * 0.32 + (Math.random() - 0.5) * H * 0.1;
      } else {
        cx = W * 0.5 + Math.sin(t * 0.3) * W * 0.02;
        cy = H * 0.6 + Math.cos(t * 0.3) * H * 0.02;
      }
      trail.push({ x: cx, y: cy });
      if (trail.length > 60) trail.shift();
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = 1.4 * dpr;
      ctx.beginPath();
      trail.forEach((p, i) => {
        ctx.globalAlpha = i / trail.length;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 12-keypoint figure
      ctx.fillStyle = drawColor;
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * Math.PI * 2 + t * (isAnom ? 6 : 1);
        const rr = 6 * dpr + Math.sin(t * (isAnom ? 8 : 2) + i) * 2;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr, 1.4 * dpr, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(render);
    };
    // With reduced motion, draw a short static trail once instead of animating.
    if (reduced) {
      for (let k = 0; k < 40; k++) render(t0 + k * 50);
    } else {
      raf = requestAnimationFrame(render);
    }
    return () => cancelAnimationFrame(raf);
  }, [bio.signature, bio.state]);

  return (
    <ModalityCard
      name="BioMotion"
      subtitle="Denoising-diffusion one-class · Daphnia 12-keypoint"
      accentColor="var(--m-behavioral)"
      coverage={bio.state}
      conf={bio.conf}
      deployableTier={0}
      headlineMetric={<>AUROC {bio.anomaly.toFixed(3)}</>}
      headlineLabel="Behavioural anomaly"
      secondary={<span>{bio.signature.charAt(0).toUpperCase() + bio.signature.slice(1)} · lab benchmark</span>}
    >
      <canvas ref={ref} className="bio-canvas" aria-label="Daphnia trajectory" />
      <div className="note" style={{ marginTop: 4 }}>
        Near-perfect AUROC reflects controlled lab assays; fusion down-weights it in the field.
      </div>
    </ModalityCard>
  );
}
