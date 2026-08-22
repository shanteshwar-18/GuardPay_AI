/**
 * GuardPay AI — Shared types for the `guardpay` UI component library.
 *
 * Nothing in this folder hardcodes user-facing copy: every string a component
 * renders arrives already translated as a prop (spec §26). The only literals
 * here are machine constants (tier ids, severity keys) and decorative glyphs.
 */

import { risk as riskColors, brand, neutral, status } from '../../theme';
import type { RiskTierId } from '../../config/riskTiers';

// ── Severity (per-factor, "What We Checked" rows) ─────────────────────────────
export type FactorSeverity = 'normal' | 'unusual' | 'suspicious' | 'critical';

/** Colour per severity. Always paired with a word/glyph — never colour alone (§48). */
export const SEVERITY_COLORS: Record<FactorSeverity, { main: string; soft: string; border: string }> = {
  normal: { main: riskColors.safe.main, soft: riskColors.safe.soft, border: riskColors.safe.border },
  unusual: { main: riskColors.warning.main, soft: riskColors.warning.soft, border: riskColors.warning.border },
  suspicious: { main: riskColors.hold.main, soft: riskColors.hold.soft, border: riskColors.hold.border },
  critical: { main: riskColors.intercept.main, soft: riskColors.intercept.soft, border: riskColors.intercept.border },
};

/** Decorative glyph per severity (paired with the severity word for a11y). */
export const SEVERITY_GLYPHS: Record<FactorSeverity, string> = {
  normal: '✓',
  unusual: '!',
  suspicious: '⚠',
  critical: '✕',
};

/**
 * Default points → severity mapping for backend `factors[]` entries.
 * Overridable via the `severityForPoints` prop on WhatWeCheckedList; risk *tier*
 * thresholds stay in config/riskTiers.ts, these are per-factor weights only.
 */
export function severityForPoints(points: number): FactorSeverity {
  if (points >= 30) return 'critical';
  if (points >= 20) return 'suspicious';
  if (points >= 10) return 'unusual';
  return 'normal';
}

// ── Banner / alert tones ──────────────────────────────────────────────────────
export type AlertTone = 'info' | 'warning' | 'danger' | 'success';

export const ALERT_TONES: Record<AlertTone, { main: string; soft: string; border: string; glyph: string }> = {
  info: { main: brand.blue, soft: brand.blueSoft, border: brand.blueMid, glyph: 'i' },
  warning: { main: riskColors.warning.main, soft: riskColors.warning.soft, border: riskColors.warning.border, glyph: '!' },
  danger: { main: riskColors.intercept.main, soft: riskColors.intercept.soft, border: riskColors.intercept.border, glyph: '✕' },
  success: { main: status.success, soft: riskColors.safe.soft, border: riskColors.safe.border, glyph: '✓' },
};

// ── Button tones ──────────────────────────────────────────────────────────────
export type ButtonTone = 'primary' | 'danger' | 'success';

export const BUTTON_TONES: Record<ButtonTone, { base: string; pressed: string; onColor: string }> = {
  primary: { base: brand.blue, pressed: brand.blueDark, onColor: neutral.textInverse },
  danger: { base: riskColors.intercept.main, pressed: riskColors.intercept.dark, onColor: neutral.textInverse },
  success: { base: riskColors.safe.main, pressed: riskColors.safe.dark, onColor: neutral.textInverse },
};

// ── Security status ───────────────────────────────────────────────────────────
export type SecurityTone = 'protected' | 'inactive' | 'alert';

// ── Permissions ───────────────────────────────────────────────────────────────
export type PermissionStatus = 'granted' | 'denied' | 'not-requested' | 'simulated';

export const PERMISSION_TONES: Record<PermissionStatus, { main: string; soft: string; glyph: string }> = {
  granted: { main: riskColors.safe.main, soft: riskColors.safe.soft, glyph: '✓' },
  denied: { main: riskColors.intercept.main, soft: riskColors.intercept.soft, glyph: '✕' },
  'not-requested': { main: neutral.textSecondary, soft: neutral.surfaceAlt, glyph: '–' },
  simulated: { main: brand.blue, soft: brand.blueSoft, glyph: '◐' },
};

// ── Bottom navigation ─────────────────────────────────────────────────────────
export type BottomNavTabKey = 'home' | 'activity' | 'protection' | 'contacts' | 'settings';

export const BOTTOM_NAV_TABS: readonly BottomNavTabKey[] = [
  'home',
  'activity',
  'protection',
  'contacts',
  'settings',
] as const;

/** Decorative glyphs — no vector-icon library is available in this project. */
export const BOTTOM_NAV_GLYPHS: Record<BottomNavTabKey, string> = {
  home: '⌂',
  activity: '≡',
  protection: '🛡',
  contacts: '☏',
  settings: '⚙',
};

// ── Transactions ──────────────────────────────────────────────────────────────
/**
 * Display shape for TransactionCard. Amount and timestamp arrive PRE-FORMATTED
 * (services/format.ts + i18n own locale formatting); `direction` drives the sign
 * and colour so the card never has to parse a string.
 */
export interface GuardPayTransaction {
  id: string;
  beneficiaryName: string;
  upiId?: string;
  /** Already localised, e.g. "₹5,000". */
  amountLabel: string;
  direction: 'debit' | 'credit';
  /** Already localised, e.g. "Today, 4:12 PM". */
  timestampLabel: string;
  riskScore?: number;
  tier?: RiskTierId;
  /** Optional already-translated status word, e.g. "Blocked". */
  statusLabel?: string;
}

export type { RiskTierId };
