import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import './styles.css';
import { Masthead } from './components/Masthead';
import { Toolbar } from './components/Toolbar';
import { MapCanvas } from './components/MapCanvas';
import { TimeSlider } from './components/TimeSlider';
import { PlaceCard } from './components/PlaceCard';
import { ImportDropZone } from './components/ImportDropZone';
import { PinnedRecordCard } from './components/PinnedRecordCard';
import { LivePlaybackPanel } from './components/LivePlaybackPanel';
import { getEventTimeline } from './data/eventTimelines';
import { useToasts } from './components/toastContext';
import { DemoOverlay } from './components/DemoOverlay';
import { MethodologyPanel } from './components/MethodologyPanel';
import { EVENTS, CLEAN_SITES } from './data/realData';
import { useAppState } from './state';
import { applyTierActivation } from './engine/escalate';
import { readInitialUrlState, useUrlSync } from './urlState';

const LAYER_KEYS = ['usgs', 'neon', 'satellite', 'chlorophyll', 'drought'] as const;
const MS_PER_DAY = 86400000;

function shiftDate(iso: string, days: number): string {
  const t = new Date(iso + 'T00:00:00Z').getTime() + days * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

function App() {
  const [state, dispatch] = useAppState();
  const prevTier = useRef(state.cascadeTier);
  const urlHydrated = useRef(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const { push: pushToast } = useToasts();

  // Story-playback milestone toaster: when the play head crosses a milestone we
  // haven't toasted yet, push a kind-coloured toast and mark it fired. Skipped
  // entirely when not in playingStory mode so manual scrubs don't spam toasts.
  useEffect(() => {
    if (!state.playingStory) return;
    const timeline = getEventTimeline(state.selectedRecord?.eventKey);
    if (!timeline) return;
    for (const m of timeline.milestones) {
      if (m.date > state.currentDate) break;
      const key = `${timeline.eventKey}|${m.date}`;
      if (state.firedMilestones.includes(key)) continue;
      const kind =
        m.kind === 'sentinel-alert' ? 'success'
        : m.kind === 'official' || m.kind === 'first-impact' ? 'error'
        : 'info';
      pushToast(kind, `${m.title}  ·  ${m.date}`, 5200);
      dispatch({ type: 'MARK_MILESTONE_FIRED', key });
      // Auto-escalate the real cascade tier if the milestone requests it. The cost
      // strip in PlaceCard ticks up in lockstep with the story.
      if (m.escalateTo !== undefined && m.escalateTo > state.cascadeTier) {
        dispatch({ type: 'SET_CASCADE_TIER', tier: m.escalateTo });
      }
    }
  }, [
    state.playingStory,
    state.currentDate,
    state.selectedRecord,
    state.firedMilestones,
    state.cascadeTier,
    pushToast,
    dispatch,
  ]);

  // Global keyboard shortcuts. Disabled while the user is typing in an input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key) {
        case 'e': case 'E': dispatch({ type: 'ESCALATE' }); break;
        case 'd': case 'D': dispatch({ type: 'DEESCALATE' }); break;
        case '1': case '2': case '3': case '4': case '5': {
          const layer = LAYER_KEYS[parseInt(e.key, 10) - 1];
          if (layer) dispatch({ type: 'TOGGLE_LAYER', layer });
          break;
        }
        case '[': dispatch({ type: 'SET_DATE', date: shiftDate(state.currentDate, -1) }); break;
        case ']': dispatch({ type: 'SET_DATE', date: shiftDate(state.currentDate, +1) }); break;
        case '?': setHelpOpen((v) => !v); break;
        case 'Escape':
          if (helpOpen) setHelpOpen(false);
          else if (state.selectedRecord) dispatch({ type: 'CLOSE_RAIL' });
          break;
        case 'p': case 'P':
          if (state.selectedRecord) dispatch({ type: 'PIN_RECORD', record: state.selectedRecord });
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch, state.currentDate, state.selectedRecord, helpOpen]);

  // Hydrate from URL exactly once.
  useEffect(() => {
    if (urlHydrated.current) return;
    urlHydrated.current = true;
    readInitialUrlState(dispatch, state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useUrlSync(state);

  useEffect(() => {
    if (!state.selectedRecord) {
      prevTier.current = 0;
      return;
    }
    const record = state.selectedRecord;
    if (state.cascadeTier > prevTier.current) {
      const id = window.setTimeout(() => {
        const patch = applyTierActivation(record, state.cascadeTier);
        dispatch({ type: 'PATCH_RECORD', patch });
      }, 900);
      prevTier.current = state.cascadeTier;
      return () => clearTimeout(id);
    }
    prevTier.current = state.cascadeTier;
    return;
    // recordId guards the closure: switching records cancels the pending patch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.cascadeTier, state.selectedRecord?.id]);

  const timeline = getEventTimeline(state.selectedRecord?.eventKey);

  return (
    <div className={'app' + (state.selectedRecord ? ' has-sheet' : '')}>
      <Masthead dispatch={dispatch} colorBlind={state.colorBlind} />
      <Toolbar
        layers={state.layers}
        legendOpen={state.legendOpen}
        demoMode={state.demoMode}
        events={EVENTS}
        cleanSites={CLEAN_SITES}
        dispatch={dispatch}
        onHelp={() => setHelpOpen((v) => !v)}
      />
      <main className={'stage' + (state.selectedRecord ? ' has-sheet' : '')}>
        <section className="chart" aria-label="Survey chart">
          <MapCanvas
            selected={state.selectedRecord}
            layers={state.layers}
            legendOpen={state.legendOpen}
            dispatch={dispatch}
            date={state.currentDate}
            colorBlind={state.colorBlind}
          />
          <TimeSlider state={state} dispatch={dispatch} />
          {state.pinnedRecord && (
            <PinnedRecordCard
              pinned={state.pinnedRecord}
              selected={state.selectedRecord}
              dispatch={dispatch}
            />
          )}
        </section>
        {state.selectedRecord && (
          <PlaceCard state={state} dispatch={dispatch} record={state.selectedRecord} />
        )}
      </main>
      <DemoOverlay active={state.demoMode} dispatch={dispatch} />
      <MethodologyPanel open={state.methodologyOpen} dispatch={dispatch} />
      <ImportDropZone dispatch={dispatch} />
      {helpOpen && <KeyHelp onClose={() => setHelpOpen(false)} />}
      {timeline && state.selectedRecord && state.playingStory && (
        <LivePlaybackPanel
          timeline={timeline}
          record={state.selectedRecord}
          state={state}
          dispatch={dispatch}
          onClose={() => dispatch({ type: 'STOP_STORY' })}
        />
      )}
    </div>
  );
}

function KeyHelp({ onClose }: { onClose: () => void }) {
  const rows: [string, string][] = [
    ['E / D', 'Escalate / de-escalate cascade tier'],
    ['1 – 5', 'Toggle USGS / NEON / true colour / chlorophyll-a / drought layers'],
    ['[ / ]', 'Step the date one day back / forward'],
    ['P', 'Pin the selected record for comparison'],
    ['Esc', 'Close record sheet or this help'],
    ['?', 'Show this help'],
  ];
  return (
    <div className="scrim" onClick={onClose}>
      <div className="modal" style={{ width: 'min(480px, 100%)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="modal-head">
          <h2 className="modal-title">Keyboard shortcuts</h2>
          <button className="btn btn-icon" onClick={onClose} title="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div style={{ marginTop: 14 }}>
          {rows.map(([k, label]) => (
            <div key={k} className="keys-row">
              <kbd>{k}</kbd>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
