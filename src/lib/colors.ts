import type { Account, Person } from '../types';

/** צבעי זהות לבעלי החשבונות – שלושת המקומות הראשונים בפלטה שאומתה */
export const OWNER_COLORS = ['var(--owner-1)', 'var(--owner-2)', 'var(--owner-3)'];

export function personColor(persons: Person[], personId?: string): string {
  const idx = persons.findIndex((p) => p.id === personId);
  return idx === -1 ? 'var(--text-muted)' : OWNER_COLORS[idx % OWNER_COLORS.length];
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
