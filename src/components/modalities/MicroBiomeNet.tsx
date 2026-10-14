import type { Microbial } from '../../types';
import { ModalityCard } from '../ModalityCard';

interface Props {
  micro: Microbial;
}

export function MicroBiomeNetCard({ micro }: Props) {
  const sorted = [...micro.classes].sort((a, b) => b.p - a.p);
  const max = sorted[0]?.p ?? 1;
  return (
    <ModalityCard
      name="MicroBiomeNet"
      subtitle="Aitchison transformer + simplex neural ODE · CLR space"
      accentColor="var(--m-microbial)"
      coverage={micro.state}
      conf={micro.conf}
      deployableTier={2}
      headlineMetric={<>F1 0.913</>}
      headlineLabel="Eight-class source attribution"
      secondary={
        micro.top ? (
          <span>
            Top {micro.top} <span className="num">{sorted[0].p.toFixed(2)}</span>
          </span>
        ) : null
      }
    >
      <div className="bar-rows">
        {sorted.map((c, i) => {
          const top = i === 0;
          return (
            <div key={c.name} className="bar-row">
              <div className={'l' + (top ? ' top' : '')} title={c.name}>{c.name}</div>
              <div className="bar">
                <div className={top ? 'top' : undefined} style={{ width: `${(c.p / max) * 100}%` }} />
              </div>
              <div className="v">{c.p.toFixed(2)}</div>
            </div>
          );
        })}
      </div>
    </ModalityCard>
  );
}
