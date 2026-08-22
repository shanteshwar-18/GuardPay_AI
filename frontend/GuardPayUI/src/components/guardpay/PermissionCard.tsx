/**
 * PermissionCard — one OS permission (or demo signal) with a plain-language
 * explanation of WHY GuardPay wants it, its current status, and an Allow action.
 *
 * HONESTY RULE: a `simulated` status is a demo signal, NOT a granted OS
 * permission. The spec forbids dressing one up as the other, so the simulated
 * state is visually distinct — dashed border, a distinct glyph, a blue "demo"
 * tint rather than the green of a real grant — it is labelled by the caller's
 * `statusLabel`, it can carry an explicit `simulatedNote`, and it deliberately
 * offers NO Allow button, because there is no OS grant to request.
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
import { PermissionStatus, PERMISSION_TONES } from './types';
import { useFontScale } from './useFontScale';

export interface PermissionCardProps {
  /** Decorative glyph, e.g. '🎙' / '☏' / '🔔'. */
  icon: string;
  /** Pre-translated permission name. */
  name: string;
  /** Pre-translated plain-language reason GuardPay needs it. */
  description: string;
  status: PermissionStatus;
  /**
   * Pre-translated status word for the pill. Falls back to the machine key so
   * the state is never conveyed by colour alone (§48).
   */
  statusLabel?: string;
  /** Pre-translated label for the Allow action. */
  actionLabel?: string;
  onRequest?: () => void;
  /** Pre-translated hint describing the consequence of allowing. */
  actionHint?: string;
  /**
   * Pre-translated clarification shown only for `simulated`, e.g. "Demo signal —
   * no real microphone access". Strongly recommended.
   */
  simulatedNote?: string;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function PermissionCard({
  icon,
  name,
  description,
  status,
  statusLabel,
  actionLabel,
  onRequest,
  actionHint,
  simulatedNote,
  fontScale,
  style,
  testID,
}: PermissionCardProps) {
  const { sf } = useFontScale(fontScale);
  const tone = PERMISSION_TONES[status];
  const isSimulated = status === 'simulated';

  // Only a real, ungranted OS permission can be requested.
  const canRequest =
    !isSimulated &&
    status !== 'granted' &&
    Boolean(onRequest) &&
    Boolean(actionLabel);

  const word = statusLabel ?? status;
  const a11yLabel = [name, word, description, isSimulated ? simulatedNote : undefined]
    .filter(Boolean)
    .join('. ');
  const iconSize = sf(40);

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        isSimulated && styles.simulatedCard,
        style,
      ]}
    >
      <View
        accessible
        accessibilityRole="text"
        accessibilityLabel={a11yLabel}
        style={styles.headRow}
      >
        <View
          style={[
            styles.iconPuck,
            {
              width: iconSize,
              height: iconSize,
              borderRadius: theme.radius.md,
              backgroundColor: tone.soft,
            },
          ]}
        >
          <Text allowFontScaling={false} style={{ fontSize: sf(18) }}>
            {icon}
          </Text>
        </View>

        <View style={styles.body}>
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[
              styles.name,
              { fontSize: sf(theme.typography.bodyBold.size) },
            ]}
          >
            {name}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={4}
            style={[
              styles.description,
              {
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {description}
          </Text>
        </View>

        {/* Status pill — glyph + word, never colour alone */}
        <View
          style={[
            styles.pill,
            {
              backgroundColor: tone.soft,
              borderColor: tone.main,
              borderStyle: isSimulated ? 'dashed' : 'solid',
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.pillText,
              { fontSize: sf(theme.typography.tiny.size), color: tone.main },
            ]}
          >
            {`${tone.glyph} ${word}`}
          </Text>
        </View>
      </View>

      {isSimulated && simulatedNote ? (
        <View style={styles.noteRow}>
          <Text
            allowFontScaling={false}
            numberOfLines={3}
            style={[
              styles.note,
              { fontSize: sf(theme.typography.tiny.size) },
            ]}
          >
            {simulatedNote}
          </Text>
        </View>
      ) : null}

      {canRequest ? (
        <Pressable
          onPress={onRequest}
          accessible
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          accessibilityHint={actionHint}
          style={({ pressed }) => [
            styles.action,
            {
              minHeight: Math.max(theme.control.minTouch, sf(theme.control.buttonHeightSm)),
              backgroundColor: pressed ? theme.brand.blueDark : theme.brand.blue,
            },
          ]}
        >
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.actionLabel,
              { fontSize: sf(theme.typography.bodyBold.size) },
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
    backgroundColor: theme.neutral.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    padding: theme.spacing.lg,
    ...theme.elevation.sm,
  },
  simulatedCard: {
    borderStyle: 'dashed',
    borderColor: theme.brand.blueMid,
    backgroundColor: theme.neutral.surface,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconPuck: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
    flexShrink: 0,
  },
  body: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  name: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
  description: {
    marginTop: 2,
    color: theme.neutral.textSecondary,
  },
  pill: {
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    flexShrink: 0,
    maxWidth: '38%',
  },
  pillText: {
    fontWeight: '700',
    letterSpacing: 0.2,
    textTransform: 'capitalize',
  },
  noteRow: {
    marginTop: theme.spacing.md,
    backgroundColor: theme.brand.blueSoft,
    borderRadius: theme.radius.sm,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  note: {
    color: theme.brand.navy,
    fontWeight: '600',
  },
  action: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  actionLabel: {
    color: theme.neutral.textInverse,
    fontWeight: '700',
  },
});

export default PermissionCard;
