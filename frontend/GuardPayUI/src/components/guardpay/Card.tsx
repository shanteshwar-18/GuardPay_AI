/**
 * Card — the rounded surface every GuardPay screen is built from.
 *
 * Static by default; becomes a Pressable ONLY when `onPress` is supplied, so a
 * decorative card never advertises a button role to a screen reader (§48).
 */

import React, { useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  StyleProp,
  ViewStyle,
  AccessibilityRole,
} from 'react-native';
import { theme } from '../../theme';

export type CardTone = 'default' | 'tinted';

export interface CardProps {
  children: React.ReactNode;
  /** Apply the standard internal padding. Default true. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  /** 'tinted' uses the soft blue accent surface for highlighted cards. */
  tone?: CardTone;
  /** Supplying this renders a Pressable with a button role instead of a View. */
  onPress?: () => void;
  disabled?: boolean;
  /** Already-translated label; required in spirit whenever `onPress` is set. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Override the role for non-button pressables (e.g. 'radio', 'checkbox'). */
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
  /** Drop the shadow (useful for cards nested inside another card). */
  flat?: boolean;
  testID?: string;
}

export function Card({
  children,
  padded = true,
  style,
  tone = 'default',
  onPress,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  flat = false,
  testID,
}: CardProps) {
  const toneStyle = tone === 'tinted' ? styles.tinted : styles.default;

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress?.();
  }, [disabled, onPress]);

  const base: StyleProp<ViewStyle> = [
    styles.base,
    toneStyle,
    !flat && styles.raised,
    padded && styles.padded,
  ];

  if (!onPress) {
    return (
      <View style={[base, style]} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled}
      accessible
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={({ pressed }) => [
        base,
        { minHeight: theme.control.minTouch },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  default: {
    backgroundColor: theme.neutral.surface,
    borderColor: theme.neutral.border,
  },
  tinted: {
    backgroundColor: theme.brand.blueSoft,
    borderColor: theme.brand.blueMid,
  },
  raised: {
    ...theme.elevation.sm,
  },
  padded: {
    padding: theme.spacing.lg,
  },
  pressed: {
    opacity: 0.85,
    backgroundColor: theme.neutral.surfaceAlt,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Card;
