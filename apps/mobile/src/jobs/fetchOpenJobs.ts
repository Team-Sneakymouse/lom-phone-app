import type { ListedJob } from './types';

const DEFAULT_PB = 'https://db.danidipp.com';
const COLLECTION = 'lom2_listed_jobs';

const FIELDS = [
  'id',
  'name',
  'category',
  'description',
  'posterDisplayString',
  'posterIconBase64',
  'locationDisplayString',
  'discordEmbedIcon',
  'startTime',
  'durationMillis',
  'tracking',
].join(',');

type PbListResponse = {
  items?: Array<Partial<ListedJob> & { id?: string }>;
};

function pocketBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_POCKETBASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_PB).replace(/\/$/, '');
}

function asJob(raw: Partial<ListedJob> & { id?: string }): ListedJob | null {
  if (!raw.id || !raw.name || !raw.category) return null;
  return {
    id: raw.id,
    name: String(raw.name),
    category: String(raw.category),
    description: String(raw.description ?? ''),
    posterDisplayString: String(raw.posterDisplayString ?? ''),
    posterIconBase64: String(raw.posterIconBase64 ?? ''),
    locationDisplayString: String(raw.locationDisplayString ?? ''),
    discordEmbedIcon: String(raw.discordEmbedIcon ?? ''),
    startTime: Number(raw.startTime) || 0,
    durationMillis: Number(raw.durationMillis) || 0,
    tracking: Boolean(raw.tracking),
  };
}

/** Currently listed jobs (`endTime = 0`), newest first. */
export async function fetchOpenJobs(signal?: AbortSignal): Promise<ListedJob[]> {
  const params = new URLSearchParams({
    page: '1',
    perPage: '50',
    sort: '-created',
    filter: 'endTime=0',
    fields: FIELDS,
  });
  const url = `${pocketBaseUrl()}/api/collections/${COLLECTION}/records?${params}`;
  const res = await fetch(url, { signal });
  if (!res.ok) {
    throw new Error(`Job board unavailable (${res.status})`);
  }
  const data = (await res.json()) as PbListResponse;
  return (data.items ?? []).map(asJob).filter((j): j is ListedJob => j != null);
}

export function jobEndsAt(job: ListedJob): number {
  return job.startTime + job.durationMillis;
}

/** Discord-style relative day + local time, e.g. "Today at 13:52". */
export function formatDiscordTimestamp(ms: number, now = Date.now()): string {
  if (!ms) return '';
  const date = new Date(ms);
  const time = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfThatDay = new Date(date);
  startOfThatDay.setHours(0, 0, 0, 0);
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfThatDay.getTime()) / 86_400_000,
  );
  if (dayDiff === 0) return `Today at ${time}`;
  if (dayDiff === 1) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString(undefined, {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
  })} ${time}`;
}

export function formatJobFooter(job: ListedJob, now = Date.now()): string {
  const when = formatDiscordTimestamp(job.startTime, now);
  const where = job.locationDisplayString?.trim();
  if (where && when) return `${where} • ${when}`;
  return where || when;
}
