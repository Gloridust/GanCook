export const IMPORT_PROGRESS_PHASES = [
  'cleaning',
  'fetching',
  'extracting',
  'image',
] as const

export type ImportProgressPhase = (typeof IMPORT_PROGRESS_PHASES)[number]

export function importProgressPhaseAt(
  elapsedMs: number,
): ImportProgressPhase {
  if (elapsedMs < 1_500) return 'cleaning'
  if (elapsedMs < 8_000) return 'fetching'
  if (elapsedMs < 72_000) return 'extracting'
  return 'image'
}
