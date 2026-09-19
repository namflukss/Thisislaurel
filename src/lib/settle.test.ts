/**
 * בדיקות לחישוב ההתחשבנות – הליבה החשבונאית של האפליקציה.
 * המודל: לכל הוצאה יש מי ששילם אותה ומי שנושא בה, וזה לא בהכרח אותו אדם.
 * הרצה: npm test
 */
import { settle, resolveSplit, splitLabel, categoryLookup } from './compute';
import type { AppState, Txn } from '../types';

let fails = 0;
const eq = (name: string, got: number, want: number, tol = 0.5) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(ok ? '✓' : '✗', name, ok ? '' : `got ${got.toFixed(2)}, want ${want}`);
};
const is = (name: string, cond: boolean, detail = '') => {
  if (!cond) fails++;
  console.log(cond ? '✓' : '✗', name, cond ? '' : detail);
};

const base = (): AppState => ({
  version: 1,
  persons: [
    { id: 'y', name: 'יולי', isIndividual: true },
    { id: 'n', name: 'נעמה', isIndividual: true },
    { id: 'j', name: 'משותף', isIndividual: false },
  ],
  accounts: [
    { id: 'ay', name: 'פרטי יולי', ownerId: 'y', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
    { id: 'an', name: 'פרטי נעמה', ownerId: 'n', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
    { id: 'aj', name: 'משותף', ownerId: 'j', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
  ],
  categories: [
    { id: 'cs', name: 'שכר דירה', group: 'דיור', type: 'expense', emoji: '🏠' },
    { id: 'cp', name: 'אישי', group: 'אישי', type: 'expense', emoji: '🧴', personalByDefault: true },
  ],
  recurring: [],
  txns: [],
  overrides: {},
  settlements: [],
  adjustments: [],
  settings: {
    householdName: 'x', currency: 'ILS', locale: 'he-IL',
    splitMode: 'equal', customShares: {}, theme: 'auto',
  },
});

const t = (o: Partial<Txn> & { id: string; amount: number; accountId: string }): Txn =>
  ({ date: '2026-03-10', type: 'expense', name: o.id, categoryId: 'cs', ...o }) as Txn;

const person = (r: ReturnType<typeof settle>, id: string) => r.persons.find((p) => p.personId === id)!;

// ── 1. שכר דירה מהחשבון של נעמה, מתחלק חצי-חצי ─────────────────────────
// זה המקרה שהיה שבור: נעמה שילמה 6,500, אבל שניהם נושאים ב-3,250.
{
  const s = base();
  s.txns = [t({ id: 'rent', amount: 6500, accountId: 'an', split: 'equal' })];
  const r = settle(s, ['2026-03']);
  eq('1· נעמה שילמה מהפרטי', person(r, 'n').paidFromOwnAccount, 6500);
  eq('1· יולי לא שילמה כלום', person(r, 'y').paidFromOwnAccount, 0);
  eq('1· נעמה נושאת בחצי', person(r, 'n').borne, 3250);
  eq('1· יולי נושאת בחצי – זה נרשם כהוצאה שלה', person(r, 'y').borne, 3250);
  eq('1· נעמה בפלוס', person(r, 'n').balance, 3250);
  eq('1· יולי במינוס', person(r, 'y').balance, -3250);
  eq('1· ההעברה המוצעת', r.transfer?.amount ?? 0, 3250);
  is('1· יולי היא זו שמעבירה', r.transfer?.fromId === 'y', `fromId=${r.transfer?.fromId}`);
}

// ── 2. אחרי שיולי מעבירה את החצי, המאזן מתאפס ───────────────────────────
{
  const s = base();
  s.txns = [
    t({ id: 'rent', amount: 6500, accountId: 'an', split: 'equal' }),
    t({ id: 'החזר', type: 'transfer', amount: 3250, accountId: 'ay', toAccountId: 'an', categoryId: undefined }),
  ];
  const r = settle(s, ['2026-03']);
  eq('2· ההחזר נרשם', r.settledTotal, 3250);
  eq('2· יולי מאוזנת', person(r, 'y').balance, 0);
  eq('2· נעמה מאוזנת', person(r, 'n').balance, 0);
  is('2· אין הצעת העברה', !r.transfer, `transfer=${JSON.stringify(r.transfer)}`);
  eq('2· ההעברה לא נחשבת הוצאה', r.totalExpense, 6500);
}

// ── 3. העברה שסומנה כלא-מאזנת (מתנה, הלוואה) לא נוגעת באיזון ───────────
{
  const s = base();
  s.txns = [
    t({ id: 'rent', amount: 6500, accountId: 'an', split: 'equal' }),
    t({ id: 'מתנה', type: 'transfer', amount: 3250, accountId: 'ay', toAccountId: 'an', categoryId: undefined, settles: false }),
  ];
  const r = settle(s, ['2026-03']);
  eq('3· ההעברה לא נכנסה לאיזון', r.settledTotal, 0);
  eq('3· יולי עדיין חייבת את החצי', person(r, 'y').balance, -3250);
}

// ── 4. התאמה ידנית מהטאב של ההתחשבנות ──────────────────────────────────
{
  const s = base();
  s.txns = [t({ id: 'rent', amount: 6500, accountId: 'an', split: 'equal' })];
  s.adjustments = [
    { id: 'a1', date: '2026-03-20', description: 'יולי העבירה במזומן', amount: 1000, fromPersonId: 'y', toPersonId: 'n' },
  ];
  const r = settle(s, ['2026-03']);
  eq('4· ההתאמה מקטינה את מה שיולי חייבת', person(r, 'y').balance, -2250);
  eq('4· ואת מה שנעמה זכאית לו', person(r, 'n').balance, 2250);
  eq('4· ההתאמה מופיעה בסך ההחזרים', r.settledTotal, 1000);

  // התאמה מחוץ לטווח הדוח לא נספרת
  const outside = settle({ ...s, adjustments: [{ ...s.adjustments[0], date: '2026-05-02' }] }, ['2026-03']);
  eq('4· התאמה מחודש אחר לא נספרת', person(outside, 'y').balance, -3250);
}

// ── 5. הוצאה אישית שאחת שילמה עבור השנייה ──────────────────────────────
// נעמה שילמה 300 על משהו אישי של יולי – יולי נושאת בזה במלואו.
{
  const s = base();
  s.txns = [t({ id: 'משהו של יולי', amount: 300, accountId: 'an', categoryId: 'cp', forPersonId: 'y' })];
  const r = settle(s, ['2026-03']);
  eq('5· יולי נושאת בכל הסכום', person(r, 'y').borne, 300);
  eq('5· נעמה לא נושאת בכלום', person(r, 'n').borne, 0);
  eq('5· נעמה זכאית להחזר מלא', person(r, 'n').balance, 300);
  eq('5· יולי חייבת את הכול', person(r, 'y').balance, -300);
  eq('5· מסומן כהוצאה אישית', r.personalExpense, 300);
}

// ── 6. הוצאה אישית מהחשבון הפרטי של מי שהיא שלו – לא מזיזה כלום ─────────
{
  const s = base();
  s.txns = [
    t({ id: 'rent', amount: 6500, accountId: 'an', split: 'equal' }),
    t({ id: 'חדר כושר', amount: 400, accountId: 'an', categoryId: 'cp' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('6· נעמה נושאת בשלה', person(r, 'n').personalBorne, 400);
  eq('6· המאזן לא משתנה בגללה', person(r, 'y').balance, -3250);
}

// ── 7. חלוקה לפי אחוזים שנקבעו בשורה ───────────────────────────────────
{
  const s = base();
  s.txns = [t({ id: 'גן', amount: 1000, accountId: 'aj', split: 'ratio', shares: { y: 70, n: 30 } })];
  const r = settle(s, ['2026-03']);
  eq('7· יולי נושאת ב-70%', person(r, 'y').borne, 700);
  eq('7· נעמה נושאת ב-30%', person(r, 'n').borne, 300);
}

// ── 8. הקופה המשותפת: כל אחת מממנת 1000, הקופה משלמת 1500 משותף ו-500 אישי של נעמה
{
  const s = base();
  s.txns = [
    t({ id: 'fy', type: 'transfer', amount: 1000, accountId: 'ay', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'fn', type: 'transfer', amount: 1000, accountId: 'an', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'משותף', amount: 1500, accountId: 'aj', split: 'equal' }),
    t({ id: 'אישי של נעמה', amount: 500, accountId: 'aj', categoryId: 'cp', forPersonId: 'n' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('8· הקופה שילמה', r.jointExpense, 2000);
  eq('8· כל אחת מימנה חצי', person(r, 'y').paidViaJoint, 1000);
  eq('8· יולי נושאת ב-750', person(r, 'y').borne, 750);
  eq('8· נעמה נושאת ב-1250', person(r, 'n').borne, 1250);
  eq('8· יולי בפלוס 250', person(r, 'y').balance, 250);
  eq('8· נעמה במינוס 250', person(r, 'n').balance, -250);
}

// ── 9. משיכה מהקופה המשותפת לחשבון פרטי מקטינה את המימון ───────────────
{
  const s = base();
  s.txns = [
    t({ id: 'fy', type: 'transfer', amount: 1000, accountId: 'ay', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'fn', type: 'transfer', amount: 1000, accountId: 'an', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'משיכה לנעמה', type: 'transfer', amount: 400, accountId: 'aj', toAccountId: 'an', categoryId: undefined }),
    t({ id: 'משותף', amount: 1600, accountId: 'aj', split: 'equal' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('9· מימון נטו של נעמה', person(r, 'n').jointFunding, 600);
  eq('9· חלקה במה שהקופה שילמה', person(r, 'n').paidViaJoint, 600);
  eq('9· חלקה של יולי', person(r, 'y').paidViaJoint, 1000);
  eq('9· נעמה חייבת 200', person(r, 'n').balance, -200);
}

// ── 10. חלוקה יחסית להכנסות חלה על הוצאה שסומנה "משותפת" ───────────────
{
  const s = base();
  s.settings.splitMode = 'income';
  s.txns = [
    t({ id: 'iy', type: 'income', amount: 12000, accountId: 'ay', personId: 'y', categoryId: undefined }),
    t({ id: 'in', type: 'income', amount: 6000, accountId: 'an', personId: 'n', categoryId: undefined }),
    t({ id: 'חשבונות', amount: 3000, accountId: 'ay', split: 'shared' }),
    t({ id: 'שכר דירה חצי-חצי', amount: 1000, accountId: 'ay', split: 'equal' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('10· יחס יולי 2/3', person(r, 'y').ratio, 2 / 3, 0.001);
  eq('10· "משותפת" מתחלקת 2:1', person(r, 'y').borne - 500, 2000);
  eq('10· "חצי-חצי" מתחלקת שווה', person(r, 'n').borne, 1500);
  eq('10· יולי שילמה הכול', person(r, 'y').paidFromOwnAccount, 4000);
  eq('10· נעמה חייבת 1500', person(r, 'n').balance, -1500);
}

// ── 11. סכום כל המאזנים הוא אפס, ותמיד ─────────────────────────────────
{
  const s = base();
  s.settings.splitMode = 'income';
  s.txns = [
    t({ id: 'iy', type: 'income', amount: 9000, accountId: 'ay', personId: 'y', categoryId: undefined }),
    t({ id: 'in', type: 'income', amount: 7000, accountId: 'an', personId: 'n', categoryId: undefined }),
    t({ id: 'fy', type: 'transfer', amount: 2000, accountId: 'ay', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'fn', type: 'transfer', amount: 1500, accountId: 'an', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'סופר', amount: 2500, accountId: 'aj', split: 'shared' }),
    t({ id: 'שכר דירה', amount: 900, accountId: 'an', split: 'equal' }),
    t({ id: 'אישי יולי', amount: 300, accountId: 'ay', categoryId: 'cp' }),
    t({ id: 'החזר', type: 'transfer', amount: 200, accountId: 'ay', toAccountId: 'an', categoryId: undefined }),
  ];
  s.adjustments = [
    { id: 'a1', date: '2026-03-15', description: 'מזומן', amount: 120, fromPersonId: 'n', toPersonId: 'y' },
  ];
  const r = settle(s, ['2026-03']);
  const sum = r.persons.reduce((acc, p) => acc + p.balance, 0);
  eq('11· סכום המאזנים = 0', sum, 0, 0.01);
  eq('11· סך ההוצאות', r.totalExpense, 3700);
  const totalBorne = r.persons.reduce((acc, p) => acc + p.borne, 0);
  eq('11· כל שקל הוצאה מיוחס למישהו', totalBorne, 3700, 0.01);
}

// ── 12. תיאור אופן החלוקה לתצוגה ────────────────────────────────────────
{
  const s = base();
  const cats = categoryLookup(s.categories);
  is('12· "לפי הקטגוריה" בקטגוריה רגילה', resolveSplit({ categoryId: 'cs' }, cats) === 'shared');
  is('12· קטגוריה אישית', resolveSplit({ categoryId: 'cp' }, cats) === 'personal');
  is('12· סימון בשורה גובר', resolveSplit({ categoryId: 'cp', split: 'equal' }, cats) === 'equal');
  is(
    '12· תווית "חצי-חצי"',
    splitLabel({ split: 'equal', accountId: 'an' }, cats, s.accounts, s.persons) === 'חצי-חצי',
  );
  is(
    '12· תווית אחוזים',
    splitLabel({ split: 'ratio', shares: { y: 70, n: 30 }, accountId: 'an' }, cats, s.accounts, s.persons) === '70% / 30%',
  );
  is(
    '12· תווית אישי עם שם',
    splitLabel({ categoryId: 'cp', accountId: 'an' }, cats, s.accounts, s.persons) === 'אישי · נעמה',
  );
  is(
    '12· אישי מהמשותף בלי שיוך',
    splitLabel({ categoryId: 'cp', accountId: 'aj' }, cats, s.accounts, s.persons) === 'אישי · חסר שיוך',
  );
}

console.log(fails ? `\n${fails} FAILED` : '\nall settlement assertions passed');
(globalThis as { process?: { exit(code: number): void } }).process?.exit(fails ? 1 : 0);
