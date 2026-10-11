import { submitStepSnapshot, type StepsState } from '@/src/steps/api';
import { getHealthStepsProvider } from '@/src/steps/health';
import {
  loadEpochStepState,
  saveEpochStepState,
} from '@/src/steps/localHighWater';

function parseLinkedAt(linkedAt: string): Date {
  const d = new Date(linkedAt);
  if (Number.isNaN(d.getTime())) return new Date();
  return d;
}

/** Local midnight for “steps today” display. */
export function localDayStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

export async function readStepsToday(): Promise<number> {
  const provider = getHealthStepsProvider();
  const now = new Date();
  return provider.getStepsInRange(localDayStart(now), now);
}

/**
 * Query health for steps since the last anchor, advance local high-water,
 * and POST the cumulative reported value (server baselines per link epoch).
 */
export async function syncStepsFromHealth(linkedAt: string): Promise<StepsState> {
  const provider = getHealthStepsProvider();
  const status = await provider.getStatus();
  if (status !== 'ready') {
    throw new Error(
      status === 'unsupported'
        ? 'Steps sync needs the iOS or Android app'
        : status === 'unavailable'
          ? 'Health data is not available on this device'
          : 'Connect health permissions before syncing',
    );
  }

  const now = new Date();
  const state = await loadEpochStepState();
  const linked = parseLinkedAt(linkedAt);
  const anchor = state.queryAnchorIso
    ? new Date(state.queryAnchorIso)
    : linked;
  const from = Number.isNaN(anchor.getTime()) ? linked : anchor;
  const rangeStart = from.getTime() > now.getTime() ? now : from;

  const delta = await provider.getStepsInRange(rangeStart, now);
  const reported = state.highWater + Math.max(0, delta);
  const next = await submitStepSnapshot(reported);

  await saveEpochStepState({
    highWater: reported,
    queryAnchorIso: now.toISOString(),
  });

  return next;
}
