/**
 * GuardPay AI — Risk-Tier Colour Palette
 * Every risk-tier screen imports from here so colours stay consistent.
 */

// Risk tier colours
export const ALLOWED_GREEN = '#00C853';   // Risk < 40 — safe, no friction
export const WARNING_AMBER = '#FF8F00';   // Risk 40–70 — warning state
export const HOLD_RED = '#D32F2F';        // Risk 70–90 — adaptive hold
export const INTERCEPT_RED = '#B71C1C';   // Risk > 90 — hard intercept lock

// Brand / UI colours
export const NAVY = '#0D1B2A';            // Primary background
export const NAVY_LIGHT = '#1A2E45';      // Secondary background / cards
export const NEUTRAL_GRAY = '#8FA3B1';    // Muted text, borders
export const NEUTRAL_LIGHT = '#E8EDF2';   // Light background surfaces
export const WHITE = '#FFFFFF';
export const BLACK = '#000000';

// Status / semantic colours
export const SUCCESS = '#00E676';
export const ERROR = '#FF1744';
export const INFO = '#29B6F6';

// Risk gauge bands
export const GAUGE_SAFE = ALLOWED_GREEN;
export const GAUGE_WARN = WARNING_AMBER;
export const GAUGE_HOLD = HOLD_RED;
export const GAUGE_INTERCEPT = INTERCEPT_RED;
