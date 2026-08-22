/**
 * SecurityAlert — inline banner for protection state, warnings and failures.
 *
 * Tone is carried by colour AND a glyph AND the caller's title copy, never by
 * colour alone (§48). Screen readers get the whole banner as one live region so
 * a warning that appears mid-flow is announced rather than silently painted.
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';
import { ALERT_TONES, AlertTone } from './types';
import { useFontScale } from './useFontScale';

export type SecurityAlertTone = AlertTone;

export interface SecurityAlertProps {
  tone: SecurityAlertTone;
  /** Already-translated headline. */
  title: string;
  /** Already-translated supporting line. */
  message?: string;
  /** Override the default decorative glyph for this tone. */
  icon?: string;
  /** Optional inline action, e.g. "Review". Label must be already translated. */
  actionLabel?: string;
  onActionPress?: () => void;
  actionAccessibilityHint?: string;
  /** Already-translated accessible name for the dismiss control. */
  dismissAccessibilityLabel?: string;
  onDismiss?: () => void;
  /** Compact single-line-ish variant for headers and list rows. */
  compact?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function SecurityAlert({
  tone,
  title,
  message,
  icon,
  actionLabel,
  onActionPress,
  actionAccessibilityHint,
  dismissAccessibilityLabel,
  onDismiss,
  compact = false,
  fontScale,
  style,
  testID,
}: SecurityAlertProps) {
  const { sf } = useFontScale(fontScale);
  const palette = ALERT_TONES[tone];
  const glyph = icon ?? palette.glyph;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="alert"
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      accessibilityLabel={message ? `${title}. ${message}` : title}
      style={[
        styles.container,
        compact && styles.compact,
        { backgroundColor: palette.soft, borderColor: palette.border },
        style,
      ]}
    >
      <View
        style={[styles.glyphWrap, { backgroundColor: palette.main }]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Text
          allowFontScaling={false}
          style={[styles.glyph, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {glyph}
        </Text>
      </View>

      <View style={styles.body}>
        <Text
          allowFontScaling={false}
          style={[
            styles.title,
            {
              color: theme.neutral.textPrimary,
              fontSize: sf(theme.typography.bodyBold.size),
              lineHeight: sf(theme.typography.bodyBold.lineHeight),
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
                color: theme.neutral.textSecondary,
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {message}
          </Text>
        ) : null}

        {actionLabel && onActionPress ? (
          <Pressable
            onPress={onActionPress}
            accessible
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            accessibilityHint={actionAccessibilityHint}
            hitSlop={theme.spacing.md}
            style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
          >
            <Text
              allowFontScaling={false}
              style={[
                styles.actionLabel,
                { color: palette.main, fontSize: sf(theme.typography.caption.size) },
              ]}
            >
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {onDismiss ? (
        <Pressable
          onPress={onDismiss}
          accessible
          accessibilityRole="button"
          accessibilityLabel={dismissAccessibilityLabel ?? title}
          hitSlop={theme.spacing.sm}
          style={({ pressed }) => [styles.dismiss, pressed && styles.actionPressed]}
        >
          <Text
            allowFontScaling={false}
            style={[
              styles.dismissGlyph,
              { color: theme.neutral.textSecondary, fontSize: sf(theme.typography.body.size) },
            ]}
          >
            {'✕'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.lg,
  },
  compact: {
    padding: theme.spacing.md,
  },
  glyphWrap: {
    width: theme.control.iconMd,
    height: theme.control.iconMd,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  glyph: {
    color: theme.neutral.textInverse,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    flex: 1,
  },
  title: {
    fontWeight: '700',
  },
  message: {
    marginTop: theme.spacing.xs,
  },
  action: {
    marginTop: theme.spacing.sm,
    minHeight: theme.control.minTouch,
    justifyContent: 'center',
  },
  actionPressed: {
    opacity: 0.6,
  },
  actionLabel: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  dismiss: {
    width: theme.control.minTouch,
    height: theme.control.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.sm,
  },
  dismissGlyph: {
    fontWeight: '700',
  },
});

export default SecurityAlert;
