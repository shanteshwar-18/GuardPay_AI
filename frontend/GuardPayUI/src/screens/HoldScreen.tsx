/**
 * GuardPay AI — HoldScreen (Stub)
 * Shown when Risk Score = 70–90 (ADAPTIVE_HOLD tier).
 *
 * Raghav is primary owner of this screen (Hold Screen + countdown timer).
 * This is a minimal stub so the navigation flow compiles and the
 * 3-demo-scenario system works end-to-end before Raghav's prompts run.
 *
 * TODO(Raghav): Replace this stub with the full Hold Screen implementation
 * from PromptBook Phase 3.3 (Raghav slice) — countdown timer, step-up
 * verification input, and evidence notice.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { formatINRCompact } from '../services/format';
import { NAVY, HOLD_RED, NEUTRAL_LIGHT, WHITE } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Hold'>;

export function HoldScreen({ route, navigation }: Props) {
  const { beneficiary, amount, riskScore } = route.params;
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <View style={styles.content}>
        <Text style={styles.icon}>⏳</Text>
        <Text style={styles.title}>Payment on Hold</Text>
        <Text style={styles.subtitle}>
          {formatINRCompact(amount)} to {beneficiary.name} — Risk {riskScore}
        </Text>
        <Text style={styles.note}>
          {/* TODO(Raghav): Add countdown timer + step-up verification here */}
          Cooling-off period active. Raghav's Hold Screen implementation coming soon.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.cancelBtnText}>Cancel Transaction</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: { fontSize: 60, marginBottom: 20 },
  title: { color: WHITE, fontSize: 24, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  subtitle: { color: NEUTRAL_LIGHT, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  note: { color: '#8FA3B1', fontSize: 13, textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  cancelBtn: { backgroundColor: HOLD_RED, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 32 },
  cancelBtnText: { color: WHITE, fontSize: 15, fontWeight: '700' },
});
