/**
 * WhatWeCheckedList — the plain-language explanation block (§18).
 *
 * Renders the backend `factors[]` as RiskFactorRow entries in plain language up
 * front, and hides the raw SHAP / numeric values behind a COLLAPSIBLE
 * "Technical details" section that is COLLAPSED BY DEFAULT. The technical
 * disclosure exists for the sceptical user and for demo credibility; it must
 * never be the first thing a worried person reads.
 *
 * Every string is supplied pre-translated (§26) — this component never calls t().
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';
import { FactorSeverity, severityForPoints } from './types';
import { RiskFactorRow } from './RiskFactorRow';
import { useFontScale } from './useFontScale';

/**
 * Structurally compatible with the backend `RiskFactor` ({ factor, points }),
 * with optional extras a screen may enrich it with.
 */
export interface WhatWeCheckedFactor {
  /** Plain-language factor name from the backend. */
  factor: string;
  /** SHAP-derived weight. */
  points?: number;
  /** Explicit severity; derived from `points` when absent. */
  severity?: FactorSeverity;
  /** Optional pre-translated one-liner shown under the name. */
  explanation?: string;
  /** Optional pre-translated severity word for this row. */
  severityLabel?: string;
  /** Optional raw technical string shown only in the expanded section. */
  technical?: string;
}

export interface WhatWeCheckedListProps {
  factors: WhatWeCheckedFactor[];
  /** Pre-translated section title, e.g. "What we checked". */
  title: string;
  /** Pre-translated label for the collapsible technical section. */
  technicalLabel: string;
  /** Senior Citizen Mode: suppress every numeric weight. */
  hidePoints?: boolean;
  /** Offer the technical disclosure at all. Default true. */
  showTechnical?: boolean;
  /** Pre-translated severity words keyed by severity. */
  severityLabels?: Partial<Record<FactorSeverity, string>>;
  /** Pre-translated hint read out on the disclosure toggle. */
  technicalHint?: string;
  /** Pre-translated line shown when `factors` is empty. */
  emptyLabel?: string;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SEVERITY_RANK: Record<FactorSeverity, number> = {
  critical: 3,
  suspicious: 2,
  unusual: 1,
  normal: 0,
};

export function WhatWeCheckedList({
  factors,
  title,
  technicalLabel,
  hidePoints = false,
  showTechnical = true,
  severityLabels,
  technicalHint,
  emptyLabel,
  fontScale,
  style,
  testID,
}: WhatWeCheckedListProps) {
  const { sf } = useFontScale(fontScale);
  const [expanded, setExpanded] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Resolve severity once, then sort worst-first so the riskiest signal leads.
  const resolved = useMemo(() => {
    return factors
      .map(f => {
        const points = typeof f.points === 'number' ? f.points : undefined;
        const severity: FactorSeverity =
          f.severity ?? severityForPoints(points ?? 0);
        return { ...f, points, severity };
      })
      .sort((a, b) => {
        const rank = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
        if (rank !== 0) return rank;
        return (b.points ?? 0) - (a.points ?? 0);
      });
  }, [factors]);

  // Subtle fade for the disclosure; stopped on unmount (§47).
  useEffect(() => {
    const animation = Animated.timing(fade, {
      toValue: expanded ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [expanded, fade]);

  const toggle = useCallback(() => setExpanded(prev => !prev), []);

  return (
    <View testID={testID} style={[styles.wrap, style]}>
      <Text
        allowFontScaling={false}
        accessibilityRole="header"
        style={[
          styles.title,
          {
            fontSize: sf(theme.typography.h3.size),
            lineHeight: sf(theme.typography.h3.lineHeight),
          },
        ]}
      >
        {title}
      </Text>

      {resolved.length === 0 ? (
        emptyLabel ? (
          <Text
            allowFontScaling={false}
            style={[styles.empty, { fontSize: sf(theme.typography.body.size) }]}
          >
            {emptyLabel}
          </Text>
        ) : null
      ) : (
        <View accessibilityRole="list" style={styles.list}>
          {resolved.map((f, i) => (
            <RiskFactorRow
              key={`${f.factor}-${i}`}
              name={f.factor}
              severity={f.severity}
              explanation={f.explanation}
              points={f.points}
              hidePoints={hidePoints}
              severityLabel={f.severityLabel ?? severityLabels?.[f.severity]}
              isLast={i === resolved.length - 1}
              fontScale={fontScale}
            />
          ))}
        </View>
      )}

      {/* Collapsible technical disclosure — collapsed by default (§18) */}
      {showTechnical && resolved.length > 0 ? (
        <View style={styles.technicalBlock}>
          <Pressable
            onPress={toggle}
            accessible
            accessibilityRole="button"
            accessibilityLabel={technicalLabel}
            accessibilityHint={technicalHint}
            accessibilityState={{ expanded }}
            hitSlop={theme.spacing.sm}
            style={({ pressed }) => [
              styles.disclosure,
              { minHeight: Math.max(theme.control.minTouch, sf(44)) },
              pressed && styles.disclosurePressed,
            ]}
          >
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[
                styles.disclosureLabel,
                { fontSize: sf(theme.typography.caption.size) },
              ]}
            >
              {technicalLabel}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.chevron, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {expanded ? '▲' : '▼'}
            </Text>
          </Pressable>

          {expanded ? (
            <Animated.View style={[styles.technicalBody, { opacity: fade }]}>
              {resolved.map((f, i) => (
                <View key={`tech-${f.factor}-${i}`} style={styles.techRow}>
                  <Text
                    allowFontScaling={false}
                    numberOfLines={2}
                    style={[
                      styles.techKey,
                      { fontSize: sf(theme.typography.tiny.size) },
                    ]}
                  >
                    {f.technical ?? f.factor}
                  </Text>
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.techValue,
                      { fontSize: sf(theme.typography.tiny.size) },
                    ]}
                  >
                    {typeof f.points === 'number' ? `+${f.points}` : '—'}
                  </Text>
                </View>
              ))}
            </Animated.View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    marginBottom: theme.spacing.sm,
  },
  list: {
    width: '100%',
  },
  empty: {
    color: theme.neutral.textSecondary,
    paddingVertical: theme.spacing.md,
  },
  technicalBlock: {
    marginTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.neutral.border,
    paddingTop: theme.spacing.sm,
  },
  disclosure: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.radius.sm,
  },
  disclosurePressed: {
    backgroundColor: theme.neutral.surfaceAlt,
  },
  disclosureLabel: {
    color: theme.neutral.textSecondary,
    fontWeight: '600',
    flexShrink: 1,
    paddingRight: theme.spacing.sm,
  },
  chevron: {
    color: theme.neutral.textMuted,
    fontWeight: '700',
  },
  technicalBody: {
    marginTop: theme.spacing.xs,
    backgroundColor: theme.neutral.surfaceAlt,
    borderRadius: theme.radius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
  },
  techRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  techKey: {
    flex: 1,
    color: theme.neutral.textSecondary,
    fontWeight: '500',
    paddingRight: theme.spacing.sm,
  },
  techValue: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
});

export default WhatWeCheckedList;
