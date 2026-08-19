/**
 * GuardPay AI — HomeScreen
 * Shows account balance, recent transactions, and "Send Money" CTA.
 * Represents the idle / low-risk entry point of the payment flow.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import {
  MOCK_BALANCE,
  MOCK_RECENT_TRANSACTIONS,
  MockTransaction,
} from '../mock/mockData';
import { formatINR, formatINRCompact } from '../services/format';
import {
  NAVY,
  NAVY_LIGHT,
  ALLOWED_GREEN,
  NEUTRAL_GRAY,
  NEUTRAL_LIGHT,
  WHITE,
  ERROR,
  SUCCESS,
} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const renderTransaction = ({ item }: { item: MockTransaction }) => (
    <View style={styles.txnRow} testID={`txn-${item.id}`}>
      <View style={styles.txnAvatar}>
        <Text style={styles.txnAvatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.txnDetails}>
        <Text style={styles.txnName}>{item.name}</Text>
        <Text style={styles.txnUpi}>{item.upiId}</Text>
        <Text style={styles.txnDate}>{item.date}</Text>
      </View>
      <Text style={[styles.txnAmount, { color: item.isDebit ? ERROR : SUCCESS }]}>
        {item.isDebit ? '−' : '+'}{formatINRCompact(item.amount)}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Account Balance</Text>
        <Text style={styles.balanceAmount} testID="balance-amount">
          {formatINR(MOCK_BALANCE)}
        </Text>
        <Text style={styles.accountMeta}>GuardPay Savings · ****4521</Text>
      </View>

      {/* Send Money CTA */}
      <TouchableOpacity
        testID="send-money-btn"
        style={styles.sendBtn}
        onPress={() => navigation.navigate('Beneficiary')}
        activeOpacity={0.85}
      >
        <Text style={styles.sendBtnText}>🔐  Send Money</Text>
      </TouchableOpacity>

      {/* Recent Transactions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <FlatList
          data={MOCK_RECENT_TRANSACTIONS}
          keyExtractor={item => item.id}
          renderItem={renderTransaction}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: NAVY,
  },
  balanceCard: {
    margin: 20,
    padding: 24,
    backgroundColor: NAVY_LIGHT,
    borderRadius: 18,
    shadowColor: ALLOWED_GREEN,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    alignItems: 'center',
  },
  balanceLabel: {
    color: NEUTRAL_GRAY,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  balanceAmount: {
    color: WHITE,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  accountMeta: {
    color: NEUTRAL_GRAY,
    fontSize: 12,
    marginTop: 6,
  },
  sendBtn: {
    marginHorizontal: 20,
    backgroundColor: ALLOWED_GREEN,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  sendBtnText: {
    color: NAVY,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    color: NEUTRAL_LIGHT,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  txnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  txnAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  txnAvatarText: {
    color: ALLOWED_GREEN,
    fontSize: 18,
    fontWeight: '700',
  },
  txnDetails: {
    flex: 1,
  },
  txnName: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  txnUpi: {
    color: NEUTRAL_GRAY,
    fontSize: 11,
    marginTop: 1,
  },
  txnDate: {
    color: NEUTRAL_GRAY,
    fontSize: 11,
    marginTop: 2,
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: NAVY_LIGHT,
  },
});
