/**
 * SeniorModeContext — Senior Citizen Mode State Management
 *
 * Provides { isSeniorMode, toggleSeniorMode } to the entire app.
 * Persists the value to AsyncStorage under 'guardpay:isSeniorMode'.
 * Hydrates on app launch before the first screen renders.
 */

import React, {
  createContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'guardpay:isSeniorMode';

interface SeniorModeContextType {
  isSeniorMode: boolean;
  toggleSeniorMode: () => void;
  /** True while hydrating from AsyncStorage on app launch */
  isLoading: boolean;
}

export const SeniorModeContext = createContext<SeniorModeContextType>({
  isSeniorMode: false,
  toggleSeniorMode: () => {},
  isLoading: true,
});

interface SeniorModeProviderProps {
  children: ReactNode;
}

export function SeniorModeProvider({ children }: SeniorModeProviderProps) {
  const [isSeniorMode, setIsSeniorMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate from AsyncStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'true') {
          setIsSeniorMode(true);
        }
      } catch (error) {
        console.warn('[GuardPay] Failed to hydrate senior mode:', error);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Toggle and persist
  const toggleSeniorMode = useCallback(async () => {
    try {
      const newValue = !isSeniorMode;
      setIsSeniorMode(newValue);
      await AsyncStorage.setItem(STORAGE_KEY, String(newValue));
    } catch (error) {
      console.warn('[GuardPay] Failed to persist senior mode:', error);
    }
  }, [isSeniorMode]);

  return (
    <SeniorModeContext.Provider
      value={{ isSeniorMode, toggleSeniorMode, isLoading }}
    >
      {children}
    </SeniorModeContext.Provider>
  );
}

/**
 * Hook: useSeniorMode
 *
 * Convenience hook to access the SeniorModeContext.
 */
export function useSeniorMode(): SeniorModeContextType {
  const context = React.useContext(SeniorModeContext);
  return context;
}
