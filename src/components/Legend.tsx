const TIERS: { label: string; sub: string; color: string; cb: string }[] = [
  { label: 'Critical', sub: '> 0.70', color: '#a8322a', cb: '#fde725' },
  { label: 'High', sub: '0.55 – 0.70', color: '#a04a14', cb: '#5ec962' },
  { label: 'Elevated', sub: '0.40 – 0.55', color: '#7d5f0e', cb: '#21918c' },
  { label: 'Moderate', sub: '0.25 – 0.40', color: '#5a6270', cb: '#3b528b' },
  { label: 'Low', sub: '≤ 0.25', color: '#2f6b3a', cb: '#440154' },
];

export function Legend({ colorBlind }: { colorBlind: boolean }) {
  return (
    <div className="legend" role="note" aria-label="Risk tier legend">
      <div className="legend-title">Risk tier (fused anomaly)</div>
      {TIERS.map((t) => (
        <div key={t.label} className="legend-row">
          <span className="swatch" style={{ background: colorBlind ? t.cb : t.color }} />
          <span>{t.label}</span>
          <span className="range">{t.sub}</span>
        </div>
      ))}
    </div>
  );
}
