/**
 * Simplified Strings — Senior Citizen Mode
 *
 * Plain-language versions of SHAP explanation strings.
 * When isSeniorMode is true, WarningScreen and HoldScreen render
 * from this dictionary instead of raw backend factor strings.
 *
 * Maps backend factor keys to simplified, non-technical sentences.
 * Falls back to the raw string if a key has no simplified entry.
 */

/** Map of raw SHAP-style explanation patterns to simplified text */
const SIMPLIFIED_MAP: Record<string, string> = {
  // Voice-related
  'voice anomaly': "Something sounds different about this caller's voice",
  'ai voice clone': 'The voice on this call may be computer-generated',
  'voice clone detected': 'This voice may not be from a real person',
  'spoof': 'The voice sounds artificially created',

  // Coercion / NLP
  'coercive language': 'The caller is using threatening or pressuring language',
  'coercive transcript': 'Threatening words were detected in the conversation',
  'arrest warrant': 'The caller mentioned arrest — this is a common scam tactic',
  'account freeze': 'The caller is threatening to freeze your account',
  'aadhaar': 'The caller mentioned your Aadhaar — be very careful',
  'immediate transfer': 'You are being pressured to send money immediately',

  // OCR
  'ocr': 'A suspicious document or notice was detected on screen',
  'account freeze notice': 'A fake "Account Freeze" notice was shown to you',
  'fake document': 'A fake official document was detected',

  // Beneficiary
  'new beneficiary': 'You have never sent money to this person before',
  'first-time payee': 'This is the first time you are paying this person',

  // Device behaviour
  'device behaviour': 'Your phone is being used in an unusual way',
  'screen share': 'Someone may be watching your screen remotely',
  'app switch blocked': 'An app is preventing you from switching away',

  // Reputation
  'reputation': 'This account has been reported by other users',
  'complaint': 'Other people have complained about this account',
  'flagged': 'This account has been flagged for suspicious activity',
};

/**
 * Convert a raw SHAP explanation string to simplified senior-friendly text.
 * Falls back to the raw string if no match is found.
 */
export function simplifyExplanation(raw: string): string {
  const lowerRaw = raw.toLowerCase();

  for (const [pattern, simplified] of Object.entries(SIMPLIFIED_MAP)) {
    if (lowerRaw.includes(pattern)) {
      return simplified;
    }
  }

  // No match — return raw string as-is
  return raw;
}

/**
 * Convert an array of SHAP explanation strings to simplified versions.
 */
export function simplifyExplanations(explanations: string[]): string[] {
  return explanations.map(simplifyExplanation);
}
