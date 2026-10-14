import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown, ChevronRight, Zap, Clock, Pin } from 'lucide-react';
import type { CanonicalRecord, AlertTier } from '../types';
import type { AppState, Action } from '../state';
import { fetchLiveSensor, patchFromLive } from '../engine/liveUsgs';
import { useToasts } from './toastContext';
import { getEventTimeline } from '../data/eventTimelines';
import { sampleSeriesAt } from '../engine/timeSample';
import { EventBanner } from './EventBanner';
import { EventTimelinePanel } from './EventTimelinePanel';
import { AquaSSMCard } from './modalities/AquaSSM';
import { HydroViTCard } from './modalities/HydroViT';
import { MicroBiomeNetCard } from './modalities/MicroBiomeNet';
import { ToxiGeneCard } from './modalities/ToxiGene';
import { BioMotionCard } from './modalities/BioMotion';
import { EVENT_CONTENT, type EventContent } from '../data/eventContent';
import { WhatIfPanel } from './WhatIfPanel';
import { ALERT_LABEL } from './milestoneColors';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  record: CanonicalRecord;
}

const TIER_COST = [0, 0.5, 15, 25]; // $K added per step
const TIER_DESC = [
  'sensor + behavioural monitoring',
  'sensor + behavioural + satellite',
  'adds microbial source attribution',
  'adds molecular toxicity profile',
];

function useCountUp(target: number, dur = 800) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setV(target * e);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, dur]);
  return v;
}

export function PlaceCard({ state, dispatch, record }: Props) {
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [modsOpen, setModsOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [expandedModality, setExpandedModality] = useState<string | null>(null);

  // Time-aware anomaly: when an EventTimeline is registered for this record, sample
  // anomaly_series at currentDate so the hero metric "plays" along with the timeline.
  const timeline = getEventTimeline(record.eventKey);
  const sampledAnomaly = timeline
    ? sampleSeriesAt(record.sensor.anomaly_series, timeline.windowStart, timeline.advisoryDate, state.currentDate)
    : record.fusion.anomaly;
  // Fraction of the playback window already traversed — drives sparkline future mask.
  const maskPct = timeline
    ? Math.max(
        0,
        Math.min(
          1,
          (new Date(state.currentDate + 'T00:00:00Z').getTime() -
            new Date(timeline.windowStart + 'T00:00:00Z').getTime()) /
            (new Date(timeline.advisoryDate + 'T00:00:00Z').getTime() -
              new Date(timeline.windowStart + 'T00:00:00Z').getTime()),
        ),
      )
    : 1;
  const anomaly = useCountUp(sampledAnomaly);
  // Alert tier follows the sampled value during playback, not the static peak.
  const liveAlert: AlertTier = timeline
    ? sampledAnomaly > 0.85 ? 'ALERT'
      : sampledAnomaly > 0.65 ? 'INVESTIGATE'
      : sampledAnomaly > 0.4 ? 'WATCH'
      : 'MAINTAIN'
    : record.fusion.alert;
  const tier = state.cascadeTier;
  const canEscalate = tier < 3;
  const nextCost = canEscalate ? TIER_COST[tier + 1] : 0;
  const { push: pushToast } = useToasts();

  // Live USGS polling — only when the record was hydrated from a USGS station.
  // Backoff: 60 s normal, doubles on error up to 10 min, resets on success.
  const isLiveBacked = record.name?.startsWith('USGS ') ?? false;
  const backoffRef = useRef(60_000);
  useEffect(() => {
    if (!isLiveBacked) return;
    let cancelled = false;
    let timer: number | null = null;
    const poll = async () => {
      try {
        const live = await fetchLiveSensor(record.lat, record.lon);
        if (cancelled) return;
        const patch = patchFromLive(record, live);
        if (Object.keys(patch).length > 0) dispatch({ type: 'PATCH_RECORD', patch });
        backoffRef.current = 60_000;
      } catch {
        backoffRef.current = Math.min(600_000, backoffRef.current * 2);
      } finally {
        if (!cancelled) timer = window.setTimeout(poll, backoffRef.current);
      }
    };
    timer = window.setTimeout(poll, backoffRef.current);
    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
    };
  }, [isLiveBacked, record.lat, record.lon, dispatch, record]);

  const isPinned = state.pinnedRecord?.id === record.id;
  const pin = () => {
    dispatch({ type: 'PIN_RECORD', record });
    pushToast('info', `Pinned ${record.name} — pick another site to compare.`, 2400);
  };

  return (
    <aside className="sheet" aria-label="Record sheet">
      {timeline && <EventBanner timeline={timeline} currentDate={state.currentDate} />}

      {record.bookmarked && record.bbox && record.advisoryDate && (
        <HeroImage bbox={record.bbox} date={state.currentDate} advisoryDate={record.advisoryDate} />
      )}

      <div className="sheet-head">
        <div className="sheet-head-row">
          <h2 className="sheet-title">{record.name}</h2>
          <button
            className={'btn btn-ghost btn-icon' + (isPinned ? ' on' : '')}
            onClick={pin}
            disabled={isPinned}
            title={isPinned ? 'Already pinned' : 'Pin for comparison (P)'}
          >
            <Pin size={15} strokeWidth={1.75} />
          </button>
          <button className="btn btn-icon" onClick={() => dispatch({ type: 'CLOSE_RAIL' })} title="Close (Esc)">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="sheet-label">{record.label}</div>
        <div className="sheet-ids">
          {record.id && (
            <span>
              USGS <b>{record.id.split('-')[0]}</b>
            </span>
          )}
          <span>
            <b>{record.lat.toFixed(3)}, {record.lon.toFixed(3)}</b>
          </span>
          <span>
            H3 <b>{record.h3.slice(0, 8)}</b>
          </span>
        </div>
      </div>

      <div className="sheet-body">
        <div className="hero">
          <div className={'hero-metric' + (state.loadingLive ? ' dim' : '')}>{anomaly.toFixed(3)}</div>
          <div className="hero-caption">
            {state.loadingLive ? 'Fetching live USGS data…' : 'Fused anomaly probability'}
            {record.fusion.auroc ? (
              <>
                {' · '}AUROC <span className="num">{record.fusion.auroc.toFixed(3)}</span>
              </>
            ) : null}
          </div>
          <div className="row-chips">
            <span key={liveAlert} className="stamp" data-tone={liveAlert.toLowerCase()}>
              {ALERT_LABEL[liveAlert]}
            </span>
            {record.leadDays !== undefined && (
              <span className="tag" data-tone="info">
                <Clock size={13} strokeWidth={2} />
                <span className="num">{record.leadDays.toFixed(1)} d</span> before advisory
              </span>
            )}
          </div>
        </div>

        {record.eventKey && EVENT_CONTENT[record.eventKey] && (
          <EditorialBlock content={EVENT_CONTENT[record.eventKey]} />
        )}

        <div className="escalate">
          <button className="btn btn-primary" onClick={() => dispatch({ type: 'ESCALATE' })} disabled={!canEscalate}>
            <Zap size={15} strokeWidth={2} />
            {canEscalate ? (
              <>
                Run deeper analysis · <span className="num">+${nextCost.toFixed(1)}K</span>
              </>
            ) : (
              'All five modalities active'
            )}
          </button>
          <div className="escalate-meta">
            <span>
              Tier <span className="num">{tier}</span> · {TIER_DESC[tier]}
            </span>
            {tier > 0 && (
              <button className="btn-link" onClick={() => dispatch({ type: 'DEESCALATE' })}>
                De-escalate
              </button>
            )}
          </div>
          <div className="escalate-meta">
            <span>
              Spend so far <span className="num">${state.totalCostK.toFixed(1)}K</span>
            </span>
          </div>
        </div>

        <Section title="Detection summary" open={summaryOpen} onToggle={() => setSummaryOpen((v) => !v)}>
          <DetectionSummary record={record} />
        </Section>

        <Section title="What-if simulation" open={whatIfOpen} onToggle={() => setWhatIfOpen((v) => !v)}>
          <WhatIfPanel record={record} dispatch={dispatch} />
        </Section>

        <Section
          title="Modality breakdown"
          count={`${record.n_modalities}/5 active`}
          open={modsOpen}
          onToggle={() => setModsOpen((v) => !v)}
        >
          <ModalityList
            record={record}
            tier={tier}
            expanded={expandedModality}
            setExpanded={setExpandedModality}
            maskPct={maskPct}
          />
        </Section>

        {record.bookmarked && (
          <Section title="Timeline" open={timelineOpen} onToggle={() => setTimelineOpen((v) => !v)}>
            {timeline ? (
              <EventTimelinePanel timeline={timeline} state={state} dispatch={dispatch} />
            ) : (
              <TimelineInline record={record} />
            )}
          </Section>
        )}

        <div style={{ height: 8 }} />
      </div>

      <div className="sheet-foot">
        Cached demonstration data ·{' '}
        <button className="btn-link" onClick={() => dispatch({ type: 'TOGGLE_METHODOLOGY' })}>
          what is real, what is modelled
        </button>
      </div>
    </aside>
  );
}

/* ---- subcomponents ---- */

function EditorialBlock({ content }: { content: EventContent }) {
  return (
    <div className="editorial">
      <p>{content.narrative}</p>

      {content.quote && (
        <blockquote>
          “{content.quote.text}”
          <span className="cite">— {content.quote.cite}</span>
        </blockquote>
      )}

      <dl className="impact">
        {content.impact.map((row) => (
          <div className="impact-row" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>

      <div className="sources">
        <span style={{ fontWeight: 500, color: 'var(--ink-2)' }}>Sources · </span>
        {content.sources.map((s, i) => (
          <span key={i}>
            {i > 0 && '; '}
            {s.url ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.label}
              </a>
            ) : (
              s.label
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

function HeroImage({
  bbox,
  date,
  advisoryDate,
}: {
  bbox: [number, number, number, number];
  date: string;
  advisoryDate: string;
}) {
  // NASA Worldview Snapshot API: a static image for a given bbox + date + layers.
  const [west, south, east, north] = bbox;
  const layer = 'MODIS_Terra_CorrectedReflectance_TrueColor,Coastlines';
  const url = `https://wvs.earthdata.nasa.gov/api/v1/snapshot?REQUEST=GetSnapshot&LAYERS=${layer}&CRS=EPSG:4326&TIME=${date}&BBOX=${south},${west},${north},${east}&WIDTH=480&HEIGHT=200&FORMAT=image/jpeg`;
  const tOffset = Math.round(
    (new Date(date + 'T00:00:00Z').getTime() - new Date(advisoryDate + 'T00:00:00Z').getTime()) / 86400000,
  );
  return (
    <div className="hero-image">
      <img
        src={url}
        alt={`MODIS Terra true-colour view at ${date}`}
        loading="lazy"
        onError={(e) => {
          // GIBS sometimes returns a black tile for cloudy days — fade it.
          (e.target as HTMLImageElement).style.opacity = '0.3';
        }}
      />
      <div className="hero-image-strip">
        <span>MODIS Terra · NASA GIBS</span>
        <span>{tOffset === 0 ? 'Advisory day' : tOffset < 0 ? `T${tOffset} d` : `T+${tOffset} d`}</span>
      </div>
    </div>
  );
}

function Section({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <button className="section-toggle" onClick={onToggle} aria-expanded={open}>
        {open ? <ChevronDown size={15} strokeWidth={2} /> : <ChevronRight size={15} strokeWidth={2} />}
        {title}
        {count && <span className="count">{count}</span>}
      </button>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

const MOD_LABELS = [
  { label: 'Sensor', color: 'var(--m-sensor)' },
  { label: 'Satellite', color: 'var(--m-satellite)' },
  { label: 'Behavioural', color: 'var(--m-behavioral)' },
  { label: 'Microbial', color: 'var(--m-microbial)' },
  { label: 'Molecular', color: 'var(--m-molecular)' },
];

function DetectionSummary({ record }: { record: CanonicalRecord }) {
  const top = MOD_LABELS.map((m, i) => ({ ...m, w: record.fusion.attention[i] }))
    .filter((m) => m.w > 0)
    .sort((a, b) => b.w - a.w);
  const topNames = top.slice(0, 2).map((m) => m.label.toLowerCase()).join(' and ');
  const topShare = (top.slice(0, 2).reduce((s, m) => s + m.w, 0) * 100).toFixed(0);
  return (
    <>
      <p>
        {top.length === 0
          ? 'Awaiting modality activation.'
          : `${record.n_modalities} of 5 modalities fused. ${topNames.charAt(0).toUpperCase() + topNames.slice(1)} carry ${topShare}% of the attention.`}
      </p>
      <div className="attention-bar" role="img" aria-label="Attention weights by modality">
        {record.fusion.attention.map((w, i) => (
          <div
            key={i}
            title={`${MOD_LABELS[i].label} ${(w * 100).toFixed(1)}%`}
            style={{ width: `${w * 100}%`, background: MOD_LABELS[i].color }}
          />
        ))}
      </div>
      <div className="note">
        Coverage <span className="num">{(record.fusion.coverage * 100).toFixed(0)}%</span>. Microbial and
        molecular weight sit near zero in routine detection; they are retained for source attribution.
      </div>
    </>
  );
}

function ModalityList({
  record,
  tier,
  expanded,
  setExpanded,
  maskPct,
}: {
  record: CanonicalRecord;
  tier: 0 | 1 | 2 | 3;
  expanded: string | null;
  setExpanded: (id: string | null) => void;
  maskPct: number;
}) {
  const rows = [
    {
      id: 'sensor',
      name: 'AquaSSM',
      sub: 'Continuous sensor anomaly',
      color: 'var(--m-sensor)',
      coverage: record.sensor.state,
      headline: record.sensor.anomaly.toFixed(3),
      headlineLabel: 'anomaly',
      viz: <AquaSSMCard sensor={record.sensor} maskPct={maskPct} />,
    },
    {
      id: 'satellite',
      name: 'HydroViT',
      sub: 'Sentinel-2 spectral indices',
      color: 'var(--m-satellite)',
      coverage: record.satellite.state,
      headline: 'R² 0.749',
      headlineLabel: 'water temperature',
      viz: <HydroViTCard satellite={record.satellite} tier={tier} />,
    },
    {
      id: 'behavioral',
      name: 'BioMotion',
      sub: 'Daphnia behavioural assay',
      color: 'var(--m-behavioral)',
      coverage: record.behavioral.state,
      headline: record.behavioral.anomaly.toFixed(3),
      headlineLabel: 'AUROC',
      viz: <BioMotionCard bio={record.behavioral} />,
    },
    {
      id: 'microbial',
      name: 'MicroBiomeNet',
      sub: 'eDNA source attribution',
      color: 'var(--m-microbial)',
      coverage: record.microbial.state,
      headline: record.microbial.top
        ? `${record.microbial.classes.find((c) => c.name === record.microbial.top)?.p.toFixed(2) ?? ''}`
        : '—',
      headlineLabel: record.microbial.top ? `top · ${record.microbial.top.toLowerCase()}` : 'awaiting activation',
      viz: <MicroBiomeNetCard micro={record.microbial} />,
    },
    {
      id: 'molecular',
      name: 'ToxiGene',
      sub: 'Transcriptomic toxicity',
      color: 'var(--m-molecular)',
      coverage: record.molecular.state,
      headline: record.molecular.outcome ?? '—',
      headlineLabel: 'predicted outcome',
      viz: <ToxiGeneCard molecular={record.molecular} />,
    },
  ] as const;

  return (
    <div className="mod-list">
      {rows.map((r) => {
        const isExpanded = expanded === r.id;
        const deployable = r.coverage === 'DEPLOYABLE';
        return (
          <div key={r.id}>
            <button
              className={'mod-row' + (isExpanded ? ' open' : '') + (deployable ? ' deployable' : '')}
              onClick={() => setExpanded(isExpanded ? null : r.id)}
              aria-expanded={isExpanded}
            >
              <span className="swatch-sq" style={{ background: r.color }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mod-name">{r.name}</div>
                <div className="mod-sub">{r.sub}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div className="mod-head">{r.headline}</div>
                <div className="mod-head-label">{r.headlineLabel}</div>
              </div>
              <ChevronRight className="chev" size={15} strokeWidth={2} />
            </button>
            {isExpanded && <div className="mod-detail">{r.viz}</div>}
          </div>
        );
      })}
    </div>
  );
}

function TimelineInline({ record }: { record: CanonicalRecord }) {
  const [pos, setPos] = useState(record.leadDays ? -record.leadDays : 0);
  const lead = -pos;
  return (
    <div>
      <p style={{ marginBottom: 8 }}>Drag to scrub from the advisory back to first detection.</p>
      <input
        type="range"
        min={-60}
        max={0}
        step={0.5}
        value={pos}
        onChange={(e) => setPos(Number(e.target.value))}
        aria-label="Days before advisory"
      />
      <div className="note" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
        <span className="num">−60 d</span>
        <span className="num">−30 d</span>
        <span className="num">−14 d</span>
        <span>Advisory</span>
      </div>
      <div className="note" style={{ color: 'var(--blue)' }}>
        Detected <span className="num">{lead.toFixed(1)} d</span> early
      </div>
    </div>
  );
}
