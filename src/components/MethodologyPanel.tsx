import { X } from 'lucide-react';
import type { Action } from '../state';
import { MICROBIAL_VALIDATION, MOLECULAR_VALIDATION, BEHAVIORAL_VALIDATION } from '../data/realData';

interface Props {
  open: boolean;
  dispatch: React.Dispatch<Action>;
}

const ROWS: { metric: string; value: string; source: string }[] = [
  { metric: 'AquaSSM AUROC', value: '0.920', source: 'Paper §3.1 · CI [0.91, 0.93]' },
  { metric: 'HydroViT R² (water temperature)', value: '0.749', source: 'Paper §3.2 · 4,202 Sentinel-2 / in-situ pairs' },
  { metric: 'MicroBiomeNet F1 (8-class)', value: '0.913', source: 'Paper §3.3 · EMP 16S rRNA' },
  { metric: 'ToxiGene F1 (multi-label)', value: '0.894', source: 'Paper §3.4 · GEO + ECOTOX' },
  { metric: 'BioMotion AUROC', value: '1.000', source: 'Paper §3.5 · lab benchmark, down-weighted in fusion' },
  { metric: 'Fusion AUROC', value: '0.939', source: 'Paper §3.6 · CI [0.922, 0.956], p = 0.002 vs sensor' },
  { metric: 'Lake Erie HAB lead time', value: '59.3 d', source: 'Repo · case_studies_real/lake_erie_hab_2023_scores.json' },
  { metric: 'Cascade tier cost progression', value: '$15K / +$0.5K / +$15K / +$25K', source: 'Paper §4 cascade design' },
  { metric: 'Modality decay half-lives', value: '5 m / 2 h / 3 d / 5 d / 7 d', source: 'Paper §2 fusion module' },
];

export function MethodologyPanel({ open, dispatch }: Props) {
  if (!open) return null;
  const close = () => dispatch({ type: 'TOGGLE_METHODOLOGY' });
  return (
    <div className="scrim" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Methodology">
        <div className="modal-head">
          <div>
            <h2 className="modal-title">What is real, what is modelled</h2>
            <p className="modal-sub">
              Every number on this chart carries a provenance tag. Validation figures come from the paper and
              the results files in the repository; the live playback and what-if tools are illustrative.
            </p>
          </div>
          <button className="btn btn-icon" onClick={close} title="Close">
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="prov-grid">
          {ROWS.map((r) => (
            <div key={r.metric} className="prov-row">
              <div className="m">{r.metric}</div>
              <div className="v">{r.value}</div>
              <div className="s">{r.source}</div>
            </div>
          ))}
        </div>

        <h3>Off-event validation evidence</h3>
        <div className="validation">
          <p>
            <span style={{ color: 'var(--m-microbial)', fontWeight: 600 }}>Microbial</span>
            {' — '}
            {MICROBIAL_VALIDATION.slice(0, 3)
              .map((v) => `${v.event.split(' — ')[0]} ${(v.detection_rate * 100).toFixed(0)}%`)
              .join(' · ')}
          </p>
          <p>
            <span style={{ color: 'var(--m-molecular)', fontWeight: 600 }}>Molecular</span>
            {' — '}
            {MOLECULAR_VALIDATION.slice(0, 3)
              .map((v) => `${v.contaminant} ${(v.rate * 100).toFixed(0)}%`)
              .join(' · ')}
          </p>
          <p>
            <span style={{ color: 'var(--m-behavioral)', fontWeight: 600 }}>Behavioural</span>
            {' — '}
            {BEHAVIORAL_VALIDATION.slice(0, 3)
              .map((v) => `${v.chemical.split('(')[0].trim()} ${(v.detection_rate * 100).toFixed(0)}%`)
              .join(' · ')}
          </p>
        </div>

        <div className="prov-note">
          <strong>Observed</strong> · real cached sample at this cell. <strong>Inferred</strong> · regional baseline
          with distance-decayed confidence. <strong>Deployable</strong> · inactive until the cascade activates it.{' '}
          <strong>Projected</strong> · activated cell with no physical sample; illustrative.
          <div style={{ marginTop: 8, color: 'var(--ink-3)' }}>
            Cached and modelled data, fully client-side apart from optional USGS NWIS and NASA GIBS requests. Not
            for operational use.
          </div>
        </div>
      </div>
    </div>
  );
}
