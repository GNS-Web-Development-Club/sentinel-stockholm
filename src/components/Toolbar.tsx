import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Keyboard, Layers as LayersIcon, PlayCircle } from 'lucide-react';
import type { Action, Layers } from '../state';
import type { CanonicalRecord } from '../types';

interface Props {
  layers: Layers;
  legendOpen: boolean;
  demoMode: boolean;
  events: CanonicalRecord[];
  cleanSites: CanonicalRecord[];
  dispatch: React.Dispatch<Action>;
  onHelp: () => void;
}

const LAYER_CHIPS: { key: keyof Layers; label: string; swatch: string; hint: string }[] = [
  { key: 'usgs', label: 'USGS stations', swatch: 'var(--m-sensor)', hint: '1' },
  { key: 'neon', label: 'NEON sites', swatch: 'var(--m-microbial)', hint: '2' },
  { key: 'satellite', label: 'MODIS true colour', swatch: 'var(--m-satellite)', hint: '3' },
  { key: 'chlorophyll', label: 'Chlorophyll-a', swatch: '#3fa063', hint: '4' },
  { key: 'drought', label: 'Drought monitor', swatch: 'var(--ochre)', hint: '5' },
];

const SHORT: Record<string, string> = {
  'Lake Erie HAB 2023': 'Lake Erie HAB, 2023',
  'Gulf Dead Zone 2023': 'Gulf of Mexico dead zone, 2023',
  'Chesapeake Hypoxia 2018': 'Chesapeake Bay hypoxia, 2018',
  'Klamath River HAB 2021': 'Klamath River HAB, 2021',
  'Mississippi Salinity 2023': 'Mississippi River salinity, 2023',
  'Jordan Lake HAB 2022': 'Jordan Lake HAB, 2022',
  'Jordan Lake HAB Nc': 'Jordan Lake HAB, 2022',
  'Toolik Lake, AK': 'Toolik Lake, AK (reference)',
  'Sycamore Creek, AZ': 'Sycamore Creek, AZ (reference)',
};

export function Toolbar({ layers, legendOpen, demoMode, events, cleanSites, dispatch, onHelp }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const pick = (rec: CanonicalRecord) => {
    dispatch({ type: 'SELECT_SITE', record: rec });
    setOpen(false);
  };

  return (
    <nav className="toolbar" aria-label="Chart controls">
      <div className="toolbar-group" ref={menuRef}>
        <button className={'btn' + (open ? ' on' : '')} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          Recorded events
          <ChevronDown size={14} strokeWidth={2} />
        </button>
        {open && (
          <div className="menu" role="menu">
            <div className="menu-heading">Validated contamination events</div>
            {events.map((e) => (
              <button key={e.id} className="menu-item" role="menuitem" onClick={() => pick(e)}>
                {SHORT[e.name] ?? e.name}
              </button>
            ))}
            <div className="menu-rule" />
            <div className="menu-heading">Clean reference sites</div>
            {cleanSites.map((e) => (
              <button key={e.id} className="menu-item dim" role="menuitem" onClick={() => pick(e)}>
                {SHORT[e.name] ?? e.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="toolbar-group layers" role="group" aria-label="Map layers">
        <span className="toolbar-label">Layers</span>
        {LAYER_CHIPS.map((c) => {
          const on = layers[c.key];
          return (
            <button
              key={c.key}
              className={'chip' + (on ? ' on' : '')}
              style={{ ['--swatch' as string]: c.swatch }}
              onClick={() => dispatch({ type: 'TOGGLE_LAYER', layer: c.key })}
              aria-pressed={on}
            >
              <span className="chip-box" />
              {c.label}
              <kbd>{c.hint}</kbd>
            </button>
          );
        })}
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          className={'btn btn-ghost' + (legendOpen ? ' on' : '')}
          onClick={() => dispatch({ type: 'TOGGLE_LEGEND' })}
          aria-pressed={legendOpen}
        >
          <LayersIcon size={15} strokeWidth={1.75} />
          Legend
        </button>
        <button
          className={'btn btn-ghost' + (demoMode ? ' on' : '')}
          onClick={() => dispatch({ type: 'TOGGLE_DEMO' })}
          aria-pressed={demoMode}
        >
          <PlayCircle size={15} strokeWidth={1.75} />
          {demoMode ? 'Stop tour' : 'Guided tour'}
        </button>
        <button className="btn btn-ghost btn-icon" onClick={onHelp} title="Keyboard shortcuts (?)">
          <Keyboard size={16} strokeWidth={1.75} />
        </button>
      </div>
    </nav>
  );
}
