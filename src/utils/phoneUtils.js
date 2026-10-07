/**
 * Standard Indian phone number formatter and validator.
 * Requirement 28: Indian contact number format (+91 XXXXX XXXXX or standard 10-digit).
 * Do NOT use +15 or arbitrary formats.
 */
export function formatIndianPhone(phone) {
  if (!phone) return '—';
  const str = String(phone).trim();
  const digits = str.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const main10 = digits.slice(2);
    return `+91 ${main10.slice(0, 5)} ${main10.slice(5)}`;
  }
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
  }
  return str;
}

export function cleanIndianPhoneInput(val) {
  if (!val) return '';
  return String(val).replace(/[^\d+]/g, '');
}
