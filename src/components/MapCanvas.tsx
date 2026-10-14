import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl, {
  Map as MLMap,
  type GeoJSONSource,
  type RasterTileSource,
  type ExpressionSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { CanonicalRecord } from '../types';
import { EVENTS, CLEAN_SITES, NEON_SITES, USGS_STATIONS } from '../data/realData';
import type { Action, Layers } from '../state';
import { Legend } from './Legend';
import { resolve } from '../engine/resolve';
import { fetchLiveSensor, patchFromLive } from '../engine/liveUsgs';
import { useToasts } from './toastContext';
import { setMapInstance } from './mapRef';

interface Props {
  selected: CanonicalRecord | null;
  layers: Layers;
  legendOpen: boolean;
  dispatch: React.Dispatch<Action>;
  date: string;
  colorBlind: boolean;
}

// Default + colour-blind-safe (viridis-ish) tier palettes. Same hue order so the
// "high tier = warmer" semantics survive, but with luminance separation that
// reads correctly under deuteranopia / protanopia.
const TIER_COLORS: Record<number, string> = {
  5: '#a8322a',
  4: '#a04a14',
  3: '#7d5f0e',
  2: '#5a6270',
  1: '#2f6b3a',
};
const TIER_COLORS_CB: Record<number, string> = {
  5: '#fde725',
  4: '#5ec962',
  3: '#21918c',
  2: '#3b528b',
  1: '#440154',
};
function tierColor(tier: number, cb: boolean) {
  return (cb ? TIER_COLORS_CB : TIER_COLORS)[tier] ?? '#8e8574';
}
function tierExpr(cb: boolean): ExpressionSpecification {
  return [
    'match',
    ['get', 'tier'],
    5, tierColor(5, cb),
    4, tierColor(4, cb),
    3, tierColor(3, cb),
    2, tierColor(2, cb),
    1, tierColor(1, cb),
    '#8e8574',
  ];
}

const PAPER = '#f3efe6';

// GIBS WMTS endpoint for daily true-colour imagery.
function gibsUrl(layer: string, date: string) {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

// Surveyor's graticule: a line every 5 degrees, heavier every 15.
function graticule(): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (let lon = -180; lon <= 180; lon += 5) {
    features.push({
      type: 'Feature',
      properties: { major: lon % 15 === 0 },
      geometry: { type: 'LineString', coordinates: [[lon, -85], [lon, 85]] },
    });
  }
  for (let lat = -80; lat <= 80; lat += 5) {
    const coords: [number, number][] = [];
    for (let lon = -180; lon <= 180; lon += 5) coords.push([lon, lat]);
    features.push({
      type: 'Feature',
      properties: { major: lat % 15 === 0 },
      geometry: { type: 'LineString', coordinates: coords },
    });
  }
  return { type: 'FeatureCollection', features };
}

const WORLD: GeoJSON.FeatureCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]]],
      },
    },
  ],
};

const BASE_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    // Esri World Light Gray canvas, desaturated and tinted towards paper below. Attribution required.
    carto: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      attribution: 'Basemap © Esri, HERE, Garmin, OpenStreetMap contributors',
      maxzoom: 16,
    },
    cartoLabels: {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
    },
    gibs: {
      type: 'raster',
      tiles: [gibsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', '2024-07-15')],
      tileSize: 256,
      attribution: 'NASA EOSDIS GIBS',
      maxzoom: 9,
    },
    chlorophyll: {
      type: 'raster',
      tiles: [gibsUrl('MODIS_Aqua_Chlorophyll_A', '2024-07-15')],
      tileSize: 256,
      attribution: 'NASA EOSDIS GIBS · MODIS Aqua Chl-a',
      maxzoom: 7,
    },
    drought: {
      // USDM (US Drought Monitor) published weekly map as an image overlay, CONUS bounds.
      type: 'image',
      url: 'https://droughtmonitor.unl.edu/data/png/current/current_west_text.png',
      coordinates: [
        [-127, 51],
        [-65, 51],
        [-65, 22],
        [-127, 22],
      ],
    },
    world: { type: 'geojson', data: WORLD },
    graticule: { type: 'geojson', data: graticule() },
  },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': PAPER } },
    {
      id: 'carto-base',
      type: 'raster',
      source: 'carto',
      paint: {
        'raster-opacity': 1,
        'raster-saturation': -0.85,
        'raster-contrast': 0.08,
        'raster-brightness-min': 0.08,
        'raster-fade-duration': 200,
      },
    },
    {
      // paper tint laid over the basemap so it reads as a printed chart
      id: 'paper-tint',
      type: 'fill',
      source: 'world',
      paint: { 'fill-color': '#e9dfc4', 'fill-opacity': 0.42 },
    },
    {
      id: 'gibs-satellite',
      type: 'raster',
      source: 'gibs',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.85, 'raster-fade-duration': 200 },
      maxzoom: 9,
    },
    {
      id: 'chlorophyll-overlay',
      type: 'raster',
      source: 'chlorophyll',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.7 },
    },
    {
      id: 'drought-overlay',
      type: 'raster',
      source: 'drought',
      layout: { visibility: 'none' },
      paint: { 'raster-opacity': 0.55 },
    },
    {
      id: 'graticule',
      type: 'line',
      source: 'graticule',
      paint: {
        'line-color': '#1f4e79',
        'line-opacity': ['case', ['get', 'major'], 0.3, 0.16],
        'line-width': ['case', ['get', 'major'], 0.9, 0.6],
      },
    },
    {
      id: 'carto-labels',
      type: 'raster',
      source: 'cartoLabels',
      paint: { 'raster-opacity': 0.85, 'raster-saturation': -1, 'raster-contrast': 0.2 },
    },
  ],
};

export function MapCanvas({ selected, layers, legendOpen, dispatch, date, colorBlind }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const ready = useRef(false);
  const [liveFetching, setLiveFetching] = useState(false);
  const { push: pushToast } = useToasts();
  const [hover, setHover] = useState<{
    name: string;
    sub: string;
    tier?: number;
    lead?: number | null;
    x: number;
    y: number;
  } | null>(null);

  const ALL_SITES = useMemo<CanonicalRecord[]>(() => [...EVENTS, ...CLEAN_SITES], []);

  // Initialize the map once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;
    const map = new maplibregl.Map({
      container,
      style: BASE_STYLE,
      center: [-96, 38],
      zoom: 3.4,
      minZoom: 2,
      maxZoom: 9,
      attributionControl: { compact: true },
      cooperativeGestures: false,
    });
    mapRef.current = map;
    setMapInstance(map);

    // The chart column resizes when the record sheet docks or the phone layout stacks.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);

    map.on('load', () => {
      ready.current = true;
      map.addSource('usgs', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: USGS_STATIONS.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: { id: s.id, kind: 'usgs' },
        })) },
      });
      map.addSource('neon', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: NEON_SITES.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: { id: s.id, name: s.name, tier: s.tier, kind: 'neon' },
        })) },
      });
      map.addSource('events', {
        type: 'geojson',
        cluster: true,
        clusterMaxZoom: 5,
        clusterRadius: 36,
        data: { type: 'FeatureCollection', features: ALL_SITES.map((s) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
          properties: {
            id: s.id,
            name: s.name,
            tier: s.tier ?? 1,
            bookmarked: !!s.bookmarked,
            leadDays: s.leadDays ?? null,
          },
        })) },
      });

      // USGS network: small survey-blue points
      map.addLayer({
        id: 'usgs-dots',
        type: 'circle',
        source: 'usgs',
        paint: {
          'circle-radius': 2.6,
          'circle-color': '#1f4e79',
          'circle-opacity': 0.45,
          'circle-stroke-width': 0,
        },
      });

      // NEON sites
      map.addLayer({
        id: 'neon-dots',
        type: 'circle',
        source: 'neon',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'tier'], 1, 5, 5, 9],
          'circle-color': tierExpr(colorBlind),
          'circle-stroke-color': PAPER,
          'circle-stroke-width': 1.5,
        },
      });

      // Cluster bubbles (only visible at low zoom where points clump)
      map.addLayer({
        id: 'events-clusters',
        type: 'circle',
        source: 'events',
        filter: ['has', 'point_count'],
        paint: {
          'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 15, 24],
          'circle-color': '#1f4e79',
          'circle-stroke-color': PAPER,
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'events-cluster-count',
        type: 'symbol',
        source: 'events',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-size': 13,
          'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'],
        },
        paint: { 'text-color': PAPER },
      });
      // Individual event markers (unclustered only)
      map.addLayer({
        id: 'events-dots',
        type: 'circle',
        source: 'events',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-radius': ['case', ['get', 'bookmarked'], 10, 8],
          'circle-color': tierExpr(colorBlind),
          'circle-stroke-color': '#1b2330',
          'circle-stroke-width': 1.5,
        },
      });
      // Zoom into a cluster on click.
      map.on('click', 'events-clusters', (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: ['events-clusters'] });
        const cluster = feats[0];
        if (!cluster) return;
        const center = (cluster.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center, zoom: Math.min(7, map.getZoom() + 2) });
      });

      // Click handlers
      map.on('click', async (e) => {
        const features = map.queryRenderedFeatures(e.point, {
          layers: ['events-dots', 'neon-dots'],
        });
        const f = features[0];
        if (f) {
          const id = f.properties?.id as string;
          const rec = ALL_SITES.find((s) => s.id === id);
          if (rec) {
            dispatch({ type: 'SELECT_SITE', record: rec });
            return;
          }
        }
        // Open the record sheet immediately with a synthesized record (instant feedback),
        // then patch in real NWIS data when it returns.
        const { lat, lng } = e.lngLat;
        const synth = resolve(lat, lng);
        dispatch({ type: 'SELECT_SITE', record: synth });
        setLiveFetching(true);
        dispatch({ type: 'LIVE_FETCH_BEGIN' });
        try {
          const live = await fetchLiveSensor(lat, lng);
          const patch = patchFromLive(synth, live);
          if (Object.keys(patch).length > 0) {
            dispatch({ type: 'PATCH_RECORD', patch });
            pushToast('success', `Live USGS data from ${live.stationName}`, 2400);
          } else if (!live.ok) {
            pushToast('info', live.reason ?? 'No live USGS data near this location.');
          }
        } catch (err) {
          console.error('USGS fetch failed', err);
          pushToast('error', 'Could not reach USGS NWIS — showing synthesized data.');
        } finally {
          setLiveFetching(false);
          dispatch({ type: 'LIVE_FETCH_END' });
        }
      });

      // Hover preview — positioned floating card
      map.on('mousemove', 'events-dots', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; bookmarked: boolean; tier: number; leadDays: number | null };
        setHover({
          name: p.name,
          sub: p.bookmarked ? 'Validated event record' : 'Reference site',
          tier: p.tier,
          lead: p.leadDays,
          x: e.point.x,
          y: e.point.y,
        });
      });
      map.on('mouseleave', 'events-dots', () => {
        map.getCanvas().style.cursor = '';
        setHover(null);
      });
      map.on('mousemove', 'neon-dots', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties as { name: string; tier: number };
        setHover({
          name: p.name,
          sub: `NEON site · tier ${p.tier}`,
          tier: p.tier,
          lead: null,
          x: e.point.x,
          y: e.point.y,
        });
      });
      map.on('mouseleave', 'neon-dots', () => {
        map.getCanvas().style.cursor = '';
        setHover(null);
      });
    });

    return () => {
      ro.disconnect();
      setMapInstance(null);
      map.remove();
      mapRef.current = null;
      ready.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update GIBS tile date (base true-colour AND chlorophyll overlay).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const gibs = map.getSource('gibs') as RasterTileSource | undefined;
    const chl = map.getSource('chlorophyll') as RasterTileSource | undefined;
    gibs?.setTiles([gibsUrl('MODIS_Terra_CorrectedReflectance_TrueColor', date)]);
    chl?.setTiles([gibsUrl('MODIS_Aqua_Chlorophyll_A', date)]);
  }, [date]);

  // Live-swap tier palette when colorBlind toggles (no re-init needed).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    if (map.getLayer('events-dots')) map.setPaintProperty('events-dots', 'circle-color', tierExpr(colorBlind));
    if (map.getLayer('neon-dots')) map.setPaintProperty('neon-dots', 'circle-color', tierExpr(colorBlind));
  }, [colorBlind]);

  // Toggle layer visibility. The paper tint and graticule step aside when imagery is shown.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    map.setLayoutProperty('usgs-dots', 'visibility', layers.usgs ? 'visible' : 'none');
    map.setLayoutProperty('neon-dots', 'visibility', layers.neon ? 'visible' : 'none');
    map.setLayoutProperty('gibs-satellite', 'visibility', layers.satellite ? 'visible' : 'none');
    map.setLayoutProperty('chlorophyll-overlay', 'visibility', layers.chlorophyll ? 'visible' : 'none');
    map.setLayoutProperty('drought-overlay', 'visibility', layers.drought ? 'visible' : 'none');
    map.setPaintProperty('paper-tint', 'fill-opacity', layers.satellite ? 0 : 0.42);
  }, [layers]);

  // Fly to selection.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current || !selected) return;
    map.flyTo({ center: [selected.lon, selected.lat], zoom: 6.5, duration: 1200, essential: true });
  }, [selected]);

  // Selected marker halo (separate layer).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready.current) return;
    const src = map.getSource('selected') as GeoJSONSource | undefined;
    const data: GeoJSON.FeatureCollection = selected
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [selected.lon, selected.lat] },
              properties: {},
            },
          ],
        }
      : { type: 'FeatureCollection', features: [] };
    if (src) {
      src.setData(data);
    } else {
      map.addSource('selected', { type: 'geojson', data });
      map.addLayer({
        id: 'selected-halo',
        type: 'circle',
        source: 'selected',
        paint: {
          'circle-radius': 22,
          'circle-color': '#1f4e79',
          'circle-opacity': 0.1,
          'circle-stroke-color': '#1f4e79',
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.7,
        },
      });
    }
  }, [selected]);

  // Breathe the selected halo (radius 22 → 34) unless the user prefers reduced motion.
  useEffect(() => {
    if (!selected) return;
    const map = mapRef.current;
    if (!map) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const phase = ((t - t0) % 2400) / 2400;
      const eased = (Math.sin(phase * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      if (map.getLayer('selected-halo')) {
        map.setPaintProperty('selected-halo', 'circle-radius', 22 + eased * 12);
        map.setPaintProperty('selected-halo', 'circle-opacity', 0.12 - eased * 0.08);
        map.setPaintProperty('selected-halo', 'circle-stroke-opacity', 0.7 - eased * 0.5);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  return (
    <div className="map-root">
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {!selected && !liveFetching && (
        <div className="map-note">
          Pick a recorded event above, or click anywhere on the chart to resolve a record from the nearest USGS station.
        </div>
      )}
      {legendOpen && <Legend colorBlind={colorBlind} />}
      {liveFetching && (
        <div className="map-note top">
          <span className="beacon" />
          Fetching live USGS data…
        </div>
      )}
      {hover && (
        <div className="map-hover" style={{ left: hover.x + 16, top: hover.y + 16 }}>
          <div className="map-hover-name">{hover.name}</div>
          <div className="map-hover-sub">{hover.sub}</div>
          {hover.lead != null && (
            <div className="map-hover-lead">
              Detected <span className="num">{hover.lead.toFixed(1)} d</span> before advisory
            </div>
          )}
        </div>
      )}
    </div>
  );
}
