/**
 * useFontScale — one place for Senior Citizen Mode text scaling (§25).
 *
 * Components take an OPTIONAL `fontScale` prop (matching the convention already
 * used by components/RiskFactorList.tsx). When the prop is omitted the value
 * falls back to SeniorModeContext, so a screen can either pass the scale down
 * explicitly or let the leaf read it. Outside the provider the context default
 * (1.0) applies, so these components stay safe in tests and storybook harnesses.
 */

import { useMemo } from 'react';
import { useSeniorMode } from '../../context/SeniorModeContext';

export interface FontScaling {
  /** Active multiplier: 1.5 in Senior Citizen Mode, 1.0 otherwise. */
  scale: number;
  /** Scale a base size from theme.typography. */
  sf: (size: number) => number;
  /** True when the 1.5× senior scale is in effect. */
  isEnlarged: boolean;
}

export function useFontScale(override?: number): FontScaling {
  const { fontScale } = useSeniorMode();
  const scale = override ?? fontScale;
  return useMemo(
    () => ({
      scale,
      sf: (size: number) => Math.round(size * scale),
      isEnlarged: scale > 1,
    }),
    [scale],
  );
}

export default useFontScale;
