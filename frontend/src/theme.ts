/**
 * GuardPay AI — Design System Theme
 *
 * Centralised theme tokens for the entire frontend.
 * All risk-tier colours, typography, spacing, and the
 * useScaledFontSize hook for Senior Citizen Mode live here.
 */

import { useContext } from 'react';

/**
 * Risk-tier colour palette — used by every outcome screen.
 * Exported as constants so PINScreen, WarningScreen, HoldScreen,
 * and InterceptScreen all reference the same palette.
 */
export const TIER_COLORS = {
  ALLOWED: '#22C55E',           // Green — no friction
  WARNING: '#F59E0B',           // Amber — caution
  ADAPTIVE_HOLD: '#EF4444',     // Orange-red — elevated
  HARD_INTERCEPT: '#DC2626',    // Red — hard block
} as const;

/** Background tints for each tier's card/screen */
export const TIER_BG = {
  ALLOWED: '#0D2818',           // Dark green tint
  WARNING: '#2D1F05',           // Dark amber tint
  ADAPTIVE_HOLD: '#2D0A0A',    // Dark red tint
  HARD_INTERCEPT: '#1A0000',   // Deep red
} as const;

/** Core colour palette */
export const colors = {
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceLight: '#252540',
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  text: '#FFFFFF',
  textSecondary: '#8B8BA3',
  textMuted: '#5A5A7A',
  success: '#4ADE80',
  warning: '#F59E0B',
  danger: '#EF4444',
  dangerDark: '#DC2626',
  seniorBanner: '#FBBF24',
  border: '#2A2A4A',
} as const;

/** Typography scale */
export const typography = {
  h1: 28,
  h2: 22,
  h3: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  tiny: 10,
} as const;

/** Spacing scale */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

/** Border radius scale */
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/**
 * Hook: useScaledFontSize
 *
 * Returns base * 1.5 when Senior Citizen Mode is active, base otherwise.
 * Reads isSeniorMode from SeniorModeContext.
 */
export function useScaledFontSize(base: number): number {
  try {
    const { SeniorModeContext } = require('./context/SeniorModeContext');
    const context = useContext(SeniorModeContext);
    if (context?.isSeniorMode) {
      return base * 1.5;
    }
  } catch {
    // Context not available — return base
  }
  return base;
}

