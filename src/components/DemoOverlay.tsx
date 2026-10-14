import { useEffect, useState } from 'react';
import type { Action } from '../state';
import { EVENTS, CLEAN_SITES } from '../data/realData';
import { applyTierActivation } from '../engine/escalate';

interface Step {
  at: number;
  caption: string;
  action?: () => void;
}

interface Props {
  active: boolean;
  dispatch: React.Dispatch<Action>;
}

const TOTAL_MS = 90000;

export function DemoOverlay({ active, dispatch }: Props) {
  const [caption, setCaption] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!active) return;
    const lakeErie = EVENTS[0];
    const toolik = CLEAN_SITES[0];
    const steps: Step[] = [
      { at: 0, caption: 'SENTINEL survey chart · cached demonstration data', action: () => dispatch({ type: 'CLOSE_RAIL' }) },
      { at: 8000, caption: 'Lake Erie HAB, July 2023 · the event the system is built around', action: () => dispatch({ type: 'SELECT_SITE', record: lakeErie }) },
      { at: 20000, caption: 'AquaSSM anomaly climbs to 0.997 — 59.3 days before the advisory' },
      { at: 30000, caption: 'Five modalities fuse · AUROC 0.939' },
      { at: 38000, caption: 'Escalate to tier 2 — query microbial source attribution', action: () => {
        dispatch({ type: 'ESCALATE' });
        setTimeout(() => dispatch({ type: 'ESCALATE' }), 1200);
        setTimeout(() => dispatch({ type: 'PATCH_RECORD', patch: applyTierActivation(lakeErie, 2) }), 1800);
      } },
      { at: 50000, caption: 'Microbial source: nutrient runoff 0.94 — lab cost spent only because cheaper modalities flagged first' },
      { at: 58000, caption: 'Escalate to tier 3 — molecular mechanism', action: () => {
        dispatch({ type: 'ESCALATE' });
        setTimeout(() => dispatch({ type: 'PATCH_RECORD', patch: applyTierActivation(lakeErie, 3) }), 800);
      } },
      { at: 65000, caption: 'AHR/CYP1A → xenobiotic metabolism → hepatotoxicity' },
      { at: 75000, caption: 'Contrast: a pristine reference site', action: () => dispatch({ type: 'SELECT_SITE', record: toolik }) },
      { at: 85000, caption: 'All MAINTAIN · 0 alerts · biological modalities left deployable' },
    ];
    const start = performance.now();
    const ids: number[] = [];
    steps.forEach((s) => {
      ids.push(window.setTimeout(() => {
        setCaption(s.caption);
        s.action?.();
      }, s.at));
    });
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      setProgress(Math.min(1, elapsed / TOTAL_MS));
      if (elapsed < TOTAL_MS) raf = requestAnimationFrame(tick);
      else dispatch({ type: 'TOGGLE_DEMO' });
    };
    raf = requestAnimationFrame(tick);
    return () => {
      ids.forEach(clearTimeout);
      cancelAnimationFrame(raf);
    };
  }, [active, dispatch]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dispatch({ type: 'TOGGLE_DEMO' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, dispatch]);

  if (!active) return null;

  return (
    <>
      <div className="tour-veil" />
      <div className="tour-caption" role="status">
        {caption}
        <div className="tour-progress">
          <div style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </>
  );
}
