import type { Account, Person } from '../types';

/** צבעי זהות לבעלי החשבונות – שלושת המקומות הראשונים בפלטה שאומתה */
export const OWNER_COLORS = ['var(--owner-1)', 'var(--owner-2)', 'var(--owner-3)'];

/**
 * לוח הצבעים לבחירה. שמונה גוונים שנבדקו לניגודיות ולהבחנה בעיוורון צבעים,
 * בסדר שמבטיח הפרדה טובה גם בין גוונים סמוכים.
 */
export const PALETTE: { name: string; hex: string }[] = [
  { name: 'כחול', hex: '#2a78d6' },
  { name: 'כתום', hex: '#eb6834' },
  { name: 'טורקיז', hex: '#1baf7a' },
  { name: 'צהוב', hex: '#eda100' },
  { name: 'ורוד', hex: '#e87ba4' },
  { name: 'ירוק', hex: '#008300' },
  { name: 'סגול', hex: '#4a3aa7' },
  { name: 'אדום', hex: '#e34948' },
];

/** צבע ברירת המחדל של בעל חשבון לפי מיקומו ברשימה */
export function defaultPersonColor(persons: Person[], personId?: string): string {
  const idx = persons.findIndex((p) => p.id === personId);
  return idx === -1 ? 'var(--text-muted)' : OWNER_COLORS[idx % OWNER_COLORS.length];
}

export function personColor(persons: Person[], personId?: string): string {
  const person = persons.find((p) => p.id === personId);
  return person?.color || defaultPersonColor(persons, personId);
}

export function accountColor(accounts: Account[], persons: Person[], accountId?: string): string {
  const acc = accounts.find((a) => a.id === accountId);
  return personColor(persons, acc?.ownerId);
}

export const ACCOUNT_KIND_LABEL: Record<Account['kind'], string> = {
  checking: 'עובר ושב',
  credit: 'כרטיס אשראי',
  savings: 'חיסכון',
  cash: 'מזומן',
};

export const TYPE_LABEL = {
  income: 'הכנסה',
  expense: 'הוצאה',
  transfer: 'העברה',
} as const;

export const STATUS_LABEL = {
  paid: 'בוצע',
  pending: 'צפוי',
  skipped: 'דילוג',
} as const;
