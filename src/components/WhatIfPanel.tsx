import { useEffect, useMemo, useState } from 'react';
import { Sliders, Cloud, CloudRain, RotateCcw, Undo2 } from 'lucide-react';
import type { CanonicalRecord, SensorParam } from '../types';
import type { Action } from '../state';

interface Props {
  record: CanonicalRecord;
  dispatch: React.Dispatch<Action>;
}

type Values = Record<SensorParam, number>;

// Slider config — each parameter, range, label, and HAB-relevance weight.
const PARAMS: { key: SensorParam; label: string; unit: string; min: number; max: number; step: number; weight: number }[] = [
  { key: 'do', label: 'Dissolved O₂', unit: 'mg/L', min: 0, max: 14, step: 0.1, weight: 1.4 },
  { key: 'ph', label: 'pH', unit: '', min: 5, max: 10, step: 0.05, weight: 1.0 },
  { key: 'turb', label: 'Turbidity', unit: 'NTU', min: 0, max: 80, step: 1, weight: 0.8 },
  { key: 'cond', label: 'Conductivity', unit: 'µS/cm', min: 0, max: 2500, step: 25, weight: 1.1 },
  { key: 'temp', label: 'Temperature', unit: '°C', min: 0, max: 35, step: 0.5, weight: 1.0 },
];

const SCENARIOS: { name: string; icon: React.ReactNode; deltas: Partial<Values> }[] = [
  { name: 'Drought', icon: <Cloud size={14} strokeWidth={1.75} />, deltas: { do: -2, ph: 0.4, turb: -3, cond: 400, temp: 4, orp: -10 } },
  { name: 'Heavy rain', icon: <CloudRain size={14} strokeWidth={1.75} />, deltas: { do: -1, ph: -0.3, turb: 25, cond: -200, temp: -2, orp: 0 } },
];

export function WhatIfPanel({ record, dispatch }: Props) {
  // Baseline = mean of the last 8 samples (treated as the "current" reading).
  const baseline = useMemo(() => {
    const out: Values = { do: 0, ph: 0, turb: 0, cond: 0, temp: 0, orp: 0 };
    (Object.keys(out) as SensorParam[]).forEach((k) => {
      const v = record.sensor.series[k];
      if (!v || v.length === 0) return;
      const tail = v.slice(-8);
      out[k] = tail.reduce((s, x) => s + x, 0) / tail.length;
    });
    return out;
  }, [record.sensor.series]);

  const [values, setValues] = useState<Values>(baseline);
  // Undo history: last ≤16 snapshots before the current one.
  const [history, setHistory] = useState<Values[]>([]);

  // Reset when the underlying record changes (state adjusted during render, no effect needed).
  const [seenBaseline, setSeenBaseline] = useState(baseline);
  if (seenBaseline !== baseline) {
    setSeenBaseline(baseline);
    setValues(baseline);
    setHistory([]);
  }

  const commitChange = (updater: (cur: Values) => Values) => {
    setHistory((h) => [...h.slice(-15), values]);
    setValues(updater(values));
  };

  const undo = () => {
    if (history.length === 0) return;
    setValues(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  };
  const histLen = history.length;

  // Forward model — weighted normalised distance from baseline.
  const anomaly = useMemo(() => {
    let sum = 0;
    let totalWeight = 0;
    for (const p of PARAMS) {
      const range = p.max - p.min;
      const dev = Math.abs(values[p.key] - baseline[p.key]) / range;
      sum += Math.min(1, dev * 2.4) * p.weight;
      totalWeight += p.weight;
    }
    return Math.min(0.999, sum / Math.max(0.0001, totalWeight));
  }, [values, baseline]);

  // Push the simulated anomaly back into the record so the sheet updates live.
  useEffect(() => {
    const alert =
      anomaly > 0.85 ? 'ALERT'
      : anomaly > 0.65 ? 'INVESTIGATE'
      : anomaly > 0.4 ? 'WATCH'
      : 'MAINTAIN';
    dispatch({
      type: 'PATCH_RECORD',
      patch: {
        sensor: { ...record.sensor, anomaly: Math.max(record.sensor.anomaly * 0.4, anomaly) },
        fusion: { ...record.fusion, anomaly, alert },
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anomaly, dispatch]);

  const apply = (deltas: Partial<Values>) => {
    commitChange((cur) => {
      const next = { ...cur };
      (Object.keys(deltas) as SensorParam[]).forEach((k) => {
        next[k] = Math.max(0, baseline[k] + (deltas[k] ?? 0));
      });
      return next;
    });
  };

  return (
    <div>
      <p style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Sliders size={14} strokeWidth={1.75} />
        Drag a parameter to see how the fused anomaly responds.
      </p>

      {PARAMS.map((p) => {
        const v = values[p.key];
        const b = baseline[p.key];
        const delta = v - b;
        const big = Math.abs(delta) / (p.max - p.min) > 0.15;
        return (
          <div key={p.key} className="wi-row">
            <div className="wi-row-top">
              <span>
                {p.label} {p.unit && <span className="u">{p.unit}</span>}
              </span>
              <span className="num">
                {v.toFixed(p.step >= 1 ? 0 : p.step >= 0.5 ? 1 : 2)}
                {delta !== 0 && (
                  <span className={'delta' + (big ? ' big' : '')}>
                    {delta > 0 ? '+' : ''}
                    {delta.toFixed(p.step >= 1 ? 0 : 1)}
                  </span>
                )}
              </span>
            </div>
            <div className="wi-track">
              <input
                type="range"
                min={p.min}
                max={p.max}
                step={p.step}
                value={v}
                onChange={(e) => commitChange((cur) => ({ ...cur, [p.key]: Number(e.target.value) }))}
                aria-label={p.label}
              />
              <div
                className="wi-tick"
                title={`Baseline ${b.toFixed(p.step >= 1 ? 0 : 2)}`}
                style={{ left: `${((b - p.min) / (p.max - p.min)) * 100}%` }}
              />
            </div>
          </div>
        );
      })}

      <div className="wi-actions">
        {SCENARIOS.map((s) => (
          <button key={s.name} className="btn btn-sm" onClick={() => apply(s.deltas)}>
            {s.icon}
            {s.name}
          </button>
        ))}
        <button className="btn btn-ghost btn-sm" onClick={undo} disabled={histLen === 0} title="Undo last change">
          <Undo2 size={13} strokeWidth={1.75} />
          Undo
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => commitChange(() => baseline)}>
          <RotateCcw size={13} strokeWidth={1.75} />
          Reset
        </button>
      </div>
    </div>
  );
}
