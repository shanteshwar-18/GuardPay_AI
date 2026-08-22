/**
 * BeneficiaryCard — a payee row: initial avatar, name, UPI id and an optional
 * NEW / Trusted pill.
 *
 * "New beneficiary" is a risk signal in GuardPay, so the pill is never colour
 * alone: it always carries a glyph, and it carries the pre-translated word
 * whenever the caller supplies one (§48, §26).
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
import { useFontScale } from './useFontScale';

export interface BeneficiaryCardProps {
  name: string;
  upiId: string;
  /** First-time payee — the higher-risk case. */
  isNew?: boolean;
  /** Previously verified payee. */
  isTrusted?: boolean;
  /** Pre-translated word for the NEW pill. */
  newLabel?: string;
  /** Pre-translated word for the Trusted pill. */
  trustedLabel?: string;
  onPress?: () => void;
  /** Pre-translated hint describing what tapping does. */
  accessibilityHint?: string;
  /** Trailing element — chevron, amount, radio, etc. */
  rightSlot?: React.ReactNode;
  /** Render as the currently chosen payee. */
  selected?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** Deterministic avatar tint so the same payee always looks the same. */
const AVATAR_TINTS: { bg: string; fg: string }[] = [
  { bg: theme.brand.blueSoft, fg: theme.brand.navy },
  { bg: theme.risk.safe.soft, fg: theme.risk.safe.dark },
  { bg: theme.risk.warning.soft, fg: theme.risk.warning.dark },
  { bg: theme.neutral.surfaceAlt, fg: theme.neutral.textSecondary },
];

function tintFor(name: string) {
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return AVATAR_TINTS[sum % AVATAR_TINTS.length];
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

export function BeneficiaryCard({
  name,
  upiId,
  isNew = false,
  isTrusted = false,
  newLabel,
  trustedLabel,
  onPress,
  accessibilityHint,
  rightSlot,
  selected = false,
  fontScale,
  style,
  testID,
}: BeneficiaryCardProps) {
  const { sf } = useFontScale(fontScale);
  const tint = tintFor(name);
  const avatarSize = sf(44);

  // NEW wins over Trusted: if a payee is somehow both, show the risk signal.
  const pill = isNew
    ? {
        glyph: '✦',
        label: newLabel,
        bg: theme.risk.warning.soft,
        fg: theme.risk.warning.dark,
        border: theme.risk.warning.border,
      }
    : isTrusted
      ? {
          glyph: '✓',
          label: trustedLabel,
          bg: theme.risk.safe.soft,
          fg: theme.risk.safe.dark,
          border: theme.risk.safe.border,
        }
      : null;

  const a11yLabel = [name, upiId, pill?.label].filter(Boolean).join('. ');

  const content = (
    <>
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
            backgroundColor: tint.bg,
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.avatarText, { fontSize: sf(18), color: tint.fg }]}
        >
          {initialOf(name)}
        </Text>
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.name,
              {
                fontSize: sf(theme.typography.bodyBold.size),
                lineHeight: sf(theme.typography.bodyBold.lineHeight),
              },
            ]}
          >
            {name}
          </Text>
          {pill ? (
            <View
              style={[
                styles.pill,
                { backgroundColor: pill.bg, borderColor: pill.border },
              ]}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[
                  styles.pillText,
                  { fontSize: sf(theme.typography.tiny.size), color: pill.fg },
                ]}
              >
                {pill.label ? `${pill.glyph} ${pill.label}` : pill.glyph}
              </Text>
            </View>
          ) : null}
        </View>

        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.upi, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {upiId}
        </Text>
      </View>

      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </>
  );

  const shell: StyleProp<ViewStyle> = [
    styles.card,
    { minHeight: Math.max(theme.control.minTouch, sf(64)) },
    selected && styles.selected,
    style,
  ];

  if (!onPress) {
    return (
      <View
        testID={testID}
        accessible
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        style={shell}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ selected }}
      style={({ pressed }) => [shell, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.neutral.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    ...theme.elevation.sm,
  },
  pressed: {
    backgroundColor: theme.neutral.surfaceAlt,
  },
  selected: {
    borderColor: theme.brand.blue,
    borderWidth: 2,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.lg,
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '700',
  },
  body: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  name: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
  },
  pill: {
    marginLeft: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  upi: {
    marginTop: 2,
    color: theme.neutral.textSecondary,
  },
  rightSlot: {
    marginLeft: theme.spacing.md,
    flexShrink: 0,
  },
});

export default BeneficiaryCard;
