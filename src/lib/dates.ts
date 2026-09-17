/** עזרי תאריכים. "חודש" מיוצג תמיד כמחרוזת 'YYYY-MM'. */

export const MONTH_NAMES = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

export const WEEKDAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function currentMonth(): string {
  return todayISO().slice(0, 7);
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

export function parseMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m - 1 };
}

export function monthLabel(ym: string): string {
  const { year, month } = parseMonth(ym);
  return `${MONTH_NAMES[month]} ${year}`;
}

export function shortMonthLabel(ym: string): string {
  const { year, month } = parseMonth(ym);
  return `${MONTH_NAMES[month].slice(0, 3)}׳${String(year).slice(2)}`;
}

export function addMonths(ym: string, delta: number): string {
  const { year, month } = parseMonth(ym);
  const d = new Date(year, month + delta, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** מספר החודשים מ-a ל-b (b - a) */
export function monthDiff(a: string, b: string): number {
  const x = parseMonth(a);
  const y = parseMonth(b);
  return (y.year - x.year) * 12 + (y.month - x.month);
}

export function daysInMonth(ym: string): number {
  const { year, month } = parseMonth(ym);
  return new Date(year, month + 1, 0).getDate();
}

/** בונה תאריך בתוך החודש, עם חיתוך ליום האחרון בחודשים קצרים */
export function dateInMonth(ym: string, day: number): string {
  const max = daysInMonth(ym);
  return `${ym}-${pad2(Math.min(Math.max(1, day), max))}`;
}

export function formatDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

export function formatDateLong(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  return `${d} ב${MONTH_NAMES[m - 1]} ${y}`;
}

/** רשימת החודשים מ-from עד to (כולל) */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (monthDiff(cur, to) >= 0 && guard++ < 600) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

/** N החודשים האחרונים שמסתיימים ב-endMonth (כולל) */
export function lastMonths(endMonth: string, count: number): string[] {
  return monthRange(addMonths(endMonth, -(count - 1)), endMonth);
}

export function weekdayOf(dateISO: string): number {
  const [y, m, d] = dateISO.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}
