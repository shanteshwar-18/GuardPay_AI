/**
 * GuardPay AI — OnboardingScreen (product spec §7)
 *
 * Three swipeable pages that explain, in plain language, what GuardPay does
 * BEFORE asking for a single permission. Built on a plain horizontal paged
 * ScrollView — no carousel dependency — so the whole thing stays inspectable and
 * testable.
 *
 * Illustrations are composed from styled Views + ShieldGlyph rather than raster
 * assets: they re-colour with the theme, scale with Senior Citizen Mode, and can
 * be edited by whoever owns this screen.
 *
 * COPY RULE (§7): the onboarding voice is consumer-grade. No model names, no
 * pipeline vocabulary — every string here comes from `onboarding.*` in i18n,
 * which is written for a first-time user, not an engineer.
 *
 * Leaving this screen (Skip or Get Started) writes `guardpay:onboarded` and
 * replaces to Permissions, so Back cannot land the user here again.
 */

import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import {
  ScreenContainer,
  PrimaryButton,
  SecondaryButton,
  Card,
  ShieldGlyph,
  SEVERITY_COLORS,
  SEVERITY_GLYPHS,
  useFontScale,
} from '../components/guardpay';
import type { FactorSeverity } from '../components/guardpay';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

/** Written here, read by SplashScreen on the next launch. */
const ONBOARDED_STORAGE_KEY = 'guardpay:onboarded';

const PAGE_COUNT = 3;

// ── Illustration sizing (derived from the spacing scale, not magic pixels) ─────
const HERO_SHIELD = theme.spacing.huge * 2;          // 80
const HERO_HALO = theme.spacing.huge * 3.4;          // 136
const SIGNAL_DOT = theme.spacing.md;                 // 12
const SKELETON_BAR_HEIGHT = theme.spacing.sm;        // 8
const TIER_BAR_WIDTH = theme.spacing.xxl;            // 24
const TIER_BAR_HEIGHTS = [
  theme.spacing.xxl,                                  // 24
  theme.spacing.huge,                                 // 40
  theme.spacing.huge + theme.spacing.xl,              // 60
  theme.spacing.huge * 2,                             // 80
];
/** Four tiers, in escalating order. Glyph + height carry the meaning, not colour alone. */
const TIER_SEVERITIES: FactorSeverity[] = ['normal', 'unusual', 'suspicious', 'critical'];

// ── Illustrations ─────────────────────────────────────────────────────────────
// All three are decorative: the page title + body carry the meaning for a screen
// reader, so the artwork is hidden from the accessibility tree entirely.

/** Page 1 — the shield at the centre of a ring of incoming signals. */
function ProtectionIllustration() {
  return (
    <View
      style={styles.illustration}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={styles.heroHalo}>
        <ShieldGlyph size={HERO_SHIELD} color={theme.brand.blue} glyph="🛡" />
      </View>

      <View style={[styles.signalDot, styles.signalTopLeft]} />
      <View style={[styles.signalDot, styles.signalTopRight]} />
      <View style={[styles.signalDot, styles.signalBottomLeft]} />
      <View style={[styles.signalDot, styles.signalBottomRight]} />
    </View>
  );
}

/** Page 2 — a payment being reviewed, with the shield stamped on the corner. */
function ReviewIllustration() {
  return (
    <View
      style={styles.illustration}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Card tone="tinted" style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <View style={styles.reviewAvatar} />
          <View style={styles.reviewLines}>
            <View style={[styles.skeletonBar, styles.skeletonWide]} />
            <View style={[styles.skeletonBar, styles.skeletonNarrow]} />
          </View>
        </View>

        <View style={styles.reviewDivider} />

        <View style={[styles.skeletonBar, styles.skeletonFull]} />
        <View style={[styles.skeletonBar, styles.skeletonMid]} />
      </Card>

      <View style={styles.reviewStamp}>
        <ShieldGlyph
          size={theme.spacing.huge}
          color={theme.brand.blue}
          glyph="✓"
        />
      </View>
    </View>
  );
}

/** Page 3 — response escalates with the risk: taller bar, different glyph. */
function TierIllustration() {
  return (
    <View
      style={styles.illustration}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={styles.tierRow}>
        {TIER_SEVERITIES.map((severity, index) => (
          <View key={severity} style={styles.tierColumn}>
            <Text allowFontScaling={false} style={[styles.tierGlyph, { color: SEVERITY_COLORS[severity].main }]}>
              {SEVERITY_GLYPHS[severity]}
            </Text>
            <View
              style={[
                styles.tierBar,
                {
                  height: TIER_BAR_HEIGHTS[index],
                  backgroundColor: SEVERITY_COLORS[severity].soft,
                  borderColor: SEVERITY_COLORS[severity].main,
                },
              ]}
            />
          </View>
        ))}
      </View>

      <View style={styles.tierBase} />
      <ShieldGlyph
        size={theme.spacing.xxxl}
        color={theme.brand.blue}
        glyph="🛡"
        style={styles.tierShield}
      />
    </View>
  );
}

const ILLUSTRATIONS = [ProtectionIllustration, ReviewIllustration, TierIllustration];

export function OnboardingScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { sf } = useFontScale();
  const { width } = useWindowDimensions();

  const scrollRef = useRef<ScrollView | null>(null);
  const [page, setPage] = useState(0);
  const isLastPage = page === PAGE_COUNT - 1;

  const pages = [
    { title: t('onboarding.s1Title'), body: t('onboarding.s1Body') },
    { title: t('onboarding.s2Title'), body: t('onboarding.s2Body') },
    { title: t('onboarding.s3Title'), body: t('onboarding.s3Body') },
  ];

  /** Persist the flag then move on. A storage failure must not trap the user. */
  const finish = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDED_STORAGE_KEY, 'true');
    } catch (err) {
      console.warn('[GuardPay] Onboarding flag write failed:', err);
    }
    navigation.replace('Permissions');
  }, [navigation]);

  const handleSkip = useCallback(() => {
    void finish();
  }, [finish]);

  const handleNext = useCallback(() => {
    if (isLastPage) {
      void finish();
      return;
    }
    const next = page + 1;
    setPage(next);
    scrollRef.current?.scrollTo({ x: next * width, y: 0, animated: true });
  }, [isLastPage, finish, page, width]);

  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (width <= 0) return;
      const index = Math.round(event.nativeEvent.contentOffset.x / width);
      const clamped = Math.min(PAGE_COUNT - 1, Math.max(0, index));
      setPage(clamped);
    },
    [width],
  );

  return (
    <ScreenContainer
      background="bg"
      padded={false}
      testID="onboarding-screen"
      footer={
        <View style={styles.gutter}>
          {/* Progress: active dot is wider AND fully opaque — never colour alone (§48). */}
          <View
            style={styles.dots}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
          >
            {pages.map((item, index) => (
              <View
                key={item.title}
                style={[styles.dot, index === page ? styles.dotActive : styles.dotIdle]}
              />
            ))}
          </View>

          <PrimaryButton
            label={isLastPage ? t('onboarding.getStarted') : t('onboarding.next')}
            onPress={handleNext}
            accessibilityHint={isLastPage ? pages[PAGE_COUNT - 1].body : pages[Math.min(page + 1, PAGE_COUNT - 1)].title}
            testID="onboarding-next"
          />
        </View>
      }
    >
      {/* Skip — always reachable, top right */}
      <View style={[styles.gutter, styles.skipRow]}>
        <SecondaryButton
          label={t('onboarding.skip')}
          onPress={handleSkip}
          variant="ghost"
          compact
          accessibilityHint={t('permissions.title')}
          testID="onboarding-skip"
        />
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.pager}
        contentContainerStyle={styles.pagerContent}
        testID="onboarding-pager"
      >
        {pages.map((item, index) => {
          const Illustration = ILLUSTRATIONS[index];
          return (
            <View key={item.title} style={[styles.page, { width }]}>
              <Illustration />

              <Text
                allowFontScaling={false}
                accessible
                accessibilityRole="header"
                style={[
                  styles.title,
                  {
                    fontSize: sf(theme.typography.h1.size),
                    lineHeight: sf(theme.typography.h1.lineHeight),
                  },
                ]}
              >
                {item.title}
              </Text>

              <Text
                allowFontScaling={false}
                accessible
                accessibilityRole="text"
                style={[
                  styles.body,
                  {
                    fontSize: sf(theme.typography.body.size),
                    lineHeight: sf(theme.typography.body.lineHeight),
                  },
                ]}
              >
                {item.body}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  gutter: {
    paddingHorizontal: theme.spacing.xl,
  },
  skipRow: {
    alignItems: 'flex-end',
    paddingTop: theme.spacing.sm,
    minHeight: theme.control.minTouch,
  },
  pager: {
    flex: 1,
  },
  pagerContent: {
    alignItems: 'stretch',
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  title: {
    marginTop: theme.spacing.xxxl,
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    marginTop: theme.spacing.md,
    color: theme.neutral.textSecondary,
    textAlign: 'center',
  },

  // ── Illustration shell ──────────────────────────────────────────────────────
  illustration: {
    width: '100%',
    height: HERO_HALO + theme.spacing.huge,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Page 1
  heroHalo: {
    width: HERO_HALO,
    height: HERO_HALO,
    borderRadius: HERO_HALO / 2,
    backgroundColor: theme.brand.blueSoft,
    borderWidth: 1,
    borderColor: theme.brand.blueMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signalDot: {
    position: 'absolute',
    width: SIGNAL_DOT,
    height: SIGNAL_DOT,
    borderRadius: SIGNAL_DOT / 2,
    backgroundColor: theme.brand.blueMid,
  },
  signalTopLeft: { top: theme.spacing.sm, left: theme.spacing.huge },
  signalTopRight: { top: theme.spacing.xl, right: theme.spacing.huge },
  signalBottomLeft: { bottom: theme.spacing.xl, left: theme.spacing.xxl },
  signalBottomRight: { bottom: theme.spacing.sm, right: theme.spacing.xxl },

  // Page 2
  reviewCard: {
    width: '84%',
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewAvatar: {
    width: theme.spacing.huge,
    height: theme.spacing.huge,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.brand.blueMid,
    marginRight: theme.spacing.md,
  },
  reviewLines: {
    flex: 1,
  },
  skeletonBar: {
    height: SKELETON_BAR_HEIGHT,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.neutral.borderStrong,
    marginTop: theme.spacing.xs,
  },
  skeletonWide: { width: '70%' },
  skeletonNarrow: { width: '45%' },
  skeletonFull: { width: '100%' },
  skeletonMid: { width: '60%' },
  reviewDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.brand.blueMid,
    marginVertical: theme.spacing.md,
  },
  reviewStamp: {
    position: 'absolute',
    right: theme.spacing.xxl,
    bottom: theme.spacing.sm,
  },

  // Page 3
  tierRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  tierColumn: {
    alignItems: 'center',
    marginHorizontal: theme.spacing.sm,
  },
  tierGlyph: {
    fontSize: theme.typography.caption.size,
    fontWeight: '700',
    marginBottom: theme.spacing.xs,
  },
  tierBar: {
    width: TIER_BAR_WIDTH,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
  },
  tierBase: {
    width: '62%',
    height: StyleSheet.hairlineWidth * 2 + 1,
    backgroundColor: theme.neutral.borderStrong,
    borderRadius: theme.radius.pill,
    marginTop: theme.spacing.sm,
  },
  tierShield: {
    position: 'absolute',
    left: theme.spacing.xl,
    top: theme.spacing.sm,
  },

  // ── Footer ──────────────────────────────────────────────────────────────────
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  dot: {
    height: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    marginHorizontal: theme.spacing.xs,
  },
  dotActive: {
    width: theme.spacing.xxl,
    backgroundColor: theme.brand.blue,
    opacity: 1,
  },
  dotIdle: {
    width: theme.spacing.sm,
    backgroundColor: theme.neutral.borderStrong,
    opacity: 0.7,
  },
});

export default OnboardingScreen;
