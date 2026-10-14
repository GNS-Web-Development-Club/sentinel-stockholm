import type { Molecular } from '../../types';
import { ModalityCard } from '../ModalityCard';

interface Props {
  molecular: Molecular;
}

const PATHWAYS = [
  'AHR/CYP1A',
  'Metallothionein',
  'Estrogen/Endocrine',
  'Cholinesterase',
  'Oxidative Stress',
  'Heat Shock',
  'DNA Damage',
];
const PROCESSES = ['Xenobiotic Metabolism', 'Oxidative Response', 'Endocrine Signaling', 'Genotoxic Response'];
const OUTCOMES = ['Hepatotoxicity', 'Neurotoxicity', 'Reproductive Impairment', 'Endocrine Disruption'];

function Tier({ label, nodes, lit }: { label: string; nodes: string[]; lit: string | null }) {
  return (
    <div className="tox-tier">
      <div className="tox-tier-l">{label}</div>
      {nodes.map((n) => (
        <span key={n} className={'tox-node' + (n === lit ? ' lit' : '')}>
          {n}
        </span>
      ))}
    </div>
  );
}

export function ToxiGeneCard({ molecular }: Props) {
  const active = molecular.activePath;
  return (
    <ModalityCard
      name="ToxiGene"
      subtitle="P-Net hierarchy · gene → pathway → process → outcome"
      accentColor="var(--m-molecular)"
      coverage={molecular.state}
      conf={molecular.conf}
      deployableTier={3}
      headlineMetric={<>F1 0.894</>}
      headlineLabel="Multi-label toxicity"
      secondary={molecular.outcome ? <span>Outcome {molecular.outcome}</span> : null}
    >
      <div className="tox">
        <Tier label="Pathways" nodes={PATHWAYS} lit={active?.pathway ?? null} />
        <Tier label="Processes" nodes={PROCESSES} lit={active?.process ?? null} />
        <Tier label="Outcomes" nodes={OUTCOMES} lit={active?.outcome ?? null} />
        <div className="tox-chain">
          {active
            ? `${active.pathway} → ${active.process} → ${active.outcome}`
            : 'No pathway activated — expression profile within baseline.'}
        </div>
      </div>
    </ModalityCard>
  );
}
