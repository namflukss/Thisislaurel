import type { AppState, Category, Recurring, Txn } from '../types';
import { addMonths, currentMonth, dateInMonth, todayISO } from '../lib/dates';

/** נתוני פתיחה לדוגמה – ניתנים לעריכה או למחיקה מלאה מתוך "הגדרות". */

export const PERSON_YULI = 'p-yuli';
export const PERSON_NAAMA = 'p-naama';
export const PERSON_JOINT = 'p-joint';

export const ACC_YULI = 'a-yuli';
export const ACC_NAAMA = 'a-naama';
export const ACC_JOINT = 'a-joint';
export const ACC_SAVINGS = 'a-savings';

const CATEGORIES: Category[] = [
  // דיור ותחזוקה
  { id: 'c-rent', name: 'שכר דירה', group: 'דיור', type: 'expense', emoji: '🏠' },
  { id: 'c-vaad', name: 'ועד בית', group: 'דיור', type: 'expense', emoji: '🏢' },
  { id: 'c-arnona', name: 'ארנונה', group: 'דיור', type: 'expense', emoji: '🧾' },
  { id: 'c-electric', name: 'חשמל', group: 'חשבונות שוטפים', type: 'expense', emoji: '💡' },
  { id: 'c-water', name: 'מים', group: 'חשבונות שוטפים', type: 'expense', emoji: '🚿' },
  { id: 'c-gas', name: 'גז', group: 'חשבונות שוטפים', type: 'expense', emoji: '🔥' },
  { id: 'c-internet', name: 'אינטרנט וטלוויזיה', group: 'חשבונות שוטפים', type: 'expense', emoji: '📶' },
  { id: 'c-phone', name: 'סלולר', group: 'חשבונות שוטפים', type: 'expense', emoji: '📱' },
  { id: 'c-home', name: 'תחזוקת הבית', group: 'דיור', type: 'expense', emoji: '🔧' },

  // ילדים וחינוך
  { id: 'c-gan', name: 'גן', group: 'ילדים וחינוך', type: 'expense', emoji: '🎒' },
  { id: 'c-tsaharon', name: 'צהרון', group: 'ילדים וחינוך', type: 'expense', emoji: '🧸' },
  { id: 'c-hugim', name: 'חוגים', group: 'ילדים וחינוך', type: 'expense', emoji: '⚽' },
  { id: 'c-kids', name: 'ציוד וביגוד לילדים', group: 'ילדים וחינוך', type: 'expense', emoji: '👕' },
  { id: 'c-babysitter', name: 'בייביסיטר', group: 'ילדים וחינוך', type: 'expense', emoji: '👶' },

  // מזון
  { id: 'c-super', name: 'סופר', group: 'מזון', type: 'expense', emoji: '🛒' },
  { id: 'c-restaurants', name: 'מסעדות וקפה', group: 'מזון', type: 'expense', emoji: '🍽️' },

  // תחבורה
  { id: 'c-fuel', name: 'דלק', group: 'תחבורה', type: 'expense', emoji: '⛽' },
  { id: 'c-car', name: 'רכב – טיפולים וטסט', group: 'תחבורה', type: 'expense', emoji: '🚗' },
  { id: 'c-transit', name: 'תחבורה ציבורית', group: 'תחבורה', type: 'expense', emoji: '🚌' },

  // ביטוחים ובריאות
  { id: 'c-ins-health', name: 'ביטוח בריאות', group: 'ביטוח ובריאות', type: 'expense', emoji: '🩺' },
  { id: 'c-ins-home', name: 'ביטוח דירה', group: 'ביטוח ובריאות', type: 'expense', emoji: '🛡️' },
  { id: 'c-ins-car', name: 'ביטוח רכב', group: 'ביטוח ובריאות', type: 'expense', emoji: '🚙' },
  { id: 'c-health', name: 'בריאות ותרופות', group: 'ביטוח ובריאות', type: 'expense', emoji: '💊' },

  // מנויים ופנאי
  { id: 'c-subs', name: 'מנויים דיגיטליים', group: 'מנויים ופנאי', type: 'expense', emoji: '🎬', personalByDefault: true },
  { id: 'c-gym', name: 'חדר כושר וספורט', group: 'מנויים ופנאי', type: 'expense', emoji: '🏋️', personalByDefault: true },
  { id: 'c-fun', name: 'בילויים ופנאי', group: 'מנויים ופנאי', type: 'expense', emoji: '🎭' },
  { id: 'c-gifts', name: 'מתנות ואירועים', group: 'מנויים ופנאי', type: 'expense', emoji: '🎁' },
  { id: 'c-personal', name: 'הוצאות אישיות', group: 'מנויים ופנאי', type: 'expense', emoji: '🧴', personalByDefault: true },

  // חיסכון
  { id: 'c-savings', name: 'חיסכון והשקעות', group: 'חיסכון', type: 'expense', emoji: '🏦' },
  { id: 'c-other-exp', name: 'שונות', group: 'שונות', type: 'expense', emoji: '📦' },

  // הכנסות
  { id: 'c-salary', name: 'משכורת', group: 'הכנסות', type: 'income', emoji: '💼' },
  { id: 'c-freelance', name: 'עבודה עצמאית', group: 'הכנסות', type: 'income', emoji: '💻' },
  { id: 'c-allowance', name: 'קצבאות', group: 'הכנסות', type: 'income', emoji: '🏛️' },
  { id: 'c-refund', name: 'החזרים וזיכויים', group: 'הכנסות', type: 'income', emoji: '↩️' },
  { id: 'c-other-inc', name: 'הכנסות אחרות', group: 'הכנסות', type: 'income', emoji: '✨' },
];

function buildRecurring(start: string): Recurring[] {
  const r = (
    id: string,
    name: string,
    type: Recurring['type'],
    amount: number,
    accountId: string,
    extra: Partial<Recurring> = {},
  ): Recurring => ({
    id,
    name,
    type,
    amount,
    accountId,
    frequency: 'monthly',
    dayOfMonth: 1,
    startDate: start,
    active: true,
    ...extra,
  });

  return [
    // ===== הכנסות =====
    r('r-sal-yuli', 'משכורת יולי', 'income', 14500, ACC_YULI, {
      categoryId: 'c-salary', personId: PERSON_YULI, dayOfMonth: 10,
    }),
    r('r-sal-naama', 'משכורת נעמה', 'income', 12800, ACC_NAAMA, {
      categoryId: 'c-salary', personId: PERSON_NAAMA, dayOfMonth: 1,
    }),
    r('r-freelance-yuli', 'פרילנס יולי', 'income', 2000, ACC_YULI, {
      categoryId: 'c-freelance', personId: PERSON_YULI, dayOfMonth: 20, variable: true,
    }),
    r('r-kids-allowance', 'קצבת ילדים', 'income', 424, ACC_JOINT, {
      categoryId: 'c-allowance', personId: PERSON_JOINT, dayOfMonth: 20,
    }),

    // ===== העברות קבועות לחשבון המשותף =====
    r('r-tr-yuli', 'העברה חודשית מיולי למשותף', 'transfer', 9000, ACC_YULI, {
      toAccountId: ACC_JOINT, dayOfMonth: 11,
    }),
    r('r-tr-naama', 'העברה חודשית מנעמה למשותף', 'transfer', 6700, ACC_NAAMA, {
      toAccountId: ACC_JOINT, dayOfMonth: 2,
    }),
    r('r-tr-savings-yuli', 'הפקדה לחיסכון – יולי', 'transfer', 2500, ACC_YULI, {
      toAccountId: ACC_SAVINGS, dayOfMonth: 12,
    }),
    r('r-tr-savings-naama', 'הפקדה לחיסכון – נעמה', 'transfer', 2000, ACC_NAAMA, {
      toAccountId: ACC_SAVINGS, dayOfMonth: 3,
    }),

    // ===== דיור =====
    r('r-rent', 'שכר דירה', 'expense', 6500, ACC_JOINT, { categoryId: 'c-rent', dayOfMonth: 1 }),
    r('r-vaad', 'ועד בית', 'expense', 250, ACC_JOINT, { categoryId: 'c-vaad', dayOfMonth: 5 }),
    r('r-arnona', 'ארנונה', 'expense', 840, ACC_JOINT, {
      categoryId: 'c-arnona', frequency: 'bimonthly', dayOfMonth: 15,
    }),
    r('r-electric', 'חשמל', 'expense', 760, ACC_JOINT, {
      categoryId: 'c-electric', frequency: 'bimonthly', dayOfMonth: 20, variable: true,
    }),
    r('r-water', 'מים', 'expense', 360, ACC_JOINT, {
      categoryId: 'c-water', frequency: 'bimonthly', dayOfMonth: 22, variable: true,
    }),
    r('r-gas', 'גז', 'expense', 90, ACC_JOINT, { categoryId: 'c-gas', dayOfMonth: 12 }),
    r('r-internet', 'אינטרנט + טלוויזיה', 'expense', 159, ACC_JOINT, { categoryId: 'c-internet', dayOfMonth: 8 }),
    r('r-phone-yuli', 'סלולר יולי', 'expense', 49, ACC_YULI, { categoryId: 'c-phone', dayOfMonth: 15 }),
    r('r-phone-naama', 'סלולר נעמה', 'expense', 49, ACC_NAAMA, { categoryId: 'c-phone', dayOfMonth: 15 }),

    // ===== ילדים =====
    r('r-gan', 'גן', 'expense', 2200, ACC_JOINT, { categoryId: 'c-gan', dayOfMonth: 10 }),
    r('r-tsaharon', 'צהרון', 'expense', 850, ACC_JOINT, { categoryId: 'c-tsaharon', dayOfMonth: 10 }),
    r('r-hug-swim', 'חוג שחייה', 'expense', 180, ACC_NAAMA, { categoryId: 'c-hugim', dayOfMonth: 4 }),

    // ===== מזון ותחבורה =====
    r('r-super', 'קניות בסופר', 'expense', 3200, ACC_JOINT, {
      categoryId: 'c-super', dayOfMonth: 1, variable: true,
    }),
    r('r-fuel', 'דלק', 'expense', 900, ACC_JOINT, { categoryId: 'c-fuel', dayOfMonth: 1, variable: true }),
    r('r-car-test', 'טסט וטיפול שנתי לרכב', 'expense', 1800, ACC_JOINT, {
      categoryId: 'c-car', frequency: 'yearly', dayOfMonth: 15,
    }),

    // ===== ביטוחים =====
    r('r-ins-health', 'ביטוח בריאות משפחתי', 'expense', 320, ACC_JOINT, { categoryId: 'c-ins-health', dayOfMonth: 3 }),
    r('r-ins-home', 'ביטוח דירה', 'expense', 65, ACC_JOINT, { categoryId: 'c-ins-home', dayOfMonth: 3 }),
    r('r-ins-car', 'ביטוח רכב', 'expense', 380, ACC_JOINT, { categoryId: 'c-ins-car', dayOfMonth: 3 }),

    // ===== מנויים אישיים =====
    r('r-netflix', 'נטפליקס', 'expense', 54.9, ACC_YULI, { categoryId: 'c-subs', dayOfMonth: 18 }),
    r('r-spotify', 'ספוטיפיי משפחתי', 'expense', 32.9, ACC_NAAMA, { categoryId: 'c-subs', dayOfMonth: 6 }),
    r('r-icloud', 'iCloud', 'expense', 11.9, ACC_YULI, { categoryId: 'c-subs', dayOfMonth: 25 }),
    r('r-gym-naama', 'חדר כושר נעמה', 'expense', 189, ACC_NAAMA, { categoryId: 'c-gym', dayOfMonth: 7 }),

    // ===== הוצאות אישיות מהחשבונות הפרטיים =====
    r('r-personal-yuli', 'הוצאות אישיות – יולי', 'expense', 1500, ACC_YULI, {
      categoryId: 'c-personal', dayOfMonth: 1, variable: true,
    }),
    r('r-coffee-yuli', 'מסעדות וקפה – יולי', 'expense', 600, ACC_YULI, {
      categoryId: 'c-restaurants', dayOfMonth: 1, variable: true, split: 'personal',
    }),
    r('r-personal-naama', 'הוצאות אישיות – נעמה', 'expense', 1600, ACC_NAAMA, {
      categoryId: 'c-personal', dayOfMonth: 1, variable: true,
    }),
    r('r-fun-naama', 'בילויים – נעמה', 'expense', 500, ACC_NAAMA, {
      categoryId: 'c-fun', dayOfMonth: 1, variable: true, split: 'personal',
    }),
  ];
}

function buildTxns(): Txn[] {
  const thisMonth = currentMonth();
  const prevMonth = addMonths(thisMonth, -1);
  const t = (
    id: string,
    date: string,
    name: string,
    type: Txn['type'],
    amount: number,
    accountId: string,
    extra: Partial<Txn> = {},
  ): Txn => ({ id, date, name, type, amount, accountId, ...extra });

  return [
    t('t-1', dateInMonth(thisMonth, 3), 'ארוחה במסעדה', 'expense', 245, ACC_JOINT, { categoryId: 'c-restaurants' }),
    t('t-2', dateInMonth(thisMonth, 6), 'בגדים לילדים', 'expense', 380, ACC_NAAMA, { categoryId: 'c-kids' }),
    t('t-3', dateInMonth(thisMonth, 8), 'מתנה ליום הולדת', 'expense', 150, ACC_YULI, { categoryId: 'c-gifts' }),
    t('t-10', dateInMonth(thisMonth, 11), 'נעליים לנעמה', 'expense', 420, ACC_NAAMA, {
      categoryId: 'c-personal', split: 'personal',
    }),
    t('t-4', dateInMonth(thisMonth, 9), 'תיקון מזגן', 'expense', 450, ACC_JOINT, { categoryId: 'c-home' }),
    t('t-5', dateInMonth(thisMonth, 12), 'בייביסיטר', 'expense', 220, ACC_JOINT, { categoryId: 'c-babysitter' }),
    t('t-6', dateInMonth(thisMonth, 14), 'החזר מס הכנסה', 'income', 1250, ACC_JOINT, {
      categoryId: 'c-refund', personId: PERSON_JOINT,
    }),
    t('t-7', dateInMonth(prevMonth, 5), 'רופא שיניים', 'expense', 600, ACC_NAAMA, { categoryId: 'c-health' }),
    t('t-8', dateInMonth(prevMonth, 17), 'סוף שבוע בצפון', 'expense', 1450, ACC_JOINT, { categoryId: 'c-fun' }),
    t('t-9', dateInMonth(prevMonth, 22), 'ספרים וציוד לגן', 'expense', 260, ACC_JOINT, { categoryId: 'c-kids' }),
  ];
}

export function buildSeedState(): AppState {
  const start = `${addMonths(currentMonth(), -13)}-01`;
  return {
    version: 1,
    persons: [
      { id: PERSON_YULI, name: 'יולי', isIndividual: true },
      { id: PERSON_NAAMA, name: 'נעמה', isIndividual: true },
      { id: PERSON_JOINT, name: 'משותף', isIndividual: false },
    ],
    accounts: [
      { id: ACC_YULI, name: 'חשבון פרטי – יולי', ownerId: PERSON_YULI, kind: 'checking', openingBalance: 9000, openingDate: start },
      { id: ACC_NAAMA, name: 'חשבון פרטי – נעמה', ownerId: PERSON_NAAMA, kind: 'checking', openingBalance: 7500, openingDate: start },
      { id: ACC_JOINT, name: 'חשבון משותף', ownerId: PERSON_JOINT, kind: 'checking', openingBalance: 12000, openingDate: start },
      { id: ACC_SAVINGS, name: 'חיסכון משפחתי', ownerId: PERSON_JOINT, kind: 'savings', openingBalance: 25000, openingDate: start },
    ],
    categories: CATEGORIES,
    recurring: buildRecurring(start),
    txns: buildTxns(),
    overrides: {},
    settlements: [],
    adjustments: [],
    settings: {
      householdName: 'משק הבית שלנו',
      currency: 'ILS',
      locale: 'he-IL',
      splitMode: 'income',
      customShares: { [PERSON_YULI]: 50, [PERSON_NAAMA]: 50 },
      theme: 'auto',
    },
  };
}

export function emptyState(): AppState {
  const seed = buildSeedState();
  return {
    ...seed,
    recurring: [],
    txns: [],
    overrides: {},
    settlements: [],
    adjustments: [],
    accounts: seed.accounts.map((a) => ({ ...a, openingBalance: 0, openingDate: todayISO() })),
  };
}
