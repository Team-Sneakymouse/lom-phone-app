const DEFAULT_PB = 'https://db.danidipp.com';

export function pocketBaseUrl(): string {
  const raw = process.env.EXPO_PUBLIC_POCKETBASE_URL?.trim();
  return (raw && raw.length > 0 ? raw : DEFAULT_PB).replace(/\/$/, '');
}
