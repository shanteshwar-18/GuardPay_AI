import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { SeniorModeProvider, useSeniorMode } from './src/context/SeniorModeContext';
import SeniorModeBanner from './src/components/SeniorModeBanner';
import EmergencyContactButton from './src/components/EmergencyContactButton';
import config from './src/config';

function AppContent() {
  const { isLoading } = useSeniorMode();

  // Show splash while hydrating senior mode from AsyncStorage
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </View>
    );
  }

  // Log config on launch to verify env contract (Prompt 1 checkpoint)
  console.log('[GuardPay] Config loaded:', config);

  return (
    <View style={styles.wrapper}>
      {/* Senior Mode Banner — root level, persists across all screens */}
      <SeniorModeBanner />

      <View style={styles.container}>
        <Text style={styles.title}>🛡️ GuardPay AI</Text>
        <Text style={styles.subtitle}>Real-Time UPI Fraud Intervention Engine</Text>
        <Text style={styles.info}>API: {config.API_BASE_URL}</Text>
        <Text style={styles.info}>WS: {config.WS_BASE_URL}</Text>
        <Text style={styles.info}>Language: {config.DEFAULT_LANGUAGE}</Text>
        <Text style={styles.info}>Senior Mode: {config.SENIOR_MODE_DEFAULT ? 'ON' : 'OFF'}</Text>
        <StatusBar style="light" />
      </View>

      {/* Emergency Contact — root level, visible when senior mode active */}
      <EmergencyContactButton />
    </View>
  );
}

export default function App() {
  return (
    <SeniorModeProvider>
      <AppContent />
    </SeniorModeProvider>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#8B8BA3',
    marginBottom: 32,
    textAlign: 'center',
  },
  info: {
    fontSize: 12,
    color: '#4ADE80',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
