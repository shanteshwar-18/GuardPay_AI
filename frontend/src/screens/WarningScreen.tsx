/**
 * WarningScreen — Risk Tier: WARNING (score 40–70)
 *
 * Amber-themed screen with:
 * - Circular risk score gauge (0–100, amber fill)
 * - SHAP explanation bulleted list
 * - Multilingual warning banner with TTS auto-play on mount
 * - Mute/Replay speaker icon (top-right)
 * - Proceed Anyway (secondary, grey) + Cancel Transaction (primary, amber)
 *   Cancel is visually dominant.
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { RiskScoreResponse } from '../types';
import {
  colors,
  typography,
  spacing,
  radius,
  TIER_COLORS,
  TIER_BG,
} from '../theme';
import RiskGauge from '../components/RiskGauge';
import ExplanationList from '../components/ExplanationList';
import TTSControl from '../components/TTSControl';
import { warn, stopSpeech, SupportedLanguage } from '../services/tts';

interface WarningScreenProps {
  riskResponse: RiskScoreResponse;
  onProceed?: () => void;
  onCancel?: () => void;
  /** Detected language for TTS — defaults to EN */
  detectedLanguage?: SupportedLanguage;
}

export default function WarningScreen({
  riskResponse,
  onProceed,
  onCancel,
  detectedLanguage = 'EN',
}: WarningScreenProps) {
  const tierColor = TIER_COLORS.WARNING;

  // TTS: speak warning aloud on mount (Prompt 5)
  const warningText = riskResponse.explanation.join('. ');
  useEffect(() => {
    warn(warningText, detectedLanguage);
    return () => {
      stopSpeech(); // Clean up on screen leave
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      {/* TTS Mute/Replay Control (top-right) */}
      <TTSControl text={warningText} lang={detectedLanguage} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Warning Header */}
        <View style={styles.header}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.title}>Transaction Warning</Text>
          <Text style={styles.subtitle}>
            Potential risk factors have been detected
          </Text>
        </View>

        {/* Risk Gauge Card */}
        <View style={[styles.card, { borderColor: tierColor + '40' }]}>
          <View style={styles.gaugeContainer}>
            <RiskGauge
              score={riskResponse.score}
              tier={riskResponse.tier}
              size={140}
            />
          </View>

          {/* Tier Label */}
          <View style={[styles.tierBadge, { backgroundColor: tierColor + '20' }]}>
            <Text style={[styles.tierText, { color: tierColor }]}>
              ⚠ MEDIUM RISK
            </Text>
          </View>
        </View>

        {/* SHAP Explanation List */}
        <ExplanationList
          explanations={riskResponse.explanation}
          tier={riskResponse.tier}
        />

        {/* Multilingual Warning Banner (placeholder — TTS wired in Prompt 5) */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningBannerIcon}>🔊</Text>
          <Text style={styles.warningBannerText}>
            Warning: This transaction has been flagged for potential fraud risk.
            Please review the risk factors above carefully before proceeding.
          </Text>
        </View>

        {/* Action Buttons — Cancel is visually dominant */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={onCancel}
            activeOpacity={0.8}
          >
            <Text style={styles.cancelButtonText}>Cancel Transaction</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.proceedButton]}
            onPress={onProceed}
            activeOpacity={0.8}
          >
            <Text style={styles.proceedButtonText}>Proceed Anyway</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  warningIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: TIER_BG.WARNING,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  gaugeContainer: {
    marginBottom: spacing.md,
  },
  tierBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  tierText: {
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    backgroundColor: TIER_COLORS.WARNING + '15',
    borderRadius: radius.md,
    borderLeftWidth: 4,
    borderLeftColor: TIER_COLORS.WARNING,
    padding: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  warningBannerIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  warningBannerText: {
    fontSize: typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    width: '100%',
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: TIER_COLORS.WARNING,
  },
  cancelButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#000000',
  },
  proceedButton: {
    backgroundColor: colors.surfaceLight,
  },
  proceedButtonText: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
