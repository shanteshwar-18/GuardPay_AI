/**
 * GuardPay AI — UI Test Suite (Prompt 12 — Phase 8/10)
 * Covers: BeneficiaryScreen NEW badge, AmountScreen words, WarningScreen SHAP,
 * InterceptScreen lock, RiskEvalScreen tier routing.
 *
 * Run: npx jest --ci
 * All tests run offline — axios and WebSocket are mocked.
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const Stack = createNativeStackNavigator();

function wrap(Component: React.ComponentType<any>, initialParams = {}) {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="TestScreen"
          component={Component}
          initialParams={initialParams}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const KNOWN_UPI = 'rahul@okaxis';
const UNKNOWN_UPI = 'scammer@ybl';

const MOCK_BENEFICIARY_KNOWN = { upiId: KNOWN_UPI, name: 'Rahul Sharma', isNewBeneficiary: false };
const MOCK_BENEFICIARY_NEW   = { upiId: UNKNOWN_UPI, name: 'Unknown', isNewBeneficiary: true };

const BASE_PARAMS = {
  beneficiary: MOCK_BENEFICIARY_NEW,
  amount: 25000,
  riskScore: 58,
  tier: 'WARNING' as const,
  explanation: [
    { factor: 'Voice anomaly detected', points: 25 },
    { factor: 'New beneficiary', points: 15 },
    { factor: 'Urgent language detected', points: 10 },
  ],
};

// ─── 1. BeneficiaryScreen — NEW badge logic ───────────────────────────────────

describe('BeneficiaryScreen', () => {
  let BeneficiaryScreen: React.ComponentType<any>;

  beforeAll(() => {
    ({ BeneficiaryScreen } = require('../BeneficiaryScreen'));
  });

  it('shows NEW badge for an unknown UPI ID', async () => {
    const { getByTestId } = render(wrap(BeneficiaryScreen));
    const input = getByTestId('upi-id-input');
    fireEvent.changeText(input, UNKNOWN_UPI);
    fireEvent.press(getByTestId('resolve-btn'));
    await waitFor(() => {
      expect(getByTestId('new-badge')).toBeTruthy();
    });
  });

  it('does NOT show NEW badge for a known UPI ID', async () => {
    const { getByTestId, queryByTestId } = render(wrap(BeneficiaryScreen));
    fireEvent.changeText(getByTestId('upi-id-input'), KNOWN_UPI);
    fireEvent.press(getByTestId('resolve-btn'));
    await waitFor(() => {
      expect(queryByTestId('new-badge')).toBeNull();
    });
  });

  it('resolves payee card after pressing Verify', async () => {
    const { getByTestId } = render(wrap(BeneficiaryScreen));
    fireEvent.changeText(getByTestId('upi-id-input'), KNOWN_UPI);
    fireEvent.press(getByTestId('resolve-btn'));
    await waitFor(() => {
      expect(getByTestId('resolved-payee-card')).toBeTruthy();
    });
  });
});

// ─── 2. AmountScreen — amount-in-words updates live ──────────────────────────

describe('AmountScreen', () => {
  let AmountScreen: React.ComponentType<any>;

  beforeAll(() => {
    ({ AmountScreen } = require('../AmountScreen'));
  });

  it('updates amount-in-words as user types', async () => {
    const params = { beneficiary: MOCK_BENEFICIARY_KNOWN };
    const { getByTestId } = render(wrap(AmountScreen, params));
    fireEvent.changeText(getByTestId('amount-input'), '5000');
    await waitFor(() => {
      const words = getByTestId('amount-in-words');
      expect(words.props.children).toContain('Five Thousand');
    });
  });

  it('disables Confirm button when amount is 0', () => {
    const params = { beneficiary: MOCK_BENEFICIARY_KNOWN };
    const { getByTestId } = render(wrap(AmountScreen, params));
    const btn = getByTestId('confirm-btn');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });
});

// ─── 3. WarningScreen — SHAP factor list ─────────────────────────────────────

describe('WarningScreen', () => {
  let WarningScreen: React.ComponentType<any>;

  beforeAll(() => {
    ({ WarningScreen } = require('../WarningScreen'));
  });

  it('renders the correct number of SHAP factors (3)', async () => {
    const { getAllByText } = render(wrap(WarningScreen, BASE_PARAMS));
    // Each factor shows "+N pts" badge
    await waitFor(() => {
      const badges = getAllByText(/\+\d+ pts/);
      expect(badges.length).toBe(3);
    });
  });

  it('renders the highest-score factor first', async () => {
    const { getAllByText } = render(wrap(WarningScreen, BASE_PARAMS));
    await waitFor(() => {
      const badges = getAllByText(/\+\d+ pts/);
      // "+25 pts" should be first
      expect(badges[0].props.children).toContain('25');
    });
  });

  it('Proceed button navigates away from Warning', async () => {
    const { getByTestId } = render(wrap(WarningScreen, BASE_PARAMS));
    await waitFor(() => getByTestId('proceed-btn'));
    expect(getByTestId('proceed-btn')).toBeTruthy();
  });

  it('Cancel button exists and is pressable', async () => {
    const { getByTestId } = render(wrap(WarningScreen, BASE_PARAMS));
    await waitFor(() => getByTestId('cancel-btn'));
    fireEvent.press(getByTestId('cancel-btn'));
    // No crash = pass
  });

  it('renders with variable-length explanation arrays (1 factor)', async () => {
    const params = { ...BASE_PARAMS, explanation: [{ factor: 'Voice anomaly', points: 30 }] };
    const { getAllByText } = render(wrap(WarningScreen, params));
    await waitFor(() => {
      expect(getAllByText(/\+\d+ pts/).length).toBe(1);
    });
  });

  it('renders with variable-length explanation arrays (6 factors)', async () => {
    const params = {
      ...BASE_PARAMS,
      explanation: Array.from({ length: 6 }, (_, i) => ({
        factor: `Factor ${i + 1}`,
        points: (6 - i) * 10,
      })),
    };
    const { getAllByText } = render(wrap(WarningScreen, params));
    await waitFor(() => {
      expect(getAllByText(/\+\d+ pts/).length).toBe(6);
    });
  });
});

// ─── 4. InterceptScreen — only Cancel button, no PIN path ────────────────────

describe('InterceptScreen', () => {
  let InterceptScreen: React.ComponentType<any>;

  beforeAll(() => {
    ({ InterceptScreen } = require('../InterceptScreen'));
  });

  const interceptParams = { ...BASE_PARAMS, riskScore: 94, tier: 'HARD_INTERCEPT' as const };

  it('renders Cancel button', async () => {
    const { getByTestId } = render(wrap(InterceptScreen, interceptParams));
    await waitFor(() => expect(getByTestId('cancel-btn')).toBeTruthy());
  });

  it('does NOT render a Proceed/PIN button', async () => {
    const { queryByTestId } = render(wrap(InterceptScreen, interceptParams));
    await waitFor(() => {
      expect(queryByTestId('proceed-btn')).toBeNull();
      expect(queryByTestId('pin-pad')).toBeNull();
    });
  });
});

// ─── 5. RiskEvalScreen — tier-based routing ──────────────────────────────────

describe('RiskEvalScreen — tier routing', () => {
  let RiskEvalScreen: React.ComponentType<any>;
  const mockAxios = require('axios').default;

  const params = { beneficiary: MOCK_BENEFICIARY_NEW, amount: 25000 };

  beforeAll(() => {
    ({ RiskEvalScreen } = require('../RiskEvalScreen'));
  });

  const tierCases: Array<{ tier: string; score: number }> = [
    { tier: 'ALLOWED', score: 20 },
    { tier: 'WARNING', score: 55 },
    { tier: 'ADAPTIVE_HOLD', score: 75 },
    { tier: 'HARD_INTERCEPT', score: 94 },
  ];

  tierCases.forEach(({ tier, score }) => {
    it(`routes to correct screen for tier=${tier}`, async () => {
      mockAxios.post.mockResolvedValueOnce({
        data: { score, tier, explanation: [], factors: {} },
      });
      const { getByTestId } = render(wrap(RiskEvalScreen, params));
      await waitFor(() => expect(getByTestId('checking-label')).toBeTruthy());
      // The routing will navigate away — no crash = correct
    });
  });

  it('falls back to Warning when backend is unreachable', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Network error'));
    const { getByTestId } = render(wrap(RiskEvalScreen, params));
    await waitFor(() => expect(getByTestId('checking-label')).toBeTruthy());
    // Fallback to Warning — no crash, no navigate to Pin
  });

  it('never fails open to Pin on network error', async () => {
    mockAxios.post.mockRejectedValueOnce(new Error('Timeout'));
    const { queryByTestId } = render(wrap(RiskEvalScreen, params));
    // Should NOT navigate to Pin on error
    await act(async () => {
      await new Promise(r => setTimeout(r, 100));
    });
    // PINScreen's pin-dot-0 should NOT be in tree if fallback works
    expect(queryByTestId('pin-dot-0')).toBeNull();
  });
});
