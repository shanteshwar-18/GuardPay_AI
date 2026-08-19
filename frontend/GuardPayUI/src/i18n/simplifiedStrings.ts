/**
 * Simplified Strings — Senior Citizen Mode (GuardPayUI)
 * Plain-language translations for machine-learning SHAP outputs.
 */

const SIMPLIFIED_MAP: Record<string, string> = {
  // Specific Coercion / Scams (checked first)
  'arrest warrant': 'The caller mentioned arrest — this is a common scam tactic',
  'account freeze notice': 'A fake "Account Freeze" notice was shown to you',
  'account freeze': 'The caller is threatening to freeze your account',
  'aadhaar': 'The caller mentioned your Aadhaar — be very careful',
  'immediate transfer': 'You are being pressured to send money immediately',
  'coercive language': 'The caller is using threatening or pressuring language',
  'coercive transcript': 'Threatening words were detected in the conversation',

  // Voice
  'ai voice clone': 'The voice on this call may be computer-generated',
  'voice clone detected': 'This voice may not be from a real person',
  'voice anomaly': "Something sounds different about this caller's voice",
  'spoof': 'The voice sounds artificially created',

  // OCR
  'fake document': 'A fake official document was detected',
  'ocr': 'A suspicious document or notice was detected on screen',

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

export function simplifyExplanation(raw: string): string {
  const lowerRaw = raw.toLowerCase();
  for (const [pattern, simplified] of Object.entries(SIMPLIFIED_MAP)) {
    if (lowerRaw.includes(pattern)) {
      return simplified;
    }
  }
  return raw;
}
