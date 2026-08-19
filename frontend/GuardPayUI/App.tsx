/**
 * GuardPay AI — App Entry Point
 * Bootstraps i18n, wraps the app in LanguageProvider & SeniorModeProvider, and renders AppNavigator.
 */

import React from 'react';
import { StatusBar } from 'react-native';
import './src/i18n'; // Init i18next before any screens render
import { LanguageProvider } from './src/services/languageState';
import { SeniorModeProvider } from './src/context/SeniorModeContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { NAVY } from './src/theme/colors';

export default function App() {
  return (
    <SeniorModeProvider>
      <LanguageProvider>
        <StatusBar barStyle="light-content" backgroundColor={NAVY} />
        <AppNavigator />
      </LanguageProvider>
    </SeniorModeProvider>
  );
}
