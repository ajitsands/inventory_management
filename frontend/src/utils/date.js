/**
 * Date Formatting Utility for Multi-Tier Inventory System
 * Converts standard date strings (YYYY-MM-DD or YYYY-MM-DD HH:mm:ss) into user-configured format.
 */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(dateInput, formatPattern = 'DD/MM/YYYY') {
  if (!dateInput) return '-';

  try {
    // If date string starts with YYYY-MM-DD
    const dateObj = new Date(dateInput);
    if (isNaN(dateObj.getTime())) {
      return String(dateInput);
    }

    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const monthMMM = MONTH_NAMES[dateObj.getMonth()];

    // Preserve time if present (e.g. 14:30:15)
    let timePart = '';
    if (typeof dateInput === 'string' && dateInput.includes(':')) {
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      timePart = ` ${hours}:${minutes}`;
    }

    switch (formatPattern) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}${timePart}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}${timePart}`;
      case 'YYYY/MM/DD':
        return `${year}/${month}/${day}${timePart}`;
      case 'DD-MMM-YYYY':
        return `${day}-${monthMMM}-${year}${timePart}`;
      case 'DD/MM/YYYY':
      default:
        return `${day}/${month}/${year}${timePart}`;
    }
  } catch (err) {
    return String(dateInput);
  }
}
