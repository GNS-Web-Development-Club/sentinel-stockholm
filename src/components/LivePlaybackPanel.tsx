import { useEffect } from 'react';
import { Play, Pause, FastForward, X, ChevronsRight } from 'lucide-react';
import type { CanonicalRecord, AlertTier } from '../types';
import type { AppState, Action } from '../state';
import type { EventTimeline, Milestone } from '../data/eventTimelines';
import { daysFromAdvisory } from '../data/eventTimelines';
import { sampleSeriesAt, daysBetween } from '../engine/timeSample';
import { EventBanner } from './EventBanner';
import { AquaSSMCard } from './modalities/AquaSSM';
import { HydroViTCard } from './modalities/HydroViT';
import { BioMotionCard } from './modalities/BioMotion';
import { MicroBiomeNetCard } from './modalities/MicroBiomeNet';
import { ToxiGeneCard } from './modalities/ToxiGene';
import { ALERT_LABEL, MARKER_COLOR } from './milestoneColors';

interface Props {
  timeline: EventTimeline;
  record: CanonicalRecord;
  state: AppState;
  dispatch: React.Dispatch<Action>;
  onClose: () => void;
}

const MS_PER_DAY = 86400000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);
const parseDay = (s: string) => new Date(s + 'T00:00:00Z').getTime();

export function LivePlaybackPanel({ timeline, record, state, dispatch, onClose }: Props) {
  // Escape closes the panel and stops playback.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const sampledAnomaly = sampleSeriesAt(
    record.sensor.anomaly_series,
    timeline.windowStart,
    timeline.advisoryDate,
    state.currentDate,
  );
  const liveAlert: AlertTier =
    sampledAnomaly > 0.85 ? 'ALERT'
    : sampledAnomaly > 0.65 ? 'INVESTIGATE'
    : sampledAnomaly > 0.4 ? 'WATCH'
    : 'MAINTAIN';

  const maskPct = Math.max(
    0,
    Math.min(
      1,
      (parseDay(state.currentDate) - parseDay(timeline.windowStart)) /
        Math.max(1, parseDay(timeline.advisoryDate) - parseDay(timeline.windowStart)),
    ),
  );

  // Virtual cascade tier — derives modality activation from where we are in the story
  // so cards light up without charging the user. Mirrors the paper's cascade controller.
  const virtualTier: 0 | 1 | 2 | 3 =
    state.currentDate >= timeline.advisoryDate ? 3
    : state.currentDate >= timeline.sentinelAlertDate ? 2
    : sampledAnomaly > 0.5 ? 1
    : 0;

  const daysToAdvisory = daysBetween(state.currentDate, timeline.advisoryDate);
  const playing = state.playingStory;
  const speed = state.playStorySpeed;

  const togglePlay = () => {
    if (playing) {
      dispatch({ type: 'STOP_STORY' });
      return;
    }
    const restart = state.currentDate >= timeline.windowEnd;
    dispatch({ type: 'START_STORY', from: restart ? timeline.windowStart : undefined });
  };

  const cycleSpeed = () => {
    const next = speed === 1 ? 4 : speed === 4 ? 16 : 1;
    dispatch({ type: 'SET_STORY_SPEED', speed: next });
  };

  const totalDays = Math.max(1, Math.round((parseDay(timeline.windowEnd) - parseDay(timeline.windowStart)) / MS_PER_DAY));
  const dayOffset = Math.max(
    0,
    Math.min(totalDays, Math.round((parseDay(state.currentDate) - parseDay(timeline.windowStart)) / MS_PER_DAY)),
  );
  const tOff = daysFromAdvisory(timeline, state.currentDate);

  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal live" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Live playback">
        <div className="live-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="kicker">Live playback</div>
            <div className="name">{record.name}</div>
          </div>
          <div className="when">
            <span className="num">{state.currentDate}</span>
            <br />
            {daysToAdvisory > 0
              ? <>T<span className="num">−{daysToAdvisory}</span> d to advisory</>
              : daysToAdvisory === 0 ? 'Advisory day'
              : <>T+<span className="num">{-daysToAdvisory}</span> d</>}
          </div>
          <button className="btn btn-icon" onClick={onClose} title="Close (Esc)">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <EventBanner timeline={timeline} currentDate={state.currentDate} />

        <StageCaption timeline={timeline} state={state} virtualTier={virtualTier} />

        <div className="live-stats">
          <div>
            <div className="hero-metric">{sampledAnomaly.toFixed(3)}</div>
            <div className="hero-caption">
              Fused anomaly · sampled at T{tOff === 0 ? 0 : (tOff > 0 ? '+' : '') + tOff} d
            </div>
          </div>
          <span key={liveAlert} className="stamp" data-tone={liveAlert.toLowerCase()}>
            {ALERT_LABEL[liveAlert]}
          </span>
          <span className="tag" data-tone="info">
            Virtual cascade · <span className="num">T{virtualTier}</span>
          </span>
          <div className="right">
            Lead time at threshold ·{' '}
            <span className="num" style={{ color: 'var(--blue)' }}>
              {Math.abs(daysFromAdvisory(timeline, timeline.sentinelAlertDate))} d
            </span>
          </div>
        </div>

        <div className="live-grid">
          <AquaSSMCard sensor={record.sensor} maskPct={maskPct} />
          <HydroViTCard satellite={record.satellite} tier={virtualTier} date={state.currentDate} bbox={record.bbox} />
          <BioMotionCard bio={record.behavioral} />
          <MicroBiomeNetCard micro={record.microbial} />
          <ToxiGeneCard molecular={record.molecular} />
          <div className="mcard cascade-tile">
            <div className="t">Cascade controller</div>
            <div className="d">PPO-trained gate, escalating as evidence accumulates.</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              {[
                { tier: 0, label: 'Monitor · sensor + behavioural' },
                { tier: 1, label: 'Investigate · + satellite' },
                { tier: 2, label: 'Alert · + microbial' },
                { tier: 3, label: 'Confirm · + molecular' },
              ].map((t) => {
                const active = virtualTier >= t.tier;
                const current = virtualTier === t.tier;
                return (
                  <div key={t.tier} className={'cascade-step' + (active ? ' active' : '') + (current ? ' current' : '')}>
                    <span className="num">T{t.tier}</span>
                    {t.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="live-foot">
          <button className="btn btn-primary btn-icon" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            {playing ? <Pause size={15} strokeWidth={2} /> : <Play size={15} strokeWidth={2} />}
          </button>
          <button className={'btn btn-ghost btn-sm' + (speed > 1 ? ' on' : '')} onClick={cycleSpeed} title={`Speed ${speed}×`}>
            <FastForward size={13} strokeWidth={2} />
            <span className="num">{speed}×</span>
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => dispatch({ type: 'SET_DATE', date: timeline.advisoryDate })}
            title="Skip to advisory"
          >
            <ChevronsRight size={13} strokeWidth={2} />
            T0
          </button>
          <div className="playhead-track">
            <input
              type="range"
              className={playing ? 'playing' : undefined}
              min={0}
              max={totalDays}
              step={1}
              value={dayOffset}
              onChange={(e) => {
                const d = parseDay(timeline.windowStart) + Number(e.target.value) * MS_PER_DAY;
                dispatch({ type: 'SET_DATE', date: isoDay(d) });
              }}
              aria-label="Observation date"
            />
            <div className="playhead-markers">
              {timeline.milestones.map((m) => {
                const pct =
                  ((parseDay(m.date) - parseDay(timeline.windowStart)) /
                    Math.max(1, parseDay(timeline.windowEnd) - parseDay(timeline.windowStart))) *
                  100;
                const isBig = m.kind === 'sentinel-alert' || m.kind === 'official';
                return (
                  <button
                    key={m.date + m.title}
                    className={'marker' + (isBig ? ' big' : '')}
                    title={`${m.date} · ${m.title}`}
                    style={{ left: `${pct}%`, ['--mk' as string]: MARKER_COLOR[m.kind] }}
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'SET_DATE', date: m.date });
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------- stage caption: plain-language "what is happening now" ------- */

function StageCaption({
  timeline,
  state,
  virtualTier,
}: {
  timeline: EventTimeline;
  state: AppState;
  virtualTier: 0 | 1 | 2 | 3;
}) {
  let currentMilestone: Milestone | null = null;
  for (const m of timeline.milestones) {
    if (m.date <= state.currentDate) currentMilestone = m;
    else break;
  }

  const beforeAlert = state.currentDate < timeline.sentinelAlertDate;
  const inAlertWindow = state.currentDate >= timeline.sentinelAlertDate && state.currentDate < timeline.advisoryDate;

  const headline = beforeAlert
    ? 'Baseline · monitoring sensor + behavioural'
    : inAlertWindow
      ? `SENTINEL alert active · cascade ${virtualTier === 1 ? 'Investigate' : virtualTier === 2 ? 'Alert' : 'Monitor'}`
      : `Official advisory in effect · ${timeline.advisoryDate}`;

  const sub = currentMilestone ? `Now: ${currentMilestone.title}` : 'Awaiting first signal.';
  const tone = beforeAlert ? 'var(--ink-3)' : inAlertWindow ? 'var(--green)' : 'var(--red)';

  return (
    <div className="stage-caption" style={{ ['--tone' as string]: tone }}>
      <div className="h">{headline}</div>
      <div className="s">{sub}</div>
      {currentMilestone?.body && <div className="b">{currentMilestone.body}</div>}
    </div>
  );
}
