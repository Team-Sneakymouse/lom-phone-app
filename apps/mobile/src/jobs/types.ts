/** Open listing from PocketBase `lom2_listed_jobs` (SneakyJobBoard). */
export type ListedJob = {
  id: string;
  name: string;
  category: string;
  description: string;
  posterDisplayString: string;
  /** data:image/png;base64,… player face from SneakyJobBoard */
  posterIconBase64: string;
  locationDisplayString: string;
  discordEmbedIcon: string;
  startTime: number;
  durationMillis: number;
  tracking: boolean;
};
