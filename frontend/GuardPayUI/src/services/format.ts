/**
 * GuardPay AI — Formatting Utilities
 * Currency formatting (INR) and amount-in-words helpers.
 * Used by HomeScreen, AmountScreen, PINScreen, and all risk-response screens.
 */

// ─── Currency Formatting ──────────────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

/**
 * Format a number as INR currency string.
 * e.g. 5000 → "₹5,000.00"
 */
export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}

/**
 * Format a number as a compact INR string without decimals for display.
 * e.g. 5000 → "₹5,000"
 */
export function formatINRCompact(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ─── Amount-in-Words ──────────────────────────────────────────────────────────

const ones = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numToWordsBelow100(n: number): string {
  if (n < 20) return ones[n];
  return (tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '')).trim();
}

function numToWordsIndian(n: number): string {
  if (n === 0) return 'Zero';
  if (n < 0) return 'Minus ' + numToWordsIndian(-n);

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const hundred = Math.floor(n / 100);
  n %= 100;

  if (crore) parts.push(numToWordsBelow100(crore) + ' Crore');
  if (lakh) parts.push(numToWordsBelow100(lakh) + ' Lakh');
  if (thousand) parts.push(numToWordsBelow100(thousand) + ' Thousand');
  if (hundred) parts.push(ones[hundred] + ' Hundred');
  if (n) parts.push(numToWordsBelow100(n));

  return parts.join(' ');
}

/**
 * Convert an INR amount to its words representation.
 * e.g. 5000 → "₹5,000 — Five Thousand Rupees Only"
 */
export function amountInWords(amount: number): string {
  if (!amount || isNaN(amount) || amount <= 0) return '';
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = numToWordsIndian(rupees) + ' Rupees';
  if (paise > 0) words += ' and ' + numToWordsBelow100(paise) + ' Paise';
  words += ' Only';
  return `${formatINRCompact(amount)} — ${words}`;
}

// ─── UPI ID Normalisation ──────────────────────────────────────────────────────

/**
 * Normalise a UPI ID to lowercase for case-insensitive comparison
 * against MOCK_KNOWN_BENEFICIARIES (and later the backend Bloom filter).
 */
export function normaliseUpiId(upiId: string): string {
  return upiId.trim().toLowerCase();
}

// ─── Call Duration Formatter ───────────────────────────────────────────────────

/**
 * Format elapsed seconds as mm:ss for the SimulatedCallBanner.
 */
export function formatCallDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}
