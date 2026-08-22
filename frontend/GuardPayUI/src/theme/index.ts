/**
 * GuardPay AI — Design System
 *
 * Single source of truth for colour, spacing, radius, typography and elevation.
 * Screens must not hardcode hex values or magic numbers; import from here so the
 * app reads as one product rather than a collection of prototype screens.
 *
 * Visual direction (per product spec §4): premium consumer fintech — light
 * surfaces, deep navy brand, blue gradient accents, generous spacing, rounded
 * cards, soft shadows. Not an admin dashboard.
 */

// ── Brand ─────────────────────────────────────────────────────────────────────
export const brand = {
  navy: '#0A2540',          // primary brand / splash background
  navyDeep: '#061829',      // gradient end, darkest surface
  navySoft: '#12365C',      // raised navy surface
  blue: '#1B62F0',          // primary action
  blueDark: '#0F49C4',      // pressed state
  blueSoft: '#E8F0FE',      // tinted background for blue accents
  blueMid: '#4A8CFF',       // gradient partner for `blue`
} as const;

// ── Risk semantics ────────────────────────────────────────────────────────────
// One colour per tier, plus a soft tint for card backgrounds and a border tone.
export const risk = {
  safe:      { main: '#0FA958', soft: '#E6F7EE', border: '#9BE0BC', dark: '#0A7A40' },
  warning:   { main: '#F59E0B', soft: '#FEF4E3', border: '#F8D48A', dark: '#B87503' },
  hold:      { main: '#F4623A', soft: '#FDECE7', border: '#F9BCA9', dark: '#C4431F' },
  intercept: { main: '#DC2626', soft: '#FDEAEA', border: '#F5A9A9', dark: '#A11616' },
} as const;

// ── Neutrals ──────────────────────────────────────────────────────────────────
export const neutral = {
  white: '#FFFFFF',
  bg: '#F6F8FB',            // app background
  surface: '#FFFFFF',       // card surface
  surfaceAlt: '#F0F4F9',    // subtle alternate surface
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',
  black: '#000000',
} as const;

// ── Status (non-risk) ─────────────────────────────────────────────────────────
export const status = {
  success: risk.safe.main,
  error: risk.intercept.main,
  info: brand.blue,
  seniorBanner: '#FBBF24',
  liveCall: '#C2181B',
} as const;

// ── Spacing (4pt grid) ────────────────────────────────────────────────────────
export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32, huge: 40,
} as const;

// ── Radius ────────────────────────────────────────────────────────────────────
export const radius = {
  sm: 8, md: 12, lg: 16, xl: 20, xxl: 28, pill: 999,
} as const;

// ── Typography ────────────────────────────────────────────────────────────────
// Base sizes; Senior Citizen Mode multiplies these via scaleFont().
export const typography = {
  display: { size: 32, weight: '700' as const, lineHeight: 40 },
  h1:      { size: 26, weight: '700' as const, lineHeight: 34 },
  h2:      { size: 21, weight: '700' as const, lineHeight: 28 },
  h3:      { size: 18, weight: '600' as const, lineHeight: 24 },
  body:    { size: 15, weight: '400' as const, lineHeight: 22 },
  bodyBold:{ size: 15, weight: '600' as const, lineHeight: 22 },
  caption: { size: 13, weight: '400' as const, lineHeight: 18 },
  tiny:    { size: 11, weight: '500' as const, lineHeight: 15 },
  amount:  { size: 34, weight: '700' as const, lineHeight: 42 },
} as const;

// ── Elevation ─────────────────────────────────────────────────────────────────
// Android uses `elevation`; iOS uses the shadow* family. Both are set so cards
// render consistently on either platform.
export const elevation = {
  none: {},
  sm: {
    elevation: 2,
    shadowColor: '#0A2540',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  md: {
    elevation: 4,
    shadowColor: '#0A2540',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  lg: {
    elevation: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.14,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
} as const;

// ── Control sizing (consistent button heights / touch targets, §4 + §48) ──────
export const control = {
  buttonHeight: 54,
  buttonHeightSm: 44,
  inputHeight: 54,
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  minTouch: 44,     // accessibility minimum
} as const;

export const theme = {
  brand, risk, neutral, status, spacing, radius, typography, elevation, control,
};

export default theme;
