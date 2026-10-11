import { JobCard } from '@/components/JobCard';
import { Panel, ScreenShell } from '@/components/ScreenShell';
import { fetchOpenJobs } from '@/src/jobs/fetchOpenJobs';
import type { ListedJob } from '@/src/jobs/types';
import { colors, type } from '@/src/theme';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';

export default function JobBoardScreen() {
  const [jobs, setJobs] = useState<ListedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    setError(null);
    try {
      const next = await fetchOpenJobs();
      setJobs(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load jobs');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      const controller = new AbortController();
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const next = await fetchOpenJobs(controller.signal);
          if (!controller.signal.aborted) setJobs(next);
        } catch (e) {
          if (controller.signal.aborted) return;
          setError(e instanceof Error ? e.message : 'Could not load jobs');
        } finally {
          if (!controller.signal.aborted) setLoading(false);
        }
      })();
      return () => controller.abort();
    }, []),
  );

  return (
    <ScreenShell
      title="Job Board"
      subtitle="Open listings from the Lords of Minecraft boards."
      showBack
      scroll
      contentStyle={{ paddingBottom: 40 }}
    >
      {loading ? (
        <View style={{ paddingVertical: 40, alignItems: 'center' }}>
          <ActivityIndicator color={colors.brass} />
        </View>
      ) : null}

      {!loading && error ? (
        <Panel>
          <Text style={type.bodyOnPanel}>{error}</Text>
          <Pressable onPress={() => void load('initial')} style={{ marginTop: 12 }}>
            <Text style={{ color: colors.brassDeep, fontWeight: '600' }}>Try again</Text>
          </Pressable>
        </Panel>
      ) : null}

      {!loading && !error && jobs.length === 0 ? (
        <Panel>
          <Text style={type.bodyOnPanel}>
            No jobs are listed right now. Check back when someone posts on the in-game board.
          </Text>
        </Panel>
      ) : null}

      {!loading && !error
        ? jobs.map((job, index) => (
            <Animated.View
              key={job.id}
              entering={FadeInDown.delay(40 + index * 50).duration(400)}
            >
              <JobCard job={job} />
            </Animated.View>
          ))
        : null}

      {!loading && !error ? (
        <Pressable
          onPress={() => void load('refresh')}
          disabled={refreshing}
          style={{ alignSelf: 'center', paddingVertical: 16, opacity: refreshing ? 0.5 : 1 }}
        >
          <Text style={{ color: colors.brass, letterSpacing: 1 }}>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Text>
        </Pressable>
      ) : null}
    </ScreenShell>
  );
}
