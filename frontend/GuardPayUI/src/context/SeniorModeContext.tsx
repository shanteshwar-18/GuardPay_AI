/**
 * SeniorModeContext — Senior Citizen Mode State Management (GuardPayUI)
 * Persists isSeniorMode state in AsyncStorage with 1.5x font scaling.
 */

import React, { createContext, useState, useEffect, useCallback, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'guardpay:isSeniorMode';

interface SeniorModeContextType {
  isSeniorMode: boolean;
  toggleSeniorMode: () => void;
  isLoading: boolean;
}

export const SeniorModeContext = createContext<SeniorModeContextType>({
  isSeniorMode: false,
  toggleSeniorMode: () => {},
  isLoading: true,
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

  return (
    <SeniorModeContext.Provider value={{ isSeniorMode, toggleSeniorMode, isLoading }}>
      {children}
    </SeniorModeContext.Provider>
  );
}

export function useSeniorMode() {
  return useContext(SeniorModeContext);
}
