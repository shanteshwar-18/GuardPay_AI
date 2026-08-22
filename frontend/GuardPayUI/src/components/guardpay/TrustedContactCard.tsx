/**
 * TrustedContactCard — a guardian the user has nominated (§ trusted-contact flow).
 *
 * Initial avatar, name, relationship, masked phone number and an action slot
 * (Call / Notify / Remove). The phone number arrives ALREADY MASKED — this
 * component never receives or renders a full number.
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

export interface TrustedContactCardProps {
  name: string;
  /** Pre-translated relationship, e.g. "Son" / "Neighbour". */
  relationship?: string;
  /** Already masked by the caller, e.g. "+91 98••• ••210". */
  phoneMasked: string;
  /** Pre-translated action label, e.g. "Call". */
  actionLabel?: string;
  onPressAction?: () => void;
  /** Pre-translated hint describing the consequence of the action. */
  actionHint?: string;
  /** Destructive styling for the action (e.g. Remove). */
  actionDestructive?: boolean;
  /** Marks the contact GuardPay calls first. */
  isPrimary?: boolean;
  /** Pre-translated word for the primary pill. */
  primaryLabel?: string;
  /** Replace the built-in action button entirely. */
  rightSlot?: React.ReactNode;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed.charAt(0).toUpperCase() : '?';
}

export function TrustedContactCard({
  name,
  relationship,
  phoneMasked,
  actionLabel,
  onPressAction,
  actionHint,
  actionDestructive = false,
  isPrimary = false,
  primaryLabel,
  rightSlot,
  fontScale,
  style,
  testID,
}: TrustedContactCardProps) {
  const { sf } = useFontScale(fontScale);
  const avatarSize = sf(48);
  const showAction = Boolean(onPressAction && actionLabel);

  const actionColor = actionDestructive
    ? theme.risk.intercept.main
    : theme.brand.blue;
  const actionTint = actionDestructive
    ? theme.risk.intercept.soft
    : theme.brand.blueSoft;

  const a11yLabel = [name, relationship, phoneMasked, isPrimary ? primaryLabel : undefined]
    .filter(Boolean)
    .join('. ');

  return (
    <View testID={testID} style={[styles.card, style]}>
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        style={styles.identity}
      >
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
            style={[styles.avatarText, { fontSize: sf(19) }]}
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
                { fontSize: sf(theme.typography.bodyBold.size) },
              ]}
            >
              {name}
            </Text>
            {isPrimary ? (
              <View style={styles.primaryPill}>
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.primaryPillText,
                    { fontSize: sf(theme.typography.tiny.size) },
                  ]}
                >
                  {primaryLabel ? `★ ${primaryLabel}` : '★'}
                </Text>
              </View>
            ) : null}
          </View>

          {relationship ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.relationship,
                { fontSize: sf(theme.typography.caption.size) },
              ]}
            >
              {relationship}
            </Text>
          ) : null}

          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[styles.phone, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {phoneMasked}
          </Text>
        </View>
      </View>

      {rightSlot ? (
        <View style={styles.slot}>{rightSlot}</View>
      ) : showAction ? (
        <Pressable
          onPress={onPressAction}
          accessible
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint}
          style={({ pressed }) => [
            styles.action,
            {
              minHeight: Math.max(theme.control.minTouch, sf(theme.control.minTouch)),
              backgroundColor: actionTint,
              borderColor: actionColor,
              opacity: pressed ? 0.7 : 1,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.actionLabel,
              { fontSize: sf(theme.typography.caption.size), color: actionColor },
            ]}
          >
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
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
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brand.blueSoft,
    marginRight: theme.spacing.lg,
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
  primaryPill: {
    marginLeft: theme.spacing.sm,
    backgroundColor: theme.brand.blueSoft,
    borderRadius: theme.radius.pill,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
  },
  primaryPillText: {
    color: theme.brand.navy,
    fontWeight: '700',
  },
  relationship: {
    marginTop: 2,
    color: theme.neutral.textSecondary,
  },
  phone: {
    marginTop: 2,
    color: theme.neutral.textMuted,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  slot: {
    marginLeft: theme.spacing.md,
    flexShrink: 0,
  },
  action: {
    marginLeft: theme.spacing.md,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    flexShrink: 0,
  },
  actionLabel: {
    fontWeight: '700',
  },
});

export default TrustedContactCard;
