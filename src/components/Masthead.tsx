import { useEffect, useState } from 'react';
import { ExternalLink, Eye, FileText } from 'lucide-react';
import type { Action } from '../state';

function useUtcClock() {
  const [t, setT] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setT(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return t.toISOString().slice(11, 19) + ' UTC';
}

interface Props {
  dispatch: React.Dispatch<Action>;
  colorBlind: boolean;
}

// Figures quoted from the project README (validation on real USGS / NEON data).
const FIGURES: { n: string; l: string }[] = [
  { n: '31', l: 'events detected' },
  { n: '32 d', l: 'mean lead time' },
  { n: '0.939', l: 'fusion AUROC, holdout' },
  { n: '0', l: 'false alarms, 10 clean sites' },
];

export function Masthead({ dispatch, colorBlind }: Props) {
  const clock = useUtcClock();
  return (
    <header className="masthead">
      <div className="masthead-left">
        <div className="masthead-titleline">
          <h1 className="masthead-title">SENTINEL</h1>
          <span className="masthead-kicker">Survey chart · freshwater contamination early warning</span>
        </div>
        <p className="masthead-sub">
          <span className="sub-long">
            A multimodal deep learning system that fuses five sensing modalities — physicochemical
            sensors, satellite imagery, microbial community profiles, molecular toxicogenomics and
            organism behavioural assays — through a Perceiver IO architecture to flag contamination
            weeks before an official advisory. This chart replays real past events on the sites where
            they happened.
          </span>
          <span className="sub-short">
            Multimodal deep learning for freshwater contamination early warning: five sensing
            modalities fused by a Perceiver IO model, replayed here on real past events.
          </span>
        </p>
        <div className="masthead-by">
          <span>
            <strong>Bryan Cheng</strong> · Stockholm Junior Water Prize 2026
          </span>
          <a href="https://github.com/austinjin1/SENTINEL-STOCKHOLM" target="_blank" rel="noreferrer">
            Paper and code <ExternalLink size={13} strokeWidth={2} style={{ verticalAlign: '-2px' }} />
          </a>
        </div>
      </div>
      <div className="masthead-right">
        <div className="figures">
          {FIGURES.map((f) => (
            <div className="figure" key={f.l}>
              <div className="figure-n">{f.n}</div>
              <div className="figure-l">{f.l}</div>
            </div>
          ))}
        </div>
        <div className="masthead-actions">
          <span className="clock">{clock}</span>
          <button
            className={'btn btn-ghost' + (colorBlind ? ' on' : '')}
            onClick={() => dispatch({ type: 'TOGGLE_COLORBLIND' })}
            title={colorBlind ? 'Switch to default palette' : 'Switch to colour-blind-safe palette'}
          >
            <Eye size={15} strokeWidth={1.75} />
            {colorBlind ? 'Colour-blind palette on' : 'Colour-blind palette'}
          </button>
          <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_METHODOLOGY' })}>
            <FileText size={15} strokeWidth={1.75} />
            Methodology
          </button>
        </div>
      </div>
    </header>
  );
}
