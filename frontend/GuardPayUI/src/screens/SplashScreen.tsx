/**
 * GuardPay AI — SplashScreen (product spec §6)
 *
 * The first thing a user sees: brand navy, the GuardPay mark, the tagline, and a
 * single subtle shield pulse so the screen feels alive rather than frozen while
 * the launch decision is made.
 *
 * Routing contract:
 *   • first launch  → Onboarding
 *   • every launch after that → Home
 * "Has onboarded" lives in AsyncStorage under `guardpay:onboarded`. A storage
 * failure must never strand the user on the splash, so the read is wrapped and
 * falls back to "not onboarded" — showing onboarding again is a harmless
 * degradation, a black hole on launch is not.
 *
 * All copy comes from i18n (`splash.*`). "GuardPay AI" itself is a brand mark and
 * is rendered by GuardPayLogo, not by this screen.
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import {
  ScreenContainer,
  GuardPayLogo,
  AnimatedShieldWrap,
  useFontScale,
} from '../components/guardpay';

type Props = NativeStackScreenProps<RootStackParamList, 'Splash'>;

/** Shared with OnboardingScreen, which writes this flag. */
export const ONBOARDED_STORAGE_KEY = 'guardpay:onboarded';

/** Minimum time the brand screen stays up before routing on (§6). */
const SPLASH_MIN_VISIBLE_MS = 1200;
/** One half of the pulse cycle. Slow enough to read as "breathing", not "loading". */
const PULSE_HALF_CYCLE_MS = 900;
/** Fade the mark in rather than snapping it on. */
const LOGO_FADE_MS = 420;

/** Halo ring behind the shield, sized off the spacing scale rather than a magic px. */
const HALO_SIZE = theme.spacing.huge * 4;

export function SplashScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { sf } = useFontScale();

  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // ── Subtle shield pulse + one-shot logo fade ────────────────────────────────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: PULSE_HALF_CYCLE_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const fadeIn = Animated.timing(fade, {
      toValue: 1,
      duration: LOGO_FADE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });

    loop.start();
    fadeIn.start();

    // Stop both on unmount so no animation frame fires against a dead screen.
    return () => {
      loop.stop();
      fadeIn.stop();
      pulse.setValue(0);
      fade.setValue(0);
    };
  }, [pulse, fade]);

  // ── Launch routing ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const decide = async () => {
      let onboarded = false;
      try {
        onboarded = (await AsyncStorage.getItem(ONBOARDED_STORAGE_KEY)) === 'true';
      } catch (err) {
        // Storage unavailable → treat as a fresh install rather than crashing.
        console.warn('[GuardPay] Splash onboarding-flag read failed:', err);
        onboarded = false;
      }

      if (cancelled) return;

      const remaining = Math.max(0, SPLASH_MIN_VISIBLE_MS - (Date.now() - startedAt));
      timer = setTimeout(() => {
        if (cancelled) return;
        navigation.replace(onboarded ? 'Home' : 'Onboarding');
      }, remaining);
    };

    void decide();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [navigation]);

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.38, 0.1] });

  return (
    <ScreenContainer background="navy" testID="splash-screen">
      <View style={styles.root}>
        {/* Hero: pulsing halo behind the brand shield */}
        <View style={styles.hero}>
          <AnimatedShieldWrap
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={[
              styles.halo,
              { opacity: haloOpacity, transform: [{ scale: haloScale }] },
            ]}
          />

          <Animated.View style={{ opacity: fade }}>
            <GuardPayLogo
              size="lg"
              variant="dark"
              stacked
              showTagline
              tagline={t('splash.tagline')}
              testID="splash-logo"
            />
          </Animated.View>
        </View>

        {/* Bottom reassurance line */}
        <Animated.View style={[styles.footer, { opacity: fade }]}>
          <Text
            allowFontScaling={false}
            accessible
            accessibilityRole="text"
            style={[
              styles.subtitle,
              {
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {t('splash.subtitle')}
          </Text>
        </Animated.View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: HALO_SIZE,
    height: HALO_SIZE,
    borderRadius: HALO_SIZE / 2,
    backgroundColor: theme.brand.blueMid,
  },
  footer: {
    paddingBottom: theme.spacing.huge,
    paddingHorizontal: theme.spacing.xl,
  },
  subtitle: {
    color: theme.neutral.textMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default SplashScreen;
