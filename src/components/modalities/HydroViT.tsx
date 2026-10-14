import type { Satellite } from '../../types';
import { ModalityCard } from '../ModalityCard';

interface Props {
  satellite: Satellite;
  tier: 0 | 1 | 2 | 3;
  // When date + bbox are both supplied, the card swaps its procedural tile for a
  // NASA Worldview MODIS Aqua chlorophyll-a snapshot at that date.
  date?: string;
  bbox?: [number, number, number, number]; // [west, south, east, north]
}

const INDICES: { key: keyof Satellite['indices']; label: string }[] = [
  { key: 'ndci', label: 'NDCI' },
  { key: 'fai', label: 'FAI' },
  { key: 'ndti', label: 'NDTI' },
  { key: 'mndwi', label: 'MNDWI' },
];

function HeatTile({ seed }: { seed: number }) {
  // procedural bloom hotspot, drawn as a chart-blue density raster
  const cells: { x: number; y: number; v: number }[] = [];
  const rng = (i: number) => {
    const s = Math.sin(seed * 9301 + i * 49297) * 233280;
    return s - Math.floor(s);
  };
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 24; x++) {
      const dx = (x - 17) / 6;
      const dy = (y - 4) / 4;
      const r = Math.sqrt(dx * dx + dy * dy);
      const hotspot = Math.exp(-r * r) * 0.9;
      const noise = rng(y * 24 + x) * 0.2;
      cells.push({ x, y, v: Math.min(1, hotspot + noise * 0.4 + 0.1) });
    }
  }
  return (
    <svg viewBox="0 0 240 56" preserveAspectRatio="none" aria-hidden="true">
      {cells.map((c, i) => (
        <rect key={i} x={c.x * 10} y={c.y * 7} width={10} height={7} fill="#1f4e79" opacity={0.08 + c.v * 0.8} />
      ))}
    </svg>
  );
}

function WorldviewChlA({ date, bbox }: { date: string; bbox: [number, number, number, number] }) {
  const [west, south, east, north] = bbox;
  const url =
    `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot` +
    `&LAYERS=MODIS_Aqua_Chlorophyll_A,Coastlines` +
    `&CRS=EPSG:4326&TIME=${date}` +
    `&BBOX=${south},${west},${north},${east}` +
    `&WIDTH=480&HEIGHT=120&FORMAT=image/jpeg`;
  return (
    <img
      src={url}
      alt={`MODIS Aqua chlorophyll-a · ${date}`}
      loading="lazy"
      onError={(e) => {
        (e.target as HTMLImageElement).style.opacity = '0.25';
      }}
    />
  );
}

export function HydroViTCard({ satellite, date, bbox }: Props) {
  const live = !!(date && bbox);
  return (
    <ModalityCard
      name="HydroViT"
      subtitle="ViT-S/16 · MAE pretrain · 13 bands"
      accentColor="var(--m-satellite)"
      coverage={satellite.state}
      conf={satellite.conf}
      headlineMetric={<>R² 0.749</>}
      headlineLabel="Water temperature"
      secondary={
        <span>
          Chl-a <span className="num">{satellite.params.chla}</span> µg/L
        </span>
      }
    >
      <div className="idx-grid">
        {INDICES.map((idx) => {
          const v = satellite.indices[idx.key] ?? 0;
          const hot = idx.key === 'ndci' && v > 0.3;
          return (
            <div key={idx.key}>
              <div className="idx-l">{idx.label}</div>
              <div className="idx-bar">
                <div className={hot ? 'hot' : undefined} style={{ width: `${Math.min(100, v * 100)}%` }} />
              </div>
              <div className="idx-v">{v.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
      <div className="tile">
        {live ? <WorldviewChlA date={date!} bbox={bbox!} /> : <HeatTile seed={satellite.tileSeed} />}
        <div className="tile-cap">
          <span>{live ? `MODIS Aqua chl-a · ${date}` : 'Derived indices'}</span>
          <span>{live ? 'NASA Worldview' : 'illustrative'}</span>
        </div>
      </div>
    </ModalityCard>
  );
}
