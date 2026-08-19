/**
 * GuardPay AI — AppNavigator
 * Full payment-flow navigation stack.
 * Route: Home → Beneficiary → Amount → RiskEval → Pin | Warning | Hold | Intercept
 *
 * SimulatedCallBanner is rendered as a shared header on every screen (demo overlay).
 */

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { RootStackParamList } from '../types/navigation';
import { SimulatedCallBanner } from '../components/SimulatedCallBanner';
import { NAVY } from '../theme/colors';

// Screen imports
import { HomeScreen } from '../screens/HomeScreen';
import { BeneficiaryScreen } from '../screens/BeneficiaryScreen';
import { AmountScreen } from '../screens/AmountScreen';
import { RiskEvalScreen } from '../screens/RiskEvalScreen';
import { PinScreen } from '../screens/PinScreen';
import { WarningScreen } from '../screens/WarningScreen';
import { InterceptScreen } from '../screens/InterceptScreen';
import { HoldScreen } from '../screens/HoldScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  // Toggle: false for Scenario A (green path), true for Scenario B/C (fraud scenarios)
  const [isCallActive, setIsCallActive] = useState(true);

  return (
    <NavigationContainer>
      <View style={styles.root}>
        {/* Fraud call overlay — visible on every screen during the demo */}
        <SimulatedCallBanner isCallActive={isCallActive} />

        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: NAVY },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Beneficiary" component={BeneficiaryScreen} />
          <Stack.Screen name="Amount" component={AmountScreen} />
          <Stack.Screen name="RiskEval" component={RiskEvalScreen} />
          <Stack.Screen name="Pin" component={PinScreen} />
          <Stack.Screen name="Warning" component={WarningScreen} />
          <Stack.Screen name="Hold" component={HoldScreen} />
          <Stack.Screen
            name="Intercept"
            component={InterceptScreen}
            options={{
              gestureEnabled: false, // No swipe-back from Intercept screen
            }}
          />
        </Stack.Navigator>
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: NAVY,
  },
});
