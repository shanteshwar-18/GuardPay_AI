/**
 * SecondaryButton — outlined / ghost counterpart to PrimaryButton.
 *
 * Shares PrimaryButton's sizing contract exactly (theme.control.buttonHeight as
 * the minimum height, grown in Senior Citizen Mode, never below
 * theme.control.minTouch) so a stacked pair of buttons lines up perfectly.
 *
 * Copy is never generated here: `label` arrives already translated (§26).
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

/** `outlined` draws a 1.5px border + white fill; `ghost` is transparent, no border. */
export type SecondaryButtonVariant = 'outlined' | 'ghost';

export interface SecondaryButtonProps {
  /** Already-translated label. */
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Tints the border + label; matches PrimaryButton's tone vocabulary. */
  tone?: ButtonTone;
  variant?: SecondaryButtonVariant;
  /** Describe the consequence for screen readers where the action is meaningful. */
  accessibilityHint?: string;
  accessibilityLabel?: string;
  /** Decorative leading glyph (no icon library is available in this project). */
  icon?: string;
  /** Shrink to content instead of filling the row. */
  compact?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  testID?: string;
}

export function SecondaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  tone = 'primary',
  variant = 'outlined',
  accessibilityHint,
  accessibilityLabel,
  icon,
  compact = false,
  fontScale,
  style,
  labelStyle,
  testID,
}: SecondaryButtonProps) {
  const { sf, scale } = useFontScale(fontScale);
  const palette = BUTTON_TONES[tone];
  const isBlocked = disabled || loading;
  const isGhost = variant === 'ghost';

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
          borderWidth: isGhost ? 0 : StyleSheet.hairlineWidth * 2 + 1,
          borderColor: palette.base,
          backgroundColor: pressed && !isBlocked
            ? theme.brand.blueSoft
            : isGhost
              ? 'transparent'
              : theme.neutral.surface,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator
            size="small"
            color={palette.base}
            style={styles.spinner}
          />
        ) : icon ? (
          <Text
            allowFontScaling={false}
            style={[styles.icon, { fontSize: sf(theme.typography.h3.size), color: palette.base }]}
          >
            {icon}
          </Text>
        ) : null}

        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.label,
            { fontSize: sf(theme.typography.h3.size), color: palette.base },
            labelStyle,
          ]}
        >
          {label}
        </Text>
      </View>
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
  spinner: {
    marginRight: theme.spacing.sm,
  },
  disabled: {
    opacity: 0.45,
  },
});

export default SecondaryButton;
