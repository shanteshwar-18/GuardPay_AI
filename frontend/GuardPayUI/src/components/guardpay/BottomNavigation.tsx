/**
 * BottomNavigation — the five-tab app bar (presentational only).
 *
 * Deliberately NOT wired to the navigator: it takes `active` and calls
 * `onNavigate`, so the navigator (or a screen harness) owns routing.
 *
 * Selection is signalled three ways, never by colour alone (§48): the brand
 * colour, a heavier label weight, and a pill indicator above the glyph — plus
 * `accessibilityState.selected` for screen readers. Every tab is at least
 * theme.control.minTouch tall. Labels arrive already translated.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';
import { BOTTOM_NAV_TABS, BOTTOM_NAV_GLYPHS, BottomNavTabKey } from './types';
import { useFontScale } from './useFontScale';

export type { BottomNavTabKey };

export interface BottomNavigationProps {
  /** Currently selected tab. */
  active: BottomNavTabKey;
  onNavigate: (tab: BottomNavTabKey) => void;
  /** Already-translated label for each of the five tabs. */
  labels: Record<BottomNavTabKey, string>;
  /** Optional already-translated hints, e.g. "Opens your payment history". */
  hints?: Partial<Record<BottomNavTabKey, string>>;
  /** Small count/dot badge per tab; numbers are rendered as-is. */
  badges?: Partial<Record<BottomNavTabKey, number | string>>;
  /** Override the decorative glyphs (no icon library is available here). */
  glyphs?: Partial<Record<BottomNavTabKey, string>>;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function BottomNavigation({
  active,
  onNavigate,
  labels,
  hints,
  badges,
  glyphs,
  fontScale,
  style,
  testID,
}: BottomNavigationProps) {
  const { sf } = useFontScale(fontScale);

  // Subtle, non-blocking selection pop (§47): transform/opacity only, so it can
  // run on the native driver and never gates a tap.
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    pop.setValue(0);
    const anim = Animated.timing(pop, {
      toValue: 1,
      duration: 160,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [active, pop]);

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={[styles.bar, style]}
    >
      {BOTTOM_NAV_TABS.map((tab) => {
        const isActive = tab === active;
        const label = labels[tab];
        const glyph = glyphs?.[tab] ?? BOTTOM_NAV_GLYPHS[tab];
        const badge = badges?.[tab];

        return (
          <Pressable
            key={tab}
            testID={testID ? `${testID}-${tab}` : undefined}
            onPress={() => onNavigate(tab)}
            accessible
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityHint={hints?.[tab]}
            accessibilityState={{ selected: isActive }}
            style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.indicator,
                {
                  backgroundColor: isActive ? theme.brand.blue : 'transparent',
                  opacity: isActive ? pop : 0,
                  transform: [{ scaleX: isActive ? pop : 1 }],
                },
              ]}
            />

            <View style={styles.glyphRow}>
              <Text
                allowFontScaling={false}
                style={[
                  styles.glyph,
                  {
                    fontSize: sf(theme.control.iconSm),
                    color: isActive ? theme.brand.blue : theme.neutral.textMuted,
                  },
                ]}
              >
                {glyph}
              </Text>

              {badge !== undefined && badge !== '' ? (
                <View style={styles.badge}>
                  <Text
                    allowFontScaling={false}
                    style={[styles.badgeText, { fontSize: sf(theme.typography.tiny.size) }]}
                    numberOfLines={1}
                  >
                    {String(badge)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[
                styles.label,
                {
                  fontSize: sf(theme.typography.tiny.size),
                  color: isActive ? theme.brand.blue : theme.neutral.textSecondary,
                  fontWeight: isActive ? '700' : '500',
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: theme.neutral.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.neutral.border,
    paddingBottom: theme.spacing.sm,
    ...theme.elevation.sm,
  },
  tab: {
    flex: 1,
    minHeight: theme.control.minTouch + theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
  },
  tabPressed: {
    opacity: 0.6,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: theme.control.iconMd,
    height: theme.spacing.xs,
    borderRadius: theme.radius.pill,
  },
  glyphRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  glyph: {
    fontWeight: '600',
    textAlign: 'center',
  },
  label: {
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  badge: {
    minWidth: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.status.error,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.xs,
  },
  badgeText: {
    color: theme.neutral.textInverse,
    fontWeight: '700',
  },
});

export default BottomNavigation;
