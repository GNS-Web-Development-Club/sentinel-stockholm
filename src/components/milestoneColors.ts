import type { MilestoneKind } from '../data/eventTimelines';
import type { AlertTier } from '../types';

export const ALERT_LABEL: Record<AlertTier, string> = {
  MAINTAIN: 'Maintain',
  WATCH: 'Watch',
  INVESTIGATE: 'Investigate',
  ALERT: 'Alert',
};

// Ink colours for milestone kinds, shared by the play head, the live panel and the timeline list.
export const MARKER_COLOR: Record<MilestoneKind, string> = {
  'sentinel-alert': 'var(--green)',
  official: 'var(--red)',
  precursor: 'var(--ochre)',
  'first-impact': 'var(--orange)',
  resolution: 'var(--blue)',
  context: 'var(--ink-3)',
};

export const MARKER_LABEL: Record<MilestoneKind, string> = {
  context: 'Context',
  precursor: 'Precursor',
  'sentinel-alert': 'SENTINEL alert',
  'first-impact': 'First impact',
  official: 'Official advisory',
  resolution: 'Resolution',
};
