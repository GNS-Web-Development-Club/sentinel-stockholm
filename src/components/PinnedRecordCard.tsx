import { ArrowLeftRight, X, Pin } from 'lucide-react';
import type { CanonicalRecord } from '../types';
import type { Action } from '../state';

interface Props {
  pinned: CanonicalRecord;
  selected: CanonicalRecord | null;
  dispatch: React.Dispatch<Action>;
}

// Bottom-left slip on the chart showing the pinned record for A/B comparison.
// Swap exchanges pinned and selected; X clears the pin.
export function PinnedRecordCard({ pinned, selected, dispatch }: Props) {
  const delta = selected ? selected.fusion.anomaly - pinned.fusion.anomaly : 0;
  const deltaColor = Math.abs(delta) < 0.05 ? 'var(--ink-3)' : delta > 0 ? 'var(--red)' : 'var(--green)';
  const canSwap = !!selected && selected.id !== pinned.id;
  return (
    <div className="pinned">
      <Pin size={14} strokeWidth={2} color="var(--blue)" />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="pinned-name">{pinned.name}</div>
        <div className="pinned-sub">
          anomaly <span className="num">{pinned.fusion.anomaly.toFixed(3)}</span>
          {canSwap && (
            <>
              {' · Δ '}
              <span className="num" style={{ color: deltaColor }}>
                {delta >= 0 ? '+' : ''}
                {delta.toFixed(3)}
              </span>
            </>
          )}
        </div>
      </div>
      <button
        className="btn btn-ghost btn-sm btn-icon"
        onClick={() => dispatch({ type: 'SWAP_PINNED' })}
        title="Swap pinned and selected"
        disabled={!canSwap}
      >
        <ArrowLeftRight size={13} strokeWidth={2} />
      </button>
      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => dispatch({ type: 'PIN_RECORD', record: null })} title="Clear pin">
        <X size={13} strokeWidth={2} />
      </button>
    </div>
  );
}
