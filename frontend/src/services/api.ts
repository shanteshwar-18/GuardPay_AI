/**
 * GuardPay AI — API Service
 *
 * Centralised HTTP client for backend API calls.
 * All screens use this instead of direct fetch/axios calls.
 */

import config from '../config';
import { RiskScoreResponse, SessionStatus } from '../types';

/**
 * Call the risk score endpoint.
 * POST /api/v1/risk-score
 */
export async function evaluateRisk(params: {
  upi_id: string;
  amount: number;
  is_new_beneficiary: boolean;
  audio_buffer_b64?: string;
  ocr_text?: string;
  device_signals?: Record<string, number | boolean>;
}): Promise<RiskScoreResponse> {
  const response = await fetch(`${config.API_BASE_URL}/api/v1/risk-score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Risk score API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Poll session status for InterceptScreen.
 * GET /api/v1/session/{txn_id}/status
 */
export async function getSessionStatus(
  transactionId: string
): Promise<SessionStatus> {
  try {
    const response = await fetch(
      `${config.API_BASE_URL}/api/v1/session/${transactionId}/status`
    );

    if (!response.ok) {
      throw new Error(`Session status API error: ${response.status}`);
    }

    const data = await response.json();
    return data.status as SessionStatus;
  } catch (error) {
    // If backend is unreachable, return current state without crashing
    console.warn('[GuardPay API] Session status poll failed:', error);
    throw error;
  }
}
