import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getAndroidBootCount,
  getAndroidBootStepCount,
  isAndroidStepCounterAvailable,
} from 'android-step-counter';

function localDayStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

const LEDGER_KEY = 'lom.steps.androidSensorLedger.v1';
const MAX_SAMPLES = 48;

type Sample = { at: number; accrued: number };

type Ledger = {
  bootCount: number;
  lastCounter: number;
  accrued: number;
  dayKey: string;
  accruedAtDayStart: number;
  samples: Sample[];
};

function dayKey(d = new Date()): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

async function loadLedger(): Promise<Ledger | null> {
  const raw = await AsyncStorage.getItem(LEDGER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Ledger>;
    return {
      bootCount: Math.max(0, Math.floor(Number(parsed.bootCount) || 0)),
      lastCounter: Math.max(0, Math.floor(Number(parsed.lastCounter) || 0)),
      accrued: Math.max(0, Math.floor(Number(parsed.accrued) || 0)),
      dayKey: typeof parsed.dayKey === 'string' ? parsed.dayKey : dayKey(),
      accruedAtDayStart: Math.max(
        0,
        Math.floor(Number(parsed.accruedAtDayStart) || 0),
      ),
      samples: Array.isArray(parsed.samples)
        ? parsed.samples
            .map((s) => ({
              at: Number((s as Sample).at) || 0,
              accrued: Math.max(0, Math.floor(Number((s as Sample).accrued) || 0)),
            }))
            .filter((s) => s.at > 0)
        : [],
    };
  } catch {
    return null;
  }
}

async function saveLedger(ledger: Ledger): Promise<void> {
  await AsyncStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
}

function pushSample(ledger: Ledger, at: number): void {
  const last = ledger.samples[ledger.samples.length - 1];
  if (last && at - last.at < 30_000 && last.accrued === ledger.accrued) {
    last.at = at;
    return;
  }
  ledger.samples.push({ at, accrued: ledger.accrued });
  if (ledger.samples.length > MAX_SAMPLES) {
    ledger.samples = ledger.samples.slice(-MAX_SAMPLES);
  }
}

function accruedAtOrBefore(ledger: Ledger, at: number): number {
  let best: Sample | null = null;
  for (const s of ledger.samples) {
    if (s.at <= at && (!best || s.at > best.at)) best = s;
  }
  if (best) return best.accrued;
  // No sample before `at` — use earliest sample at/after, else current accrued.
  const after = ledger.samples.find((s) => s.at >= at);
  return after ? after.accrued : ledger.accrued;
}

/** Refresh hardware counter into the ledger; returns updated ledger. */
export async function refreshAndroidSensorLedger(): Promise<Ledger> {
  const available = await isAndroidStepCounterAvailable();
  if (!available) throw new Error('Phone step counter is not available');

  const bootCount = await getAndroidBootCount();
  const counter = await getAndroidBootStepCount();
  const now = Date.now();
  const today = dayKey(new Date(now));
  const prev = await loadLedger();

  let ledger: Ledger;
  if (!prev || prev.bootCount !== bootCount) {
    // Reboot (or first run): start a fresh counter baseline; keep accrued total.
    const accrued = prev?.accrued ?? 0;
    ledger = {
      bootCount,
      lastCounter: counter,
      accrued,
      dayKey: today,
      accruedAtDayStart: accrued,
      samples: prev?.samples ?? [],
    };
  } else {
    const delta = Math.max(0, counter - prev.lastCounter);
    const accrued = prev.accrued + delta;
    const rolledDay = prev.dayKey !== today;
    ledger = {
      bootCount,
      lastCounter: counter,
      accrued,
      dayKey: today,
      accruedAtDayStart: rolledDay ? accrued : prev.accruedAtDayStart,
      samples: prev.samples,
    };
  }

  pushSample(ledger, now);
  await saveLedger(ledger);
  return ledger;
}

export async function sensorStepsInRange(start: Date, end: Date): Promise<number> {
  if (start.getTime() >= end.getTime()) return 0;
  const ledger = await refreshAndroidSensorLedger();
  const dayStart = localDayStart(end).getTime();
  // “Steps today” queries use local midnight as start.
  if (Math.abs(start.getTime() - dayStart) < 120_000) {
    return Math.max(0, ledger.accrued - ledger.accruedAtDayStart);
  }
  const base = accruedAtOrBefore(ledger, start.getTime());
  return Math.max(0, ledger.accrued - base);
}
