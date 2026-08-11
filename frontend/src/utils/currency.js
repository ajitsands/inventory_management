/**
 * Dynamic Currency & Decimal Precision Formatter for Multi-Tier Inventory System
 * Converts amounts based on Store Settings (BHD, KWD, OMR -> 3 decimals, others -> 2 decimals).
 */

export function formatCurrency(amount, currencyCode = 'BHD', decimalPlaces = null) {
  const num = parseFloat(amount || 0);
  
  // Determine decimal places: 3 for BHD, KWD, OMR; 2 for all others
  let dec = decimalPlaces;
  if (dec === null || dec === undefined) {
    dec = ['BHD', 'KWD', 'OMR'].includes(currencyCode) ? 3 : 2;
  } else {
    dec = parseInt(dec);
  }

  const formattedNum = num.toFixed(dec);
  return `${currencyCode} ${formattedNum}`;
}

export function getCurrencySymbol(currencyCode = 'BHD') {
  return currencyCode;
}
