/**
 * PrimaryButton — full-width solid action button.
 *
 * Sizing contract shared with SecondaryButton: theme.control.buttonHeight as the
 * minimum height (grows in Senior Citizen Mode so 1.5× labels never clip), never
 * below theme.control.minTouch (§48).
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { theme } from '../../theme';
import { BUTTON_TONES, ButtonTone } from './types';
import { useFontScale } from './useFontScale';

export interface PrimaryButtonProps {
  /** Already-translated label. */
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: ButtonTone;
  /** Describe the consequence for screen readers, e.g. "Sends ₹5,000 to Ramesh". */
  accessibilityHint?: string;
  accessibilityLabel?: string;
  /** Decorative leading glyph. */
  icon?: string;
  /** Shrink to content instead of filling the row. */
  compact?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = 'primary',
  accessibilityHint,
  accessibilityLabel,
  icon,
  compact = false,
  fontScale,
  style,
  labelStyle,
  testID,
}: PrimaryButtonProps) {
  const { sf, scale } = useFontScale(fontScale);
  const palette = BUTTON_TONES[tone];
  const isBlocked = disabled || loading;

  const handlePress = useCallback(() => {
    if (isBlocked) return;
    onPress();
  }, [isBlocked, onPress]);

  const minHeight = Math.max(
    theme.control.minTouch,
    Math.round(theme.control.buttonHeight * (scale > 1 ? 1.2 : 1)),
  );

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={isBlocked}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        compact ? styles.compact : styles.full,
        {
          minHeight,
          backgroundColor: pressed && !isBlocked ? palette.pressed : palette.base,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator size="small" color={palette.onColor} />
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[
              styles.label,
              { fontSize: sf(theme.typography.bodyBold.size), color: palette.onColor, marginLeft: theme.spacing.sm },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      ) : (
        <View style={styles.row}>
          {icon ? (
            <Text
              allowFontScaling={false}
              style={[styles.icon, { fontSize: sf(theme.typography.h3.size), color: palette.onColor }]}
            >
              {icon}
            </Text>
          ) : null}
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[
              styles.label,
              { fontSize: sf(theme.typography.h3.size), color: palette.onColor },
              labelStyle,
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    ...theme.elevation.sm,
  },
  full: {
    alignSelf: 'stretch',
    width: '100%',
  },
  compact: {
    alignSelf: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  icon: {
    marginRight: theme.spacing.sm,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.45,
  },
});

export default PrimaryButton;
