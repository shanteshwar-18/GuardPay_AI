/**
 * AppHeader — back affordance, centred title, optional right slot.
 *
 * The chevron is a text glyph: this project has no vector-icon or SVG library,
 * so '‹' is drawn oversized and optically centred inside a minTouch-sized hit
 * area (§48). The title is already-translated copy supplied by the screen.
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

export interface AppHeaderProps {
  /** Already-translated screen title. */
  title: string;
  /** Already-translated secondary line under the title. */
  subtitle?: string;
  /** Omit to hide the back control entirely (root screens). */
  onBack?: () => void;
  /**
   * Already-translated accessible name for the back control. Falls back to the
   * title so the control is never unlabelled, even if the screen forgets it.
   */
  backAccessibilityLabel?: string;
  backAccessibilityHint?: string;
  /** Rendered at the trailing edge — a badge, a text button, a toggle. */
  right?: React.ReactNode;
  /** Render on the navy brand surface instead of the light app background. */
  onDark?: boolean;
  /** Draw the 1px divider under the header. Default true. */
  bordered?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  backAccessibilityLabel,
  backAccessibilityHint,
  right,
  onDark = false,
  bordered = true,
  fontScale,
  style,
  testID,
}: AppHeaderProps) {
  const { sf } = useFontScale(fontScale);

  const titleColor = onDark ? theme.neutral.textInverse : theme.neutral.textPrimary;
  const subtitleColor = onDark ? theme.neutral.textMuted : theme.neutral.textSecondary;
  const chevronColor = onDark ? theme.neutral.textInverse : theme.brand.navy;

  return (
    <View
      testID={testID}
      accessibilityRole="header"
      style={[
        styles.container,
        bordered && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: onDark ? theme.brand.navySoft : theme.neutral.border,
        },
        style,
      ]}
    >
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            accessible
            accessibilityRole="button"
            accessibilityLabel={backAccessibilityLabel ?? title}
            accessibilityHint={backAccessibilityHint}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.backButtonPressed,
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.chevron, { color: chevronColor, fontSize: sf(theme.control.iconLg) }]}
            >
              {'‹'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.titleWrap} accessible accessibilityRole="text">
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.title,
            {
              color: titleColor,
              fontSize: sf(theme.typography.h3.size),
              lineHeight: sf(theme.typography.h3.lineHeight),
            },
          ]}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color: subtitleColor,
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={[styles.side, styles.sideRight]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.control.minTouch + theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  side: {
    minWidth: theme.control.minTouch,
    justifyContent: 'center',
  },
  sideRight: {
    alignItems: 'flex-end',
  },
  backButton: {
    width: theme.control.minTouch,
    height: theme.control.minTouch,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPressed: {
    backgroundColor: theme.neutral.surfaceAlt,
    opacity: 0.9,
  },
  chevron: {
    fontWeight: '700',
    textAlign: 'center',
    // The '‹' glyph sits low in its em box; nudge it optically centred.
    marginTop: -theme.spacing.xs,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontWeight: '400',
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
});

export default AppHeader;
