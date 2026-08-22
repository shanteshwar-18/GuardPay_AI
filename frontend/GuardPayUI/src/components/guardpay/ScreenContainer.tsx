/**
 * ScreenContainer — the outer shell every GuardPay screen sits in.
 *
 * Owns the three things screens kept re-inventing: the safe area, the page
 * background (app grey or brand navy) and one consistent horizontal gutter.
 * Optionally scrolls, and optionally pins a footer (the primary CTA) to the
 * bottom of the viewport so it never scrolls away.
 *
 * react-native-safe-area-context is not in this component library's dependency
 * set, so the core SafeAreaView is used and the Android status bar inset is
 * applied manually (SafeAreaView is a no-op View on Android).
 */

import React from 'react';
import {
  SafeAreaView,
  View,
  ScrollView,
  StatusBar,
  StyleSheet,
  Platform,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';

export type ScreenBackground = 'bg' | 'navy';

export interface ScreenContainerProps {
  children: React.ReactNode;
  /** Wrap children in a ScrollView. Default false. */
  scroll?: boolean;
  /** 'bg' = app grey (default), 'navy' = brand navy (splash / onboarding). */
  background?: ScreenBackground;
  /** Pinned to the bottom, outside the scroll area — typically the primary CTA. */
  footer?: React.ReactNode;
  /** Apply the standard horizontal gutter to the content. Default true. */
  padded?: boolean;
  /** Extra style for the content wrapper (or the ScrollView's contentContainer). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Style for the outermost safe-area View. */
  style?: StyleProp<ViewStyle>;
  /** Hide the OS status bar contents management (leave the app's own bar alone). */
  manageStatusBar?: boolean;
  /** Forwarded to ScrollView when `scroll` is set. */
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  /** Forwarded to ScrollView when `scroll` is set. */
  showsVerticalScrollIndicator?: boolean;
  testID?: string;
}

const ANDROID_STATUS_INSET = Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0;

export function ScreenContainer({
  children,
  scroll = false,
  background = 'bg',
  footer,
  padded = true,
  contentStyle,
  style,
  manageStatusBar = true,
  keyboardShouldPersistTaps = 'handled',
  showsVerticalScrollIndicator = false,
  testID,
}: ScreenContainerProps) {
  const onNavy = background === 'navy';
  const surfaceColor = onNavy ? theme.brand.navy : theme.neutral.bg;

  const gutter = padded ? styles.gutter : null;

  return (
    <SafeAreaView
      testID={testID}
      style={[styles.safe, { backgroundColor: surfaceColor, paddingTop: ANDROID_STATUS_INSET }, style]}
    >
      {manageStatusBar ? (
        <StatusBar
          barStyle={onNavy ? 'light-content' : 'dark-content'}
          backgroundColor={surfaceColor}
        />
      ) : null}

      {scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, gutter, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, gutter, contentStyle]}>{children}</View>
      )}

      {footer ? (
        <View
          style={[
            styles.footer,
            gutter,
            {
              backgroundColor: surfaceColor,
              borderTopColor: onNavy ? theme.brand.navySoft : theme.neutral.border,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  gutter: {
    paddingHorizontal: theme.spacing.xl,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xxxl,
  },
  footer: {
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default ScreenContainer;
