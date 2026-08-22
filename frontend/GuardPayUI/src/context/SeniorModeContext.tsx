/**
 * SeniorModeContext — Senior Citizen Mode State Management (GuardPayUI)
 * Persists isSeniorMode in AsyncStorage and exposes the 1.5× font scale
 * that every screen uses via the useScaledFont() hook.
 */

import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'guardpay:isSeniorMode';

/** Font multiplier applied to every screen when Senior Citizen Mode is on. */
export const SENIOR_FONT_SCALE = 1.5;
export const DEFAULT_FONT_SCALE = 1.0;

interface SeniorModeContextType {
  isSeniorMode: boolean;
  toggleSeniorMode: () => void;
  isLoading: boolean;
  /** 1.5 when senior mode is on, 1.0 otherwise. */
  fontScale: number;
  /** Scale a base font size by the active factor. */
  scaleFont: (size: number) => number;
}

export const SeniorModeContext = createContext<SeniorModeContextType>({
  isSeniorMode: false,
  toggleSeniorMode: () => {},
  isLoading: true,
  fontScale: DEFAULT_FONT_SCALE,
  scaleFont: (size: number) => size,
});

export function SeniorModeProvider({ children }: { children: ReactNode }) {
  const [isSeniorMode, setIsSeniorMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'true') {
          setIsSeniorMode(true);
        }
      } catch (err) {
        console.warn('[GuardPay] Senior mode hydration error:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const toggleSeniorMode = useCallback(async () => {
    try {
      const next = !isSeniorMode;
      setIsSeniorMode(next);
      await AsyncStorage.setItem(STORAGE_KEY, String(next));
    } catch (err) {
      console.warn('[GuardPay] Senior mode persist error:', err);
    }
  }, [isSeniorMode]);

  const fontScale = isSeniorMode ? SENIOR_FONT_SCALE : DEFAULT_FONT_SCALE;

  const scaleFont = useCallback(
    (size: number) => Math.round(size * fontScale),
    [fontScale]
  );

  return (
    <SeniorModeContext.Provider
      value={{ isSeniorMode, toggleSeniorMode, isLoading, fontScale, scaleFont }}
    >
      {children}
    </SeniorModeContext.Provider>
  );
}

export function useSeniorMode() {
  return useContext(SeniorModeContext);
}

/**
 * Convenience hook for screens: returns a `scaleFont(size)` function that
 * multiplies a base font size by 1.5 in Senior Citizen Mode, 1.0 otherwise.
 *
 * Usage:
 *   const sf = useScaledFont();
 *   <Text style={[styles.title, { fontSize: sf(22) }]}>…</Text>
 */
export function useScaledFont(): (size: number) => number {
  return useSeniorMode().scaleFont;
}
