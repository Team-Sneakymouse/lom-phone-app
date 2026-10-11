import type { ListedJob } from '@/src/jobs/types';
import { formatJobFooter } from '@/src/jobs/fetchOpenJobs';
import { colors, fonts } from '@/src/theme';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  job: ListedJob;
};

const HEAD = 72;
const HEAD_GAP = 12;

/**
 * Discord-style job embed: category title, body wrapping a top-right face
 * thumbnail, author line, then location • timestamp footer.
 */
export function JobCard({ job }: Props) {
  const categoryIcon = job.discordEmbedIcon?.trim();
  const headIcon = job.posterIconBase64?.trim();
  const bodyPad = headIcon ? { paddingRight: HEAD + HEAD_GAP } : null;
  const footer = formatJobFooter(job);

  return (
    <View style={styles.card}>
      {headIcon ? (
        <Image
          source={{ uri: headIcon }}
          style={styles.head}
          accessibilityIgnoresInvertColors
          accessibilityLabel="Poster face"
        />
      ) : null}

      <View style={[styles.titleRow, bodyPad]}>
        {categoryIcon ? (
          <Image
            source={{ uri: categoryIcon }}
            style={styles.categoryIcon}
            accessibilityIgnoresInvertColors
          />
        ) : null}
        <Text style={styles.category}>{job.category}</Text>
      </View>

      {job.name ? (
        <Text style={[styles.name, bodyPad]}>{job.name}</Text>
      ) : null}

      {job.posterDisplayString ? (
        <Text style={[styles.poster, bodyPad]}>{job.posterDisplayString}</Text>
      ) : null}

      {job.description ? (
        <Text style={[styles.description, bodyPad]}>{job.description}</Text>
      ) : null}

      {footer ? (
        <View style={styles.footer}>
          {categoryIcon ? (
            <Image
              source={{ uri: categoryIcon }}
              style={styles.footerIcon}
              accessibilityIgnoresInvertColors
            />
          ) : null}
          <Text style={styles.footerText}>{footer}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'relative',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.panelBorder,
    borderLeftWidth: 4,
    borderLeftColor: colors.brass,
    borderRadius: 4,
    padding: 14,
    paddingBottom: 12,
    gap: 6,
    overflow: 'hidden',
  },
  head: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: HEAD,
    height: HEAD,
    borderRadius: 4,
    backgroundColor: 'rgba(31, 61, 52, 0.12)',
    zIndex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 22,
  },
  categoryIcon: {
    width: 22,
    height: 22,
    borderRadius: 3,
  },
  category: {
    fontFamily: fonts.display,
    fontSize: 16,
    lineHeight: 22,
    color: colors.brassDeep,
    flexShrink: 1,
  },
  name: {
    fontFamily: fonts.bodySemi,
    fontSize: 16,
    lineHeight: 22,
    color: colors.ink,
  },
  poster: {
    fontFamily: fonts.bodySemi,
    fontSize: 13,
    lineHeight: 18,
    color: colors.moss,
  },
  description: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.moss,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.panelBorder,
  },
  footerIcon: {
    width: 16,
    height: 16,
    borderRadius: 2,
  },
  footerText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.moss,
    opacity: 0.8,
    flexShrink: 1,
  },
});
