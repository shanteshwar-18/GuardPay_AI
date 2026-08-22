/**
 * GuardPay AI — component library barrel.
 *
 * Screens should import from '../components/guardpay' rather than reaching into
 * individual files, so the library's internal layout can change without a
 * project-wide find-and-replace.
 */

// ── Primitives ────────────────────────────────────────────────────────────────
export { AppHeader } from './AppHeader';
export type { AppHeaderProps } from './AppHeader';

export { Card } from './Card';
export type { CardProps, CardTone } from './Card';

export { EmptyState } from './EmptyState';
export type { EmptyStateProps } from './EmptyState';

export { GuardPayLogo } from './GuardPayLogo';
export type { GuardPayLogoProps, LogoSize, LogoVariant } from './GuardPayLogo';

export { OtpInput } from './OtpInput';
export type { OtpInputProps } from './OtpInput';

export { PrimaryButton } from './PrimaryButton';
export type { PrimaryButtonProps } from './PrimaryButton';

export { ScreenContainer } from './ScreenContainer';
export type { ScreenBackground, ScreenContainerProps } from './ScreenContainer';

export { SecondaryButton } from './SecondaryButton';
export type { SecondaryButtonProps, SecondaryButtonVariant } from './SecondaryButton';

export { SecurityAlert } from './SecurityAlert';
export type { SecurityAlertProps, SecurityAlertTone } from './SecurityAlert';

export { ShieldGlyph, AnimatedShieldWrap } from './ShieldGlyph';
export type { ShieldGlyphProps } from './ShieldGlyph';

// ── Navigation ────────────────────────────────────────────────────────────────
export { BottomNavigation } from './BottomNavigation';
export type { BottomNavigationProps } from './BottomNavigation';

// ── Risk / decision ───────────────────────────────────────────────────────────
export { RiskGauge } from './RiskGauge';
export type { RiskGaugeProps } from './RiskGauge';

export { RiskTierBadge } from './RiskTierBadge';
export type { RiskTierBadgeProps, RiskTierBadgeSize } from './RiskTierBadge';

export { RiskFactorRow } from './RiskFactorRow';
export type { RiskFactorRowProps } from './RiskFactorRow';

export { WhatWeCheckedList } from './WhatWeCheckedList';
export type { WhatWeCheckedFactor, WhatWeCheckedListProps } from './WhatWeCheckedList';

export { ProtectionSessionIndicator } from './ProtectionSessionIndicator';
export type {
  ProtectionSessionIndicatorProps,
  ProtectionSessionState,
} from './ProtectionSessionIndicator';

// ── Domain cards ──────────────────────────────────────────────────────────────
export { SecurityStatusCard } from './SecurityStatusCard';
export type { SecurityStatusCardProps } from './SecurityStatusCard';

export { BeneficiaryCard } from './BeneficiaryCard';
export type { BeneficiaryCardProps } from './BeneficiaryCard';

export { TransactionCard } from './TransactionCard';
export type { TransactionCardProps } from './TransactionCard';

export { PermissionCard } from './PermissionCard';
export type { PermissionCardProps } from './PermissionCard';

export { TrustedContactCard } from './TrustedContactCard';
export type { TrustedContactCardProps } from './TrustedContactCard';

// ── Shared helpers ────────────────────────────────────────────────────────────
export { useFontScale } from './useFontScale';
export type { FontScaling } from './useFontScale';

export {
  SEVERITY_COLORS,
  SEVERITY_GLYPHS,
  severityForPoints,
  ALERT_TONES,
  BUTTON_TONES,
  BOTTOM_NAV_TABS,
  BOTTOM_NAV_GLYPHS,
} from './types';
export type { FactorSeverity, AlertTone, ButtonTone, BottomNavTabKey } from './types';
