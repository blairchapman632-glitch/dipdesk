// Dip stage values stored in the database, in order. Do not rename these values —
// only the display labels below are user-facing.
export const DIP_STAGES = ['interest', 'queue', 'live', 'payments', 'closed', 'drawn'] as const

// Full friendly labels (stage card, buttons, Dashboard)
export const DIP_STAGE_LABELS: Record<string, string> = {
  interest: 'Interest',
  queue: 'Queue',
  live: 'Live',
  payments: 'Full – collecting payments',
  closed: 'Ready to draw',
  drawn: 'Drawn',
}

// Short labels for the compact stage bar on phones
export const DIP_STAGE_SHORT_LABELS: Record<string, string> = {
  interest: 'Interest',
  queue: 'Queue',
  live: 'Live',
  payments: 'Payments',
  closed: 'Ready',
  drawn: 'Drawn',
}

export function getDipStageLabel(stage: string | null | undefined): string {
  if (!stage) return 'Draft'
  return DIP_STAGE_LABELS[stage] || stage.charAt(0).toUpperCase() + stage.slice(1)
}

// True once the dip has reached Live (live, payments, closed, drawn)
export function isDipLiveOrLater(stage: string | null | undefined): boolean {
  if (!stage) return false
  return DIP_STAGES.indexOf(stage as (typeof DIP_STAGES)[number]) >= DIP_STAGES.indexOf('live')
}
