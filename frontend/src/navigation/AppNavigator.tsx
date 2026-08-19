/**
 * GuardPay AI — App Navigator
 *
 * Stack navigator routing based on RiskScoreResponse:
 *
 *   score < 40  → PINScreen (ALLOWED)
 *   score 40–70 → WarningScreen (WARNING)
 *   score 70–90 → HoldScreen (ADAPTIVE_HOLD)
 *   score > 90  → InterceptScreen (HARD_INTERCEPT)
 *
 * Screens pass riskResponse via route.params.
 * RiskEvalScreen is the routing hub — it calls the API and navigates.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';

// Screen imports
import HomeScreen from '../screens/HomeScreen';
import RiskEvalScreen from '../screens/RiskEvalScreen';
import PINScreen from '../screens/PINScreen';
import WarningScreen from '../screens/WarningScreen';
import HoldScreen from '../screens/HoldScreen';
import InterceptScreen from '../screens/InterceptScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SuccessScreen from '../screens/SuccessScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Home"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0F0F1A' },
      }}
    >
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="RiskEval" component={RiskEvalScreen} />
      <Stack.Screen name="PIN" component={PINScreen} />
      <Stack.Screen name="Warning" component={WarningScreen} />
      <Stack.Screen name="Hold" component={HoldScreen} />
      <Stack.Screen name="Intercept" component={InterceptScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Success" component={SuccessScreen} />
    </Stack.Navigator>
  );
}
