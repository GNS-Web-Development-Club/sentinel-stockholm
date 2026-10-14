import { Play, Pause, FastForward, ChevronsRight } from 'lucide-react';
import type { EventTimeline } from '../data/eventTimelines';
import { daysFromAdvisory } from '../data/eventTimelines';
import type { AppState, Action } from '../state';
import { MARKER_COLOR, MARKER_LABEL } from './milestoneColors';

interface Props {
  timeline: EventTimeline;
  state: AppState;
  dispatch: React.Dispatch<Action>;
}

export function EventTimelinePanel({ timeline, state, dispatch }: Props) {
  const playing = state.playingStory;
  const speed = state.playStorySpeed;
  const currentDate = state.currentDate;

  // The playback loop is owned by TimeSlider; this panel only dispatches actions.
  const onPlay = () => {
    if (playing) {
      dispatch({ type: 'STOP_STORY' });
      return;
    }
    const restart = currentDate >= timeline.windowEnd;
    dispatch({ type: 'START_STORY', from: restart ? timeline.windowStart : undefined });
  };

  // Index of the most recent milestone whose date ≤ currentDate.
  let currentIdx = -1;
  for (let i = 0; i < timeline.milestones.length; i++) {
    if (timeline.milestones[i].date <= currentDate) currentIdx = i;
    else break;
  }

  return (
    <div>
      <div className="ms-controls">
        <button className={'btn btn-sm' + (playing ? '' : ' btn-primary')} onClick={onPlay}>
          {playing ? <Pause size={13} strokeWidth={2} /> : <Play size={13} strokeWidth={2} />}
          {playing ? 'Pause' : 'Play story'}
        </button>
        <button
          className={'btn btn-ghost btn-sm' + (speed > 1 ? ' on' : '')}
          onClick={() => {
            const next = speed === 1 ? 4 : speed === 4 ? 16 : 1;
            dispatch({ type: 'SET_STORY_SPEED', speed: next });
          }}
          title={`Story speed (${speed}×)`}
        >
          <FastForward size={13} strokeWidth={2} />
          <span className="num">{speed}×</span>
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'SET_DATE', date: timeline.advisoryDate })}
          title="Jump to advisory"
        >
          <ChevronsRight size={13} strokeWidth={2} />
          Skip to advisory
        </button>
      </div>

      <div className="ms-list">
        {timeline.milestones.map((m, i) => {
          const past = m.date <= currentDate;
          const current = i === currentIdx;
          const fired = state.firedMilestones.includes(`${timeline.eventKey}|${m.date}`);
          const offset = daysFromAdvisory(timeline, m.date);
          return (
            <button
              key={m.date + m.title}
              className={'ms' + (past ? ' past' : '') + (current ? ' current' : '')}
              style={{ ['--mk' as string]: MARKER_COLOR[m.kind] }}
              onClick={() => dispatch({ type: 'SET_DATE', date: m.date })}
            >
              <div className="ms-top">
                <span className="ms-date">
                  {m.date} · {offset === 0 ? 'T0' : offset > 0 ? `T+${offset} d` : `T${offset} d`}
                </span>
                <span className="ms-kind">{MARKER_LABEL[m.kind]}</span>
                {fired && <span className="ms-fired">logged</span>}
              </div>
              <div className="ms-title">{m.title}</div>
              {m.body && <div className="ms-body">{m.body}</div>}
              {m.source && (
                <div className="ms-source">
                  Source:{' '}
                  {m.source.url ? (
                    <a href={m.source.url} target="_blank" rel="noreferrer">
                      {m.source.label}
                    </a>
                  ) : (
                    m.source.label
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="lead-callout">
        <b>
          Lead time · <span className="num">{Math.abs(daysFromAdvisory(timeline, timeline.sentinelAlertDate))} d</span>
        </b>
        <br />
        {timeline.leadSummary}
      </div>
    </div>
  );
}
