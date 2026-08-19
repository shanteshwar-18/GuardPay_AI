/**
 * GuardPay AI — Navigation Types
 * Defines the full payment-flow route param contract.
 * Every screen that reads route.params must conform to these shapes.
 */

export type Beneficiary = {
  upiId: string;
  name: string;
  isNewBeneficiary: boolean;
};

export type RiskFactor = {
  factor: string;
  points: number;
};

export type RiskTier = 'ALLOWED' | 'WARNING' | 'ADAPTIVE_HOLD' | 'HARD_INTERCEPT';

export type RootStackParamList = {
  Home: undefined;
  Beneficiary: undefined;
  Amount: {
    beneficiary: Beneficiary;
  };
  RiskEval: {
    beneficiary: Beneficiary;
    amount: number;
    note?: string;
  };
  Pin: {
    beneficiary: Beneficiary;
    amount: number;
    riskScore: number;
    tier: RiskTier;
    explanation: RiskFactor[];
  };
  Warning: {
    beneficiary: Beneficiary;
    amount: number;
    riskScore: number;
    tier: RiskTier;
    explanation: RiskFactor[];
    transactionId?: string;
  };
  Hold: {
    beneficiary: Beneficiary;
    amount: number;
    riskScore: number;
    tier: RiskTier;
    explanation: RiskFactor[];
    transactionId?: string;
  };
  Intercept: {
    beneficiary: Beneficiary;
    amount: number;
    riskScore: number;
    tier: RiskTier;
    explanation: RiskFactor[];
    transactionId?: string;
  };
};
