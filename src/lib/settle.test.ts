/**
 * בדיקות לחישוב ההתחשבנות – הליבה החשבונאית של האפליקציה.
 * הרצה: npm test
 */
import { settle, resolveSplit, categoryLookup } from './compute';
import type { AppState } from '../types';

let fails = 0;
const eq = (name: string, got: number, want: number, tol = 0.5) => {
  const ok = Math.abs(got - want) <= tol;
  if (!ok) fails++;
  console.log(ok ? '✓' : '✗', name, ok ? '' : `got ${got.toFixed(2)}, want ${want}`);
};

const base = (): AppState => ({
  version: 1,
  persons: [
    { id: 'y', name: 'יולי', isIndividual: true },
    { id: 'n', name: 'נעמה', isIndividual: true },
    { id: 'j', name: 'משותף', isIndividual: false },
  ],
  accounts: [
    { id: 'ay', name: 'יולי', ownerId: 'y', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
    { id: 'an', name: 'נעמה', ownerId: 'n', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
    { id: 'aj', name: 'משותף', ownerId: 'j', kind: 'checking', openingBalance: 0, openingDate: '2026-01-01' },
  ],
  categories: [
    { id: 'cs', name: 'משותף', group: 'g', type: 'expense', emoji: '🏠' },
    { id: 'cp', name: 'אישי', group: 'g', type: 'expense', emoji: '🧴', personalByDefault: true },
  ],
  recurring: [],
  txns: [],
  overrides: {},
  settlements: [],
  settings: {
    householdName: 'x', currency: 'ILS', locale: 'he-IL',
    splitMode: 'equal', customShares: {}, theme: 'auto',
  },
});

const t = (o: Partial<AppState['txns'][number]> & { id: string; amount: number; accountId: string }) =>
  ({ date: '2026-03-10', type: 'expense' as const, name: o.id, categoryId: 'cs', ...o });

// ---------- scenario 1: the hand-computed pot case ----------
// both fund 1000 into the pot; pot pays 1500 of shared; נעמה draws 500 for herself
{
  const s = base();
  s.txns = [
    t({ id: 'fy', type: 'transfer', amount: 1000, accountId: 'ay', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'fn', type: 'transfer', amount: 1000, accountId: 'an', toAccountId: 'aj', categoryId: undefined }),
    t({ id: 'shared', amount: 1500, accountId: 'aj' }),
    t({ id: 'naama-personal', amount: 500, accountId: 'aj', categoryId: 'cp', forPersonId: 'n' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('1· shared total', r.sharedExpense, 1500);
  eq('1· personal total', r.personalExpense, 500);
  eq('1· all expenses', r.totalExpense, 2000);
  const [y, n] = r.persons;
  eq('1· יולי borne', y.borne, 1000);
  eq('1· נעמה borne', n.borne, 500);
  eq('1· fair share each', y.fairShare, 750);
  eq('1· יולי balance', y.balance, 250);
  eq('1· נעמה balance', n.balance, -250);
  eq('1· transfer amount', r.transfer?.amount ?? 0, 250);
  console.log('  transfer:', r.transfer?.fromId, '->', r.transfer?.toId);
  if (r.transfer?.fromId !== 'n') { fails++; console.log('✗ 1· נעמה should be the one paying'); }
}

// ---------- scenario 2: personal spending from one's own account is simply excluded ----------
{
  const s = base();
  s.txns = [
    t({ id: 'shared-y', amount: 1000, accountId: 'ay' }),
    t({ id: 'shared-n', amount: 1000, accountId: 'an' }),
    t({ id: 'gym-n', amount: 400, accountId: 'an', categoryId: 'cp' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('2· shared total', r.sharedExpense, 2000);
  eq('2· personal total', r.personalExpense, 400);
  const [y, n] = r.persons;
  eq('2· both bear 1000', y.borne + n.borne, 2000);
  eq('2· balanced (יולי)', y.balance, 0);
  eq('2· balanced (נעמה)', n.balance, 0);
  eq('2· נעמה personal attributed', n.personalExpense, 400);
  eq('2· no settling transfer', r.transfer ? 1 : 0, 0);
}

// ---------- scenario 3: without the personal mark it would be split 50/50 ----------
{
  const s = base();
  s.txns = [
    t({ id: 'shoes', amount: 1000, accountId: 'an', categoryId: 'cs' }), // shared category
  ];
  const r = settle(s, ['2026-03']);
  eq('3· shared', r.sharedExpense, 1000);
  eq('3· נעמה overpaid by half', r.persons[1].balance, 500);
  eq('3· יולי owes half', r.persons[0].balance, -500);

  // now mark it personal – the balance disappears
  s.txns[0] = { ...s.txns[0], split: 'personal' };
  const r2 = settle(s, ['2026-03']);
  eq('3· after marking personal: shared', r2.sharedExpense, 0);
  eq('3· after marking personal: balance', r2.persons[1].balance, 0);
}

// ---------- scenario 4: income-proportional split with personal excluded ----------
{
  const s = base();
  s.settings.splitMode = 'income';
  s.txns = [
    t({ id: 'iy', type: 'income', amount: 12000, accountId: 'ay', personId: 'y', categoryId: undefined }),
    t({ id: 'in', type: 'income', amount: 6000, accountId: 'an', personId: 'n', categoryId: undefined }),
    t({ id: 'rent', amount: 3000, accountId: 'ay' }),
    t({ id: 'her-thing', amount: 900, accountId: 'an', categoryId: 'cp' }),
  ];
  const r = settle(s, ['2026-03']);
  eq('4· ratio יולי 2/3', r.persons[0].ratio, 2 / 3, 0.001);
  eq('4· fair share יולי', r.persons[0].fairShare, 2000);
  eq('4· fair share נעמה', r.persons[1].fairShare, 1000);
  eq('4· יולי paid 3000 → +1000', r.persons[0].balance, 1000);
  eq('4· נעמה owes 1000', r.persons[1].balance, -1000);
  eq('4· her personal 900 is untouched', r.personalExpense, 900);
}

// ---------- scenario 5: category default vs explicit mark ----------
{
  const cats = categoryLookup(base().categories);
  const a = resolveSplit({ categoryId: 'cp' }, cats);
  const b = resolveSplit({ categoryId: 'cs' }, cats);
  const c = resolveSplit({ categoryId: 'cp', split: 'shared' }, cats);
  const d = resolveSplit({ categoryId: 'cs', split: 'personal' }, cats);
  const e = resolveSplit({}, cats);
  console.log(
    a === 'personal' && b === 'shared' && c === 'shared' && d === 'personal' && e === 'shared'
      ? '✓ 5· split resolution (category default, explicit override, no category)'
      : (fails++, `✗ 5· split resolution: ${a} ${b} ${c} ${d} ${e}`),
  );
}

console.log(fails ? `\n${fails} FAILED` : '\nall settlement assertions passed');
// יציאה בקוד שגיאה כדי ש-npm test ייכשל כשבדיקה נכשלת
(globalThis as { process?: { exit(code: number): void } }).process?.exit(fails ? 1 : 0);
