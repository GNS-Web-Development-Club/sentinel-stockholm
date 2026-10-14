import { AlertTriangle, ShieldCheck, Clock } from 'lucide-react';
import type { EventTimeline } from '../data/eventTimelines';
import { daysBetween } from '../engine/timeSample';

interface Props {
  timeline: EventTimeline;
  currentDate: string;
}

// Ribbon across the top of the record sheet. Three states:
//   pre-alert (grey), SENTINEL alert window (green), post-advisory (red).
export function EventBanner({ timeline, currentDate }: Props) {
  const beforeAlert = currentDate < timeline.sentinelAlertDate;
  const inAlertWindow = currentDate >= timeline.sentinelAlertDate && currentDate < timeline.advisoryDate;

  const daysToAdvisory = daysBetween(currentDate, timeline.advisoryDate);
  const daysFromAdvisory = daysBetween(timeline.advisoryDate, currentDate);

  const tone = beforeAlert ? 'pre' : inAlertWindow ? 'alert' : 'advisory';
  const icon = beforeAlert
    ? <Clock size={15} strokeWidth={2} />
    : inAlertWindow
      ? <ShieldCheck size={15} strokeWidth={2} />
      : <AlertTriangle size={15} strokeWidth={2} />;

  const label = beforeAlert
    ? 'Baseline · no SENTINEL signal yet'
    : inAlertWindow
      ? `SENTINEL alert active · ${daysToAdvisory} d before the official advisory`
      : `Official advisory issued · T+${daysFromAdvisory} d`;

  return (
    <div className="banner" data-tone={tone}>
      {icon}
      <span>{label}</span>
    </div>
  );
}
