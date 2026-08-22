/**
 * TransactionCard — one row of payment history.
 *
 * Beneficiary + UPI id, a signed amount, the timestamp, and the risk decision
 * badge. Amounts and timestamps arrive PRE-FORMATTED (locale formatting belongs
 * to services/format + i18n, not to a leaf component), and the status word
 * arrives pre-translated (§26).
 *
 * §48: direction is carried by the +/− sign as well as the colour, and the
 * decision is carried by the badge's word and glyph.
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
import { RiskTierId } from '../../config/riskTiers';
import { RiskTierBadge } from './RiskTierBadge';
import { useFontScale } from './useFontScale';

export interface TransactionCardProps {
  name: string;
  upiId?: string;
  /** Pre-formatted, localised amount, e.g. "₹5,000" — or a raw number. */
  amount: string | number;
  /** Money in rather than out. */
  isCredit?: boolean;
  /** Pre-formatted, localised timestamp, e.g. "Today, 4:12 PM". */
  timestamp: string;
  /** Tier the backend decided for this payment. */
  tier?: RiskTierId;
  /** Fallback when only a score is stored. */
  score?: number;
  /** Pre-translated decision word rendered inside the badge, e.g. "Blocked". */
  statusLabel: string;
  onPress?: () => void;
  /** Pre-translated hint describing what tapping does. */
  accessibilityHint?: string;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

export function TransactionCard({
  name,
  upiId,
  amount,
  isCredit = false,
  timestamp,
  tier,
  score,
  statusLabel,
  onPress,
  accessibilityHint,
  fontScale,
  style,
  testID,
}: TransactionCardProps) {
  const { sf } = useFontScale(fontScale);
  const avatarSize = sf(40);

  // Minus sign U+2212, not a hyphen — it aligns with digits.
  const sign = isCredit ? '+' : '−';
  const amountText = `${sign}${String(amount)}`;
  const amountColor = isCredit ? theme.risk.safe.dark : theme.neutral.textPrimary;

  const hasBadge = tier !== undefined || typeof score === 'number';
  const a11yLabel = [name, upiId, amountText, timestamp, statusLabel]
    .filter(Boolean)
    .join('. ');

  const content = (
    <>
      <View
        style={[
          styles.avatar,
          {
            width: avatarSize,
            height: avatarSize,
            borderRadius: avatarSize / 2,
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.avatarText, { fontSize: sf(16) }]}
        >
          {initialOf(name)}
        </Text>
      </View>

      <View style={styles.body}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.name,
            { fontSize: sf(theme.typography.bodyBold.size) },
          ]}
        >
          {name}
        </Text>
        {upiId ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.upi, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {upiId}
          </Text>
        ) : null}
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.timestamp, { fontSize: sf(theme.typography.tiny.size) }]}
        >
          {timestamp}
        </Text>
      </View>

      <View style={styles.trailing}>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[
            styles.amount,
            { fontSize: sf(theme.typography.bodyBold.size), color: amountColor },
          ]}
        >
          {amountText}
        </Text>
        {hasBadge ? (
          <RiskTierBadge
            tier={tier}
            score={score}
            label={statusLabel}
            size="sm"
            fontScale={fontScale}
            style={styles.badge}
          />
        ) : (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.status, { fontSize: sf(theme.typography.tiny.size) }]}
          >
            {statusLabel}
          </Text>
        )}
      </View>
    </>
  );

  const shell: StyleProp<ViewStyle> = [
    styles.card,
    { minHeight: Math.max(theme.control.minTouch, sf(68)) },
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
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brand.blueSoft,
    marginRight: theme.spacing.md,
    flexShrink: 0,
  },
  avatarText: {
    fontWeight: '700',
    color: theme.brand.navy,
  },
  body: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  name: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
  upi: {
    marginTop: 1,
    color: theme.neutral.textSecondary,
  },
  timestamp: {
    marginTop: 2,
    color: theme.neutral.textMuted,
  },
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '40%',
  },
  amount: {
    fontWeight: '700',
    textAlign: 'right',
  },
  badge: {
    marginTop: theme.spacing.xs,
    alignSelf: 'flex-end',
  },
  status: {
    marginTop: theme.spacing.xs,
    color: theme.neutral.textSecondary,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default TransactionCard;
