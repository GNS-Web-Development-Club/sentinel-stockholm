import type { Sensor } from '../../types';
import { ModalityCard } from '../ModalityCard';

interface Props {
  sensor: Sensor;
  // 0..1 fraction of the series considered "past" — values beyond this index are
  // drawn as a faded dashed continuation: data SENTINEL has not seen yet.
  maskPct?: number;
}

const PARAM_LABELS: { key: keyof Sensor['series']; label: string }[] = [
  { key: 'do', label: 'DO mg/L' },
  { key: 'ph', label: 'pH' },
  { key: 'turb', label: 'Turb NTU' },
  { key: 'cond', label: 'Cond µS/cm' },
  { key: 'temp', label: 'Temp °C' },
  { key: 'orp', label: 'ORP mV' },
];

const CHANNELS = ['1h', '4h', '12h', '2d', '7d', '30d', '90d', '1y'];

function pathOf(values: number[], w: number, h: number, color: string, withBand = false, maskPct = 1) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = w / (values.length - 1);
  const point = (v: number, i: number) => `${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`;
  const cutoff = Math.max(0, Math.min(values.length - 1, Math.round((values.length - 1) * maskPct)));
  const pastValues = values.slice(0, cutoff + 1);
  const futureValues = values.slice(cutoff);
  const pastD = pastValues.length > 0 ? pastValues.map((v, i) => `${i === 0 ? 'M' : 'L'}${point(v, i)}`).join(' ') : '';
  const futureD =
    futureValues.length > 1 ? futureValues.map((v, i) => `${i === 0 ? 'M' : 'L'}${point(v, i + cutoff)}`).join(' ') : '';
  const lines = (
    <>
      {pastD && <path d={pastD} fill="none" stroke={color} strokeWidth={1.3} vectorEffect="non-scaling-stroke" />}
      {futureD && maskPct < 1 && (
        <path d={futureD} fill="none" stroke={color} strokeWidth={1.3} strokeDasharray="3 3" opacity={0.4} vectorEffect="non-scaling-stroke" />
      )}
    </>
  );
  if (!withBand) return lines;
  // ±1σ band behind the driver parameter.
  const mean = values.reduce((s, x) => s + x, 0) / values.length;
  const variance = values.reduce((s, x) => s + (x - mean) ** 2, 0) / Math.max(1, values.length - 1);
  const sd = Math.sqrt(variance);
  const yMean = h - ((mean - min) / range) * h;
  const yHi = h - ((mean + sd - min) / range) * h;
  const yLo = h - ((mean - sd - min) / range) * h;
  return (
    <>
      <rect x={0} y={yHi} width={w} height={Math.max(0, yLo - yHi)} fill={color} opacity={0.12} />
      <line x1={0} y1={yMean} x2={w} y2={yMean} stroke={color} strokeWidth={0.6} opacity={0.6} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
      {lines}
    </>
  );
}

export function AquaSSMCard({ sensor, maskPct = 1 }: Props) {
  const W = 220;
  const H = 46;
  const v = sensor.anomaly_series;
  const step = W / (v.length - 1);
  const cutoff = Math.max(0, Math.min(v.length - 1, Math.round((v.length - 1) * maskPct)));
  const pastPts = v
    .slice(0, cutoff + 1)
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${(H - y * H).toFixed(1)}`)
    .join(' ');
  const futurePts = v
    .slice(cutoff)
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${((i + cutoff) * step).toFixed(1)},${(H - y * H).toFixed(1)}`)
    .join(' ');
  const lastX = (cutoff * step).toFixed(1);

  return (
    <ModalityCard
      name="AquaSSM"
      subtitle="Continuous-time SSM · 8 timescales · 25M params"
      accentColor="var(--m-sensor)"
      coverage={sensor.state}
      conf={sensor.conf}
      headlineMetric={sensor.anomaly.toFixed(3)}
      headlineLabel="Anomaly probability"
      secondary={<span>Health nominal</span>}
    >
      <div className="spark-grid">
        {PARAM_LABELS.map((p) => {
          const series = sensor.series[p.key];
          const last = series[series.length - 1];
          const isDriver = sensor.driver_param === p.key;
          return (
            <div key={p.key} className="spark">
              <svg viewBox="0 0 150 46" preserveAspectRatio="none" aria-hidden="true">
                {pathOf(series, 150, 46, isDriver ? 'var(--red)' : 'var(--m-sensor)', isDriver, maskPct)}
              </svg>
              <div className={'spark-label' + (isDriver ? ' driver' : '')}>{p.label}</div>
              <div className="spark-value">{last.toFixed(p.key === 'cond' ? 0 : 1)}</div>
            </div>
          );
        })}
      </div>
      <div className="anomaly-chart">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <line x1="0" y1={H - 0.9 * H} x2={W} y2={H - 0.9 * H} stroke="var(--ink-3)" strokeWidth="0.6" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <path d={`${pastPts} L${lastX},${H} L0,${H} Z`} fill="var(--red)" opacity={0.14} />
          <path d={pastPts} fill="none" stroke="var(--red)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          {maskPct < 1 && (
            <path d={futurePts} fill="none" stroke="var(--red)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.35} vectorEffect="non-scaling-stroke" />
          )}
          {maskPct < 1 && maskPct > 0 && (
            <line x1={lastX} y1={0} x2={lastX} y2={H} stroke="var(--ink)" strokeWidth={1} strokeDasharray="2 2" vectorEffect="non-scaling-stroke" />
          )}
        </svg>
        <div className="spark-label">Anomaly · threshold 0.90</div>
      </div>
      <div className="chan-strip">
        {sensor.channel_weights.map((w, i) => (
          <div key={i} className="chan">
            <div className="chan-bar">
              <div className={w > 0.8 ? 'hot' : undefined} style={{ height: `${w * 100}%` }} />
            </div>
            <div className="chan-l">{CHANNELS[i]}</div>
          </div>
        ))}
      </div>
    </ModalityCard>
  );
}
