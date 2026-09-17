/** עיצוב סכומים. כל הסכומים נשמרים כמספרים חיוביים; הסימן נגזר מסוג התנועה. */

const fmtCache: Record<string, Intl.NumberFormat> = {};

function nf(locale: string, currency: string, digits: number, always = false): Intl.NumberFormat {
  const key = `${locale}|${currency}|${digits}|${always}`;
  if (!fmtCache[key]) {
    fmtCache[key] = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
      ...(always ? { signDisplay: 'always' as const } : {}),
    });
  }
  return fmtCache[key];
}

export function formatMoney(
  value: number,
  opts: { locale?: string; currency?: string; decimals?: boolean } = {},
): string {
  const { locale = 'he-IL', currency = 'ILS', decimals = false } = opts;
  const rounded = decimals ? value : Math.round(value);
  return nf(locale, currency, decimals ? 2 : 0).format(rounded);
}

/** גרסה קומפקטית למספרי-על ולצירי גרפים: 12.4 אלף ₪ */
export function formatCompact(value: number, currency = '₪'): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M ${currency}`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}K ${currency}`;
  return `${sign}${Math.round(abs).toLocaleString('he-IL')} ${currency}`;
}

/** מציג תמיד סימן (+/−). Intl אחראי למיקום הסימן בשפה הנכונה. */
export function formatSigned(value: number, opts: { locale?: string; currency?: string } = {}): string {
  const { locale = 'he-IL', currency = 'ILS' } = opts;
  return nf(locale, currency, 0, true).format(Math.round(value));
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

export function percent(part: number, whole: number): number {
  if (!whole) return 0;
  return (part / whole) * 100;
}
