import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { CookingPot, Utensils } from 'lucide-react-native';
import { palette, radius, typography } from '../theme';
import { normaliseImageUrl } from '../utils/format';

/**
 * Image with a designed fallback.
 *
 * Food photography is what makes this app feel premium, but the API does not
 * guarantee an image on every record and the CDN can fail. Rather than
 * rendering a grey broken-image box, this renders a warm branded panel with a
 * Lucide icon - clearly a designed placeholder, never a different dish's photo.
 *
 * @param uri            Candidate image URL; validated before use.
 * @param aspectRatio    width / height. Omit alongside an explicit height.
 * @param height         Fixed height; alternative to aspectRatio.
 * @param width          Fixed width; defaults to stretch to the parent.
 * @param icon           'pot' | 'utensils' - matches the content type.
 * @param message        Short fallback caption, e.g. "No photo yet".
 */
export default function MediaImage({
  uri,
  aspectRatio,
  height,
  width,
  icon = 'pot',
  message,
  label,
  radius: borderRadius = radius.md,
  style,
}) {
  const [failed, setFailed] = useState(false);
  const source = normaliseImageUrl(uri);

  const boxStyle = [
    styles.box,
    { borderRadius },
    width != null ? { width } : null,
    height != null ? { height } : null,
    aspectRatio != null ? { aspectRatio } : null,
    style,
  ];

  // No URL, a rejected URL, or a failed request: show the designed fallback.
  if (!source || failed) {
    const Glyph = icon === 'utensils' ? Utensils : CookingPot;

    return (
      <View style={[boxStyle, styles.fallbackBox]}>
        <Glyph size={26} color={palette.fallbackInk} strokeWidth={1.75} />
        {message ? (
          <View style={styles.fallbackTextWrap}>
            {/* Rendered as plain text: API strings are never treated as markup. */}
            <Text variant="labelSmall" style={styles.fallbackMessage} numberOfLines={2}>
              {message}
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <View style={boxStyle}>
      <Image
        source={{ uri: source }}
        style={styles.image}
        resizeMode="cover"
        onError={() => setFailed(true)}
        accessible={Boolean(label)}
        accessibilityRole="image"
        accessibilityLabel={label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: palette.fallbackBg,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  fallbackBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  fallbackTextWrap: {
    alignItems: 'center',
  },
  fallbackMessage: {
    color: palette.textSecondary,
    fontSize: typography.meta,
    textAlign: 'center',
  },
});