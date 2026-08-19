/**
 * GuardPay AI — Mock Data Module
 * Used by all screens before backend integration is complete.
 * Replace TODO-marked items with live API calls as each backend endpoint comes online.
 */

import { Beneficiary } from '../types/navigation';

// ─── Account ────────────────────────────────────────────────────────────────

export const MOCK_BALANCE: number = 52430.75;

// ─── Recent Transactions ─────────────────────────────────────────────────────

export type MockTransaction = {
  id: string;
  name: string;
  upiId: string;
  amount: number;
  date: string;
  isDebit: boolean;
};

export const MOCK_RECENT_TRANSACTIONS: MockTransaction[] = [
  { id: 'txn1', name: 'Rahul Sharma', upiId: 'rahul@okaxis', amount: 1500, date: '19 Aug 2026', isDebit: true },
  { id: 'txn2', name: 'Amazon Pay', upiId: 'amazon@apl', amount: 3299, date: '18 Aug 2026', isDebit: true },
  { id: 'txn3', name: 'Priya Patel', upiId: 'priya@ybl', amount: 800, date: '17 Aug 2026', isDebit: false },
  { id: 'txn4', name: 'Swiggy', upiId: 'swiggy@icici', amount: 450, date: '16 Aug 2026', isDebit: true },
  { id: 'txn5', name: 'Ankit Verma', upiId: 'ankit@paytm', amount: 2000, date: '15 Aug 2026', isDebit: false },
];

// ─── Known Beneficiaries (Bloom-filter mock) ─────────────────────────────────
// TODO(Section 6 / Shanteshwar): Replace this mock list with a live call to
// the backend new-beneficiary endpoint (Bloom filter check).
// Match should be case-insensitive (normalise to lowercase before comparing).

export const MOCK_KNOWN_BENEFICIARIES: string[] = [
  'rahul@okaxis',
  'amazon@apl',
  'priya@ybl',
  'swiggy@icici',
  'ankit@paytm',
  'flipkart@fbl',
  'phonepe@ybl',
  'gpay@oksbi',
  'paytm@paytm',
  'zomato@icici',
];

// ─── Mock Resolved Payee Names ────────────────────────────────────────────────
// Simulates UPI ID → display name resolution before backend is wired.

export const MOCK_PAYEE_NAMES: Record<string, string> = {
  'rahul@okaxis': 'Rahul Sharma',
  'amazon@apl': 'Amazon Pay',
  'priya@ybl': 'Priya Patel',
  'swiggy@icici': 'Swiggy Food',
  'ankit@paytm': 'Ankit Verma',
  'flipkart@fbl': 'Flipkart',
  'phonepe@ybl': 'PhonePe',
  'gpay@oksbi': 'Google Pay',
  'paytm@paytm': 'Paytm',
  'zomato@icici': 'Zomato',
};

// ─── Supported Languages ──────────────────────────────────────────────────────

export type MockLanguage = {
  code: 'en' | 'hi' | 'mr' | 'ta';
  label: string;
  nativeLabel: string;
};

export const MOCK_LANGUAGES: MockLanguage[] = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिंदी' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
];
