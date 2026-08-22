/**
 * GuardPay AI — SimulatedCallBanner
 * Fixed overlay showing "Active Call: Unknown Caller" with a live duration counter.
 * Mounts on EVERY screen to simulate the fraud-call scenario for the demo.
 *
 * Toggle visibility via the isCallActive prop or the CallBannerContext.
 */

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { formatCallDuration } from '../services/format';
import { useScaledFont } from '../context/SeniorModeContext';

type Props = {
  isCallActive?: boolean;
};

export function SimulatedCallBanner({ isCallActive = true }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const [elapsed, setElapsed] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Live call duration counter
  useEffect(() => {
    if (!isCallActive) return;
    const interval = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(interval);
  }, [isCallActive]);

  // Pulsing red dot animation
  useEffect(() => {
    if (!isCallActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [isCallActive, pulseAnim]);

  if (!isCallActive) return null;

  return (
    <View
      style={styles.banner}
      testID="call-banner"
      accessible={true}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={`${t('call.banner')} — ${formatCallDuration(elapsed)}`}
    >
      <Animated.View style={[styles.redDot, { opacity: pulseAnim }]} />
      <Text style={styles.phoneIcon}>📞</Text>
      <Text style={[styles.label, { fontSize: sf(12) }]}>{t('call.banner')}</Text>
      <Text style={[styles.timer, { fontSize: sf(12) }]}>{formatCallDuration(elapsed)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8B0000',
    paddingVertical: 6,
    paddingHorizontal: 14,
    width: '100%',
  },
  redDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF3B30',
    marginRight: 6,
  },
  phoneIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  label: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  timer: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
