/**
 * GuardPay AI — AppNavigator
 *
 * Final user flow (product spec §51):
 *   Splash -> Onboarding -> Permissions -> Home
 *   Home -> Payment -> RiskEval -> RiskDecision -> (Pin | TrustedContact | VerificationCode)
 *   RiskDecision routes are entirely data-driven from config/riskTiers.ts (§45) —
 *   this navigator does not encode tier behaviour itself.
 *
 * Legacy Beneficiary / Amount / Warning / Hold / Intercept routes stay registered
 * (spec: "do not remove an existing feature") so any code or test still targeting
 * them keeps resolving, but the flow above is what Home/Payment actually drive.
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/navigation';
import { SimulatedCallBanner } from '../components/SimulatedCallBanner';
import { SeniorModeBanner } from '../components/SeniorModeBanner';
import { EmergencyContactButton } from '../components/EmergencyContactButton';
import { neutral } from '../theme';

// ── Entry flow ──────────────────────────────────────────────────────────────
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { PermissionsScreen } from '../screens/PermissionsScreen';

// ── Main tabs ─────────────────────────────────────────────────────────────────
import { HomeScreen } from '../screens/HomeScreen';
import { ActivityScreen } from '../screens/ActivityScreen';
import { TransactionDetailScreen } from '../screens/TransactionDetailScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { TrustedContactsScreen } from '../screens/TrustedContactsScreen';

// ── Payment + risk flow ───────────────────────────────────────────────────────
import { PaymentScreen } from '../screens/PaymentScreen';
import { RiskEvalScreen } from '../screens/RiskEvalScreen';
import { RiskDecisionScreen } from '../screens/RiskDecisionScreen';
import { TrustedContactScreen } from '../screens/TrustedContactScreen';
import { VerificationCodeScreen } from '../screens/VerificationCodeScreen';
import { PinScreen } from '../screens/PinScreen';
import { PaymentSuccessScreen } from '../screens/PaymentSuccessScreen';

// ── Legacy (kept, not part of the primary flow) ───────────────────────────────
import { BeneficiaryScreen } from '../screens/BeneficiaryScreen';
import { AmountScreen } from '../screens/AmountScreen';
import { WarningScreen } from '../screens/WarningScreen';
import { HoldScreen } from '../screens/HoldScreen';
import { InterceptScreen } from '../screens/InterceptScreen';

import { ScreenshotHarness } from '../screens/__dev__/ScreenshotHarness';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  // Demo overlay toggle — true simulates an in-progress scam call across every
  // screen (product spec reference image scenarios). false for the plain flow.
  const [isCallActive, _setIsCallActive] = useState(false);

  return (
    <NavigationContainer>
      <View style={styles.root}>
        <SeniorModeBanner />
        <SimulatedCallBanner isCallActive={isCallActive} />

        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: neutral.bg },
            animation: 'slide_from_right',
          }}
        >
          {/* Entry flow */}
          <Stack.Screen name="Splash" component={SplashScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="Permissions" component={PermissionsScreen} />

          {/* Main tabs */}
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Activity" component={ActivityScreen} />
          <Stack.Screen name="TransactionDetail" component={TransactionDetailScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="TrustedContacts" component={TrustedContactsScreen} />

          {/* Payment + protected risk session */}
          <Stack.Screen name="Payment" component={PaymentScreen} />
          <Stack.Screen
            name="RiskEval"
            component={RiskEvalScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen
            name="RiskDecision"
            component={RiskDecisionScreen}
            options={{ gestureEnabled: false }}
          />
          <Stack.Screen name="TrustedContact" component={TrustedContactScreen} />
          <Stack.Screen name="VerificationCode" component={VerificationCodeScreen} />
          <Stack.Screen name="Pin" component={PinScreen} />
          <Stack.Screen
            name="PaymentSuccess"
            component={PaymentSuccessScreen}
            options={{ gestureEnabled: false }}
          />

          {/* Legacy routes — preserved, not reachable from the primary flow */}
          <Stack.Screen name="Beneficiary" component={BeneficiaryScreen} />
          <Stack.Screen name="Amount" component={AmountScreen} />
          <Stack.Screen name="Warning" component={WarningScreen} />
          <Stack.Screen name="Hold" component={HoldScreen} />
          <Stack.Screen
            name="Intercept"
            component={InterceptScreen}
            options={{ gestureEnabled: false }}
          />

          {__DEV__ && (
            <Stack.Screen name="ScreenshotHarness" component={ScreenshotHarness} />
          )}
        </Stack.Navigator>

        <EmergencyContactButton />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: neutral.bg,
  },
});
