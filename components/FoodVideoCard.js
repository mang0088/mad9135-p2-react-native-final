import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Play } from 'lucide-react-native';
import MediaImage from './MediaImage';
import { layout, palette, radius, spacing, typography } from '../theme';
import { cleanText, formatDuration, formatViews, youtubeWatchUrl } from '../utils/format';

/**
 * A food video card.
 *
 * The YouTube id is only ever used to build a watch URL - it is never shown as
 * a title. Tapping opens the original video through the system handler.
 */
function FoodVideoCard({ video, onPress }) {
  const title = cleanText(video.shortTitle) || cleanText(video.title);

  const duration = formatDuration(video.length);
  const views = formatViews(video.views);
  const hasPlayableId = youtubeWatchUrl(video.youTubeId) !== null;

  const rating =
    typeof video.rating === 'number' && Number.isFinite(video.rating)
      ? video.rating.toFixed(1)
      : null;

  return (
    <Pressable
      onPress={hasPlayableId ? onPress : undefined}
      disabled={!hasPlayableId}
      style={({ pressed }) => [styles.card, pressed && hasPlayableId && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={
        title
          ? `Play video: ${title}${duration ? `, ${duration}` : ''}`
          : 'Play video'
      }
    >
      <View>
        <MediaImage
          uri={video.thumbnail}
          aspectRatio={layout.mediaRatio}
          icon="pot"
          message="No thumbnail"
          label={title ? `Thumbnail for ${title}` : undefined}
          radius={0}
        />

        {hasPlayableId ? (
          <View style={styles.playOverlay} pointerEvents="none">
            <View style={styles.playButton}>
              <Play size={16} color="#FFFFFF" fill="#FFFFFF" strokeWidth={0} />
            </View>
          </View>
        ) : null}

        {duration ? (
          <View style={styles.durationBadge}>
            <Text variant="labelSmall" style={styles.durationText}>
              {duration}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.text}>
        <Text variant="titleSmall" style={styles.title} numberOfLines={2}>
          {title || 'Untitled video'}
        </Text>
        {views || rating ? (
          <Text variant="labelSmall" style={styles.meta} numberOfLines={1}>
            {[views, rating ? `${rating} rating` : null].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default React.memo(FoodVideoCard);

const styles = StyleSheet.create({
  card: {
    width: layout.videoCardWidth,
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },
  pressed: {
    opacity: 0.78,
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.overlay,
    paddingLeft: 2,
  },
  durationBadge: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    backgroundColor: 'rgba(23, 32, 25, 0.78)',
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: typography.meta,
    fontWeight: '700',
  },
  text: {
    padding: spacing.md,
    gap: 2,
  },
  title: {
    color: palette.text,
    fontSize: typography.body,
    fontWeight: '600',
    lineHeight: 19,
  },
  meta: {
    color: palette.textSecondary,
    fontSize: typography.meta,
  },
});