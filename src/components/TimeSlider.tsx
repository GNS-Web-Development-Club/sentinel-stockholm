import { useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward } from 'lucide-react';
import type { AppState, Action } from '../state';
import { getEventTimeline, type Milestone } from '../data/eventTimelines';
import { MARKER_COLOR } from './milestoneColors';

interface Props {
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

const MS_PER_DAY = 86400 * 1000;

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseDay(s: string): Date {
  return new Date(s + 'T00:00:00Z');
}

function fmtDay(s: string): string {
  const d = parseDay(s);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function TimeSlider({ state, dispatch }: Props) {
  // Window: if an EventTimeline is registered for the selected record, use its full
  // [windowStart, windowEnd] span. Otherwise fall back to T-60 → T-0 around the advisory.
  const advisory = state.selectedRecord?.advisoryDate;
  const timeline = getEventTimeline(state.selectedRecord?.eventKey);
  const startISO = timeline ? timeline.windowStart : undefined;
  const endISO = timeline ? timeline.windowEnd : undefined;
  const anchor = advisory ?? state.currentDate;
  const anchorD = parseDay(anchor);
  const startD = startISO ? parseDay(startISO) : new Date(anchorD.getTime() - 60 * MS_PER_DAY);
  const endD = endISO ? parseDay(endISO) : anchorD;
  const totalDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / MS_PER_DAY));

  const currentD = parseDay(state.currentDate);
  let dayOffset = Math.round((currentD.getTime() - startD.getTime()) / MS_PER_DAY);
  if (dayOffset < 0) dayOffset = 0;
  if (dayOffset > totalDays) dayOffset = totalDays;

  // Playback is globally owned (state.playingStory) so the live panel and the
  // slider stay in sync. One loop, one source of truth.
  const playing = state.playingStory;
  const speed = state.playStorySpeed;
  const lastTick = useRef(0);
  const endMs = endD.getTime();

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    lastTick.current = performance.now();
    // 1× = 1 day per 400 ms (2.5 days/s), slow enough to read each slip as it lands.
    const interval = 400 / speed;
    const tick = (t: number) => {
      if (t - lastTick.current >= interval) {
        lastTick.current = t;
        const cur = parseDay(state.currentDate).getTime();
        const next = cur + MS_PER_DAY;
        if (next > endMs) {
          dispatch({ type: 'STOP_STORY' });
          return;
        }
        dispatch({ type: 'SET_DATE', date: isoDay(new Date(next)) });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, state.currentDate, dispatch, endMs]);

  const togglePlay = () => {
    if (playing) {
      dispatch({ type: 'STOP_STORY' });
      return;
    }
    const restart = state.currentDate >= isoDay(endD);
    dispatch({ type: 'START_STORY', from: restart ? isoDay(startD) : undefined });
  };

  const onSlide = (e: React.ChangeEvent<HTMLInputElement>) => {
    const offset = Number(e.target.value);
    const d = new Date(startD.getTime() + offset * MS_PER_DAY);
    dispatch({ type: 'SET_DATE', date: isoDay(d) });
  };

  const reset = () => {
    if (playing) dispatch({ type: 'STOP_STORY' });
    dispatch({ type: 'SET_DATE', date: isoDay(startD) });
    dispatch({ type: 'RESET_STORY_FIRES' });
  };

  if (!advisory) return null;

  // T-offset relative to advisory (negative = before).
  const advisoryD = parseDay(advisory);
  const tEvent = Math.round((currentD.getTime() - advisoryD.getTime()) / MS_PER_DAY);

  const markers: { milestone: Milestone; pct: number }[] = timeline
    ? timeline.milestones.map((m) => ({
        milestone: m,
        pct:
          Math.max(
            0,
            Math.min(1, (parseDay(m.date).getTime() - startD.getTime()) / (endD.getTime() - startD.getTime())),
          ) * 100,
      }))
    : [];

  return (
    <div className="playhead" role="group" aria-label="Time playback">
      <button className="btn btn-ghost btn-sm btn-icon" onClick={reset} title="Reset to window start">
        <RotateCcw size={14} strokeWidth={2} />
      </button>
      <button className="btn btn-primary btn-sm btn-icon" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
        {playing ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} />}
      </button>
      <button
        className={'btn btn-ghost btn-sm' + (speed > 1 ? ' on' : '')}
        onClick={() => {
          const next = speed === 1 ? 4 : speed === 4 ? 16 : 1;
          dispatch({ type: 'SET_STORY_SPEED', speed: next });
        }}
        title={`Playback speed (${speed}×)`}
      >
        <FastForward size={13} strokeWidth={2} />
        <span className="num">{speed}×</span>
      </button>
      <div className="playhead-track">
        <input
          type="range"
          className={playing ? 'playing' : undefined}
          min={0}
          max={totalDays}
          step={1}
          value={dayOffset}
          onChange={onSlide}
          aria-label="Observation date"
        />
        {markers.length > 0 && (
          <div className="playhead-markers">
            {markers.map(({ milestone: m, pct }) => (
              <button
                key={m.date + m.title}
                className={'marker' + (m.kind === 'sentinel-alert' || m.kind === 'official' ? ' big' : '')}
                title={`${m.date} · ${m.title}`}
                style={{ left: `${pct}%`, ['--mk' as string]: MARKER_COLOR[m.kind] }}
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ type: 'SET_DATE', date: m.date });
                }}
              />
            ))}
          </div>
        )}
      </div>
      <div className="playhead-date">
        <div className="d">{fmtDay(state.currentDate)}</div>
        <div className="t" style={{ color: tEvent >= 0 ? 'var(--red)' : 'var(--blue)' }}>
          {tEvent === 0 ? 'Advisory day' : tEvent > 0 ? `T+${tEvent} d` : `T${tEvent} d`}
        </div>
      </div>
    </div>
  );
}
