/**
 * GuardPay AI — Root App Component
 *
 * Wraps the app with:
 * 1. SeniorModeProvider (AsyncStorage-persisted state)
 * 2. NavigationContainer
 * 3. SeniorModeBanner (top of every screen)
 * 4. EmergencyContactButton (bottom-right FAB when senior mode active)
 */

import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { SeniorModeProvider, useSeniorMode } from './src/context/SeniorModeContext';
import SeniorModeBanner from './src/components/SeniorModeBanner';
import EmergencyContactButton from './src/components/EmergencyContactButton';
import AppNavigator from './src/navigation/AppNavigator';

function AppContent() {
  const { isLoading } = useSeniorMode();

  // Show splash while hydrating senior mode from AsyncStorage
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.wrapper} edges={['top', 'left', 'right']}>
      {/* Senior Mode Banner — root level */}
      <SeniorModeBanner />

      {/* Main Navigation */}
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>

      {/* Emergency Contact FAB — visible when senior mode active */}
      <EmergencyContactButton />

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SeniorModeProvider>
        <AppContent />
      </SeniorModeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  loading: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
