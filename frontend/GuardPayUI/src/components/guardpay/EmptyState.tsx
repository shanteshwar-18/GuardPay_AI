/**
 * EmptyState — the "nothing here yet" panel for lists, history and contacts.
 *
 * Glyph + title + message + one optional CTA. Every string arrives already
 * translated; the glyph is decorative and hidden from screen readers so the
 * title carries the meaning.
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { useFontScale } from './useFontScale';
import { PrimaryButton } from './PrimaryButton';
import { SecondaryButton } from './SecondaryButton';

export interface EmptyStateProps {
  /** Decorative glyph shown in the circle, e.g. '🗂', '🛡', '☏'. */
  icon?: string;
  /** Already-translated headline. */
  title: string;
  /** Already-translated supporting paragraph. */
  message?: string;
  /** Already-translated CTA label; the CTA renders only when both it and the handler exist. */
  ctaLabel?: string;
  onCtaPress?: () => void;
  ctaAccessibilityHint?: string;
  /** Render the CTA as the outlined SecondaryButton instead of the solid one. */
  ctaVariant?: 'primary' | 'secondary';
  /** Tighter vertical rhythm, for empty states inside a card rather than a page. */
  compact?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function EmptyState({
  icon = '·',
  title,
  message,
  ctaLabel,
  onCtaPress,
  ctaAccessibilityHint,
  ctaVariant = 'primary',
  compact = false,
  fontScale,
  style,
  testID,
}: EmptyStateProps) {
  const { sf } = useFontScale(fontScale);
  const showCta = Boolean(ctaLabel && onCtaPress);

  return (
    <View
      testID={testID}
      style={[styles.container, compact && styles.compact, style]}
    >
      <View
        style={styles.iconCircle}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text allowFontScaling={false} style={[styles.icon, { fontSize: sf(theme.control.iconLg) }]}>
          {icon}
        </Text>
      </View>

      <Text
        allowFontScaling={false}
        accessibilityRole="header"
        style={[
          styles.title,
          {
            fontSize: sf(theme.typography.h3.size),
            lineHeight: sf(theme.typography.h3.lineHeight),
          },
        ]}
      >
        {title}
      </Text>

      {message ? (
        <Text
          allowFontScaling={false}
          style={[
            styles.message,
            {
              fontSize: sf(theme.typography.body.size),
              lineHeight: sf(theme.typography.body.lineHeight),
            },
          ]}
        >
          {message}
        </Text>
      ) : null}

      {showCta ? (
        <View style={styles.ctaWrap}>
          {ctaVariant === 'secondary' ? (
            <SecondaryButton
              label={ctaLabel as string}
              onPress={onCtaPress as () => void}
              accessibilityHint={ctaAccessibilityHint}
              fontScale={fontScale}
              compact
            />
          ) : (
            <PrimaryButton
              label={ctaLabel as string}
              onPress={onCtaPress as () => void}
              accessibilityHint={ctaAccessibilityHint}
              fontScale={fontScale}
              compact
            />
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.huge,
    paddingHorizontal: theme.spacing.xl,
  },
  compact: {
    paddingVertical: theme.spacing.xxl,
  },
  iconCircle: {
    width: theme.control.iconLg + theme.spacing.xxl,
    height: theme.control.iconLg + theme.spacing.xxl,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.neutral.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  icon: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  message: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  ctaWrap: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
});

export default EmptyState;
