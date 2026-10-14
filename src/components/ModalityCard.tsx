import { useEffect, useRef, useState } from 'react';
import type { Coverage } from '../types';

interface Props {
  name: string;
  subtitle: string;
  accentColor: string;
  coverage: Coverage;
  conf?: number;
  headlineMetric?: React.ReactNode;
  headlineLabel?: string;
  secondary?: React.ReactNode;
  children?: React.ReactNode;
  deployableTier?: number;
}

const COV_COLOR: Record<Coverage, string> = {
  OBSERVED: 'var(--green)',
  INFERRED: 'var(--ochre)',
  DEPLOYABLE: 'var(--rule-strong)',
  PROJECTED: 'var(--blue)',
};

const COV_LABEL: Record<Coverage, string> = {
  OBSERVED: 'Observed',
  INFERRED: 'Inferred',
  DEPLOYABLE: 'Deployable',
  PROJECTED: 'Projected',
};

const COV_TOOLTIP: Record<Coverage, string> = {
  OBSERVED: 'Direct measurement from this site.',
  INFERRED: 'Estimated from nearby stations / regional baseline.',
  PROJECTED: 'Modelled forward from sensor + satellite signals.',
  DEPLOYABLE: 'Modality available but not yet activated — escalate to enable.',
};

export function ModalityCard({
  name,
  subtitle,
  accentColor,
  coverage,
  conf,
  headlineMetric,
  headlineLabel,
  secondary,
  children,
  deployableTier,
}: Props) {
  const deployable = coverage === 'DEPLOYABLE';

  // Processing sweep: when a modality goes from DEPLOYABLE to a live state,
  // play a 700 ms line sweep over the well before the content settles in.
  const prevCoverage = useRef(coverage);
  const [processing, setProcessing] = useState(false);
  useEffect(() => {
    if (prevCoverage.current === 'DEPLOYABLE' && coverage !== 'DEPLOYABLE') {
      const start = window.setTimeout(() => setProcessing(true), 0);
      const stop = window.setTimeout(() => setProcessing(false), 700);
      prevCoverage.current = coverage;
      return () => {
        window.clearTimeout(start);
        window.clearTimeout(stop);
      };
    }
    prevCoverage.current = coverage;
    return;
  }, [coverage]);

  return (
    <div className={'mcard' + (deployable ? ' deployable' : '')}>
      <div className="mcard-head">
        <div>
          <div className="mcard-name">
            <span className="swatch-sq" style={{ background: accentColor }} />
            {name}
          </div>
          <div className="mcard-sub">{subtitle}</div>
        </div>
        <CoverageChip coverage={coverage} conf={conf} />
      </div>
      <div className="mcard-well" style={{ ['--line' as string]: accentColor }}>
        {deployable ? (
          <div className="placeholder">Activate at tier {deployableTier ?? '?'}</div>
        ) : (
          <>
            {children}
            {processing && (
              <>
                <div className="processing-veil" />
                <div className="processing-line" />
                <div className="processing-label">Processing</div>
              </>
            )}
          </>
        )}
      </div>
      {headlineMetric && (
        <div className="mcard-foot">
          <div>
            <div className="mcard-metric">{headlineMetric}</div>
            {headlineLabel && <div className="mcard-metric-label">{headlineLabel}</div>}
          </div>
          {secondary && <div className="mcard-secondary">{secondary}</div>}
        </div>
      )}
    </div>
  );
}

function CoverageChip({ coverage, conf }: { coverage: Coverage; conf?: number }) {
  return (
    <div className="cov" title={COV_TOOLTIP[coverage]} style={{ ['--cov' as string]: COV_COLOR[coverage] }}>
      <span className="swatch-sq" />
      {COV_LABEL[coverage]}
      {coverage === 'INFERRED' && conf !== undefined && <span className="num">{conf.toFixed(2)}</span>}
    </div>
  );
}
