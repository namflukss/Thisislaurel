import type {
  Account,
  AppState,
  Category,
  LedgerEntry,
  OccurrenceStatus,
  Recurring,
} from '../types';
import {
  addMonths,
  daysInMonth,
  dateInMonth,
  monthDiff,
  monthOf,
  pad2,
  parseMonth,
  todayISO,
} from './dates';

const STEP: Record<Recurring['frequency'], number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  semiannual: 6,
  yearly: 12,
  weekly: 0,
};

export const FREQUENCY_LABEL: Record<Recurring['frequency'], string> = {
  monthly: 'חודשי',
  bimonthly: 'דו-חודשי',
  quarterly: 'רבעוני',
  semiannual: 'חצי שנתי',
  yearly: 'שנתי',
  weekly: 'שבועי',
};

/** התאריכים שבהם תנועה קבועה מתרחשת בחודש נתון */
export function occurrenceDates(rec: Recurring, ym: string): string[] {
  const startYm = monthOf(rec.startDate);
  if (monthDiff(startYm, ym) < 0) return [];
  if (rec.endDate && monthDiff(ym, monthOf(rec.endDate)) < 0) return [];

  const within = (d: string) => d >= rec.startDate && (!rec.endDate || d <= rec.endDate);

  if (rec.frequency === 'weekly') {
    const weekday = rec.weekday ?? new Date(rec.startDate).getDay();
    const { year, month } = parseMonth(ym);
    const out: string[] = [];
    for (let day = 1; day <= daysInMonth(ym); day++) {
      if (new Date(year, month, day).getDay() === weekday) {
        const d = `${ym}-${pad2(day)}`;
        if (within(d)) out.push(d);
      }
    }
    return out;
  }

  const step = STEP[rec.frequency];
  if (monthDiff(startYm, ym) % step !== 0) return [];
  const d = dateInMonth(ym, rec.dayOfMonth);
  return within(d) ? [d] : [];
}

export function overrideKey(recurringId: string, ym: string): string {
  return `${recurringId}|${ym}`;
}

/** סטטוס ברירת מחדל: מה שכבר עבר – בוצע; מה שעוד לא – ממתין */
function defaultStatus(date: string): OccurrenceStatus {
  return date <= todayISO() ? 'paid' : 'pending';
}

/** כל שורות התזרים של חודש: תנועות קבועות + תנועות חד-פעמיות, ממוינות לפי תאריך */
export function buildLedger(state: AppState, ym: string): LedgerEntry[] {
  const entries: LedgerEntry[] = [];

  for (const rec of state.recurring) {
    if (!rec.active) continue;
    for (const date of occurrenceDates(rec, ym)) {
      const ov = state.overrides[overrideKey(rec.id, ym)] ?? {};
      entries.push({
        key: `r:${rec.id}:${date}`,
        date,
        name: rec.name,
        type: rec.type,
        amount: ov.amount ?? rec.amount,
        categoryId: rec.categoryId,
        accountId: ov.accountId ?? rec.accountId,
        toAccountId: rec.toAccountId,
        personId: rec.personId,
        source: 'recurring',
        recurringId: rec.id,
        status: ov.status ?? defaultStatus(date),
        variable: rec.variable,
        note: rec.note,
      });
    }
  }

  for (const t of state.txns) {
    if (monthOf(t.date) !== ym) continue;
    entries.push({
      key: `t:${t.id}`,
      date: t.date,
      name: t.name,
      type: t.type,
      amount: t.amount,
      categoryId: t.categoryId,
      accountId: t.accountId,
      toAccountId: t.toAccountId,
      personId: t.personId,
      source: 'once',
      txnId: t.id,
      status: 'paid',
      note: t.note,
    });
  }

  entries.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name, 'he')));
  return entries;
}

/** שורות פעילות בלבד (ללא מדולגות) – הבסיס לכל סיכום */
export function activeEntries(entries: LedgerEntry[]): LedgerEntry[] {
  return entries.filter((e) => e.status !== 'skipped');
}

export interface Bucket {
  id: string;
  amount: number;
}

export interface MonthSummary {
  ym: string;
  entries: LedgerEntry[];
  income: number;
  expense: number;
  net: number;
  /** הוצאות שכבר בוצעו מול כאלה שעוד צפויות בחודש */
  paidExpense: number;
  upcomingExpense: number;
  transfersOut: number;
  savingsDeposits: number;
  expenseByCategory: Bucket[];
  incomeByCategory: Bucket[];
  expenseByGroup: Bucket[];
  expenseByAccount: Bucket[];
  incomeByPerson: Bucket[];
  expenseByPayer: Bucket[];
  skippedCount: number;
}

function toBuckets(map: Map<string, number>): Bucket[] {
  return [...map.entries()]
    .map(([id, amount]) => ({ id, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function bump(map: Map<string, number>, id: string, amount: number) {
  map.set(id, (map.get(id) ?? 0) + amount);
}

export function summarizeMonth(state: AppState, ym: string): MonthSummary {
  const all = buildLedger(state, ym);
  const entries = activeEntries(all);
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const categoryById = new Map(state.categories.map((c) => [c.id, c]));

  const expenseByCategory = new Map<string, number>();
  const incomeByCategory = new Map<string, number>();
  const expenseByGroup = new Map<string, number>();
  const expenseByAccount = new Map<string, number>();
  const incomeByPerson = new Map<string, number>();
  const expenseByPayer = new Map<string, number>();

  let income = 0;
  let expense = 0;
  let paidExpense = 0;
  let upcomingExpense = 0;
  let transfersOut = 0;
  let savingsDeposits = 0;

  for (const e of entries) {
    if (e.type === 'expense') {
      expense += e.amount;
      if (e.status === 'paid') paidExpense += e.amount;
      else upcomingExpense += e.amount;
      const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
      bump(expenseByCategory, e.categoryId ?? 'c-other-exp', e.amount);
      bump(expenseByGroup, cat?.group ?? 'שונות', e.amount);
      bump(expenseByAccount, e.accountId, e.amount);
      const owner = accountById.get(e.accountId)?.ownerId;
      if (owner) bump(expenseByPayer, owner, e.amount);
    } else if (e.type === 'income') {
      income += e.amount;
      bump(incomeByCategory, e.categoryId ?? 'c-other-inc', e.amount);
      const person = e.personId ?? accountById.get(e.accountId)?.ownerId;
      if (person) bump(incomeByPerson, person, e.amount);
    } else {
      transfersOut += e.amount;
      const target = e.toAccountId ? accountById.get(e.toAccountId) : undefined;
      if (target?.kind === 'savings') savingsDeposits += e.amount;
    }
  }

  return {
    ym,
    entries: all,
    income,
    expense,
    net: income - expense,
    paidExpense,
    upcomingExpense,
    transfersOut,
    savingsDeposits,
    expenseByCategory: toBuckets(expenseByCategory),
    incomeByCategory: toBuckets(incomeByCategory),
    expenseByGroup: toBuckets(expenseByGroup),
    expenseByAccount: toBuckets(expenseByAccount),
    incomeByPerson: toBuckets(incomeByPerson),
    expenseByPayer: toBuckets(expenseByPayer),
    skippedCount: all.length - entries.length,
  };
}

/** יתרות חשבונות מצטברות עד תאריך נתון (כולל) */
export function accountBalances(state: AppState, upto = todayISO()): Map<string, number> {
  const balances = new Map<string, number>();
  let earliest = monthOf(upto);
  for (const a of state.accounts) {
    balances.set(a.id, a.openingBalance);
    if (monthOf(a.openingDate) < earliest) earliest = monthOf(a.openingDate);
  }
  for (const r of state.recurring) if (monthOf(r.startDate) < earliest) earliest = monthOf(r.startDate);
  for (const t of state.txns) if (monthOf(t.date) < earliest) earliest = monthOf(t.date);

  const endYm = monthOf(upto);
  for (let ym = earliest; monthDiff(ym, endYm) >= 0; ym = addMonths(ym, 1)) {
    for (const e of activeEntries(buildLedger(state, ym))) {
      if (e.date > upto) continue;
      const openingOf = state.accounts.find((a) => a.id === e.accountId)?.openingDate;
      if (openingOf && e.date < openingOf) continue;
      if (e.type === 'income') {
        balances.set(e.accountId, (balances.get(e.accountId) ?? 0) + e.amount);
      } else if (e.type === 'expense') {
        balances.set(e.accountId, (balances.get(e.accountId) ?? 0) - e.amount);
      } else {
        balances.set(e.accountId, (balances.get(e.accountId) ?? 0) - e.amount);
        if (e.toAccountId) balances.set(e.toAccountId, (balances.get(e.toAccountId) ?? 0) + e.amount);
      }
    }
  }
  return balances;
}

export interface PersonSettlement {
  personId: string;
  /** הכנסות שנרשמו על שמו בתקופה */
  income: number;
  /** הוצאות ששולמו מהחשבונות הפרטיים שלו */
  personalExpense: number;
  /** כסף שהעביר/הפקיד לחשבון המשותף */
  jointFunding: number;
  /** חלקו במימון ההוצאות מהחשבון המשותף */
  jointShareAmount: number;
  /** סך ההוצאה המשפחתית שנשא בפועל */
  borne: number;
  /** החלק ההוגן לפי שיטת החלוקה שנבחרה */
  fairShare: number;
  /** חיובי = שילם מעבר לחלקו */
  balance: number;
  ratio: number;
}

export interface Settlement {
  totalExpense: number;
  jointExpense: number;
  jointFundingTotal: number;
  persons: PersonSettlement[];
  /** הצעת התחשבנות: מי מעביר למי וכמה */
  transfer?: { fromId: string; toId: string; amount: number };
  modeLabel: string;
}

/** התחשבנות בין בני הזוג על פני טווח חודשים */
export function settle(state: AppState, months: string[]): Settlement {
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const personById = new Map(state.persons.map((p) => [p.id, p]));
  const isJointAccount = (id: string) => {
    const owner = accountById.get(id)?.ownerId;
    return owner ? personById.get(owner)?.isIndividual === false : false;
  };

  const individuals = state.persons.filter((p) => p.isIndividual);
  const personalExpense = new Map<string, number>();
  const jointFunding = new Map<string, number>();
  const incomeByPerson = new Map<string, number>();
  let jointExpense = 0;
  let totalExpense = 0;

  for (const ym of months) {
    for (const e of activeEntries(buildLedger(state, ym))) {
      if (e.type === 'expense') {
        totalExpense += e.amount;
        if (isJointAccount(e.accountId)) {
          jointExpense += e.amount;
        } else {
          const owner = accountById.get(e.accountId)?.ownerId;
          if (owner) bump(personalExpense, owner, e.amount);
        }
      } else if (e.type === 'income') {
        const person = e.personId ?? accountById.get(e.accountId)?.ownerId;
        if (person) bump(incomeByPerson, person, e.amount);
        // הכנסה של אדם פרטי שנכנסת ישירות לחשבון המשותף היא מימון של הקופה המשותפת
        if (person && personById.get(person)?.isIndividual && isJointAccount(e.accountId)) {
          bump(jointFunding, person, e.amount);
        }
      } else if (e.type === 'transfer') {
        const fromJoint = isJointAccount(e.accountId);
        const toJoint = e.toAccountId ? isJointAccount(e.toAccountId) : false;
        if (!fromJoint && toJoint) {
          const owner = accountById.get(e.accountId)?.ownerId;
          if (owner) bump(jointFunding, owner, e.amount);
        }
      }
    }
  }

  const jointFundingTotal = individuals.reduce((s, p) => s + (jointFunding.get(p.id) ?? 0), 0);

  // יחס החלוקה ההוגנת
  const incomeTotal = individuals.reduce((s, p) => s + (incomeByPerson.get(p.id) ?? 0), 0);
  const ratios = new Map<string, number>();
  for (const p of individuals) {
    if (state.settings.splitMode === 'equal' || (state.settings.splitMode === 'income' && !incomeTotal)) {
      ratios.set(p.id, 1 / Math.max(individuals.length, 1));
    } else if (state.settings.splitMode === 'income') {
      ratios.set(p.id, (incomeByPerson.get(p.id) ?? 0) / incomeTotal);
    } else {
      const sum = individuals.reduce((s, q) => s + (state.settings.customShares[q.id] ?? 0), 0);
      ratios.set(p.id, sum ? (state.settings.customShares[p.id] ?? 0) / sum : 1 / individuals.length);
    }
  }

  const persons: PersonSettlement[] = individuals.map((p) => {
    const funding = jointFunding.get(p.id) ?? 0;
    const fundingShare = jointFundingTotal > 0 ? funding / jointFundingTotal : (ratios.get(p.id) ?? 0);
    const jointShareAmount = jointExpense * fundingShare;
    const personal = personalExpense.get(p.id) ?? 0;
    const borne = personal + jointShareAmount;
    const fairShare = totalExpense * (ratios.get(p.id) ?? 0);
    return {
      personId: p.id,
      income: incomeByPerson.get(p.id) ?? 0,
      personalExpense: personal,
      jointFunding: funding,
      jointShareAmount,
      borne,
      fairShare,
      balance: borne - fairShare,
      ratio: ratios.get(p.id) ?? 0,
    };
  });

  let transfer: Settlement['transfer'];
  if (persons.length === 2) {
    const [a, b] = persons;
    const diff = (a.balance - b.balance) / 2;
    if (Math.abs(diff) >= 1) {
      transfer = diff > 0
        ? { fromId: b.personId, toId: a.personId, amount: Math.abs(diff) }
        : { fromId: a.personId, toId: b.personId, amount: Math.abs(diff) };
    }
  }

  const modeLabel =
    state.settings.splitMode === 'equal'
      ? 'חלוקה שווה (50/50)'
      : state.settings.splitMode === 'income'
        ? 'חלוקה יחסית להכנסות'
        : 'חלוקה מותאמת אישית';

  return { totalExpense, jointExpense, jointFundingTotal, persons, transfer, modeLabel };
}

export interface CategoryTrend {
  categoryId: string;
  months: { ym: string; amount: number }[];
  total: number;
  average: number;
}

/** סכומי חודשים לצורך גרפי מגמה */
export function monthlyTotals(state: AppState, months: string[]) {
  return months.map((ym) => {
    const s = summarizeMonth(state, ym);
    return { ym, income: s.income, expense: s.expense, net: s.net, savings: s.savingsDeposits };
  });
}

export function categoryTrends(state: AppState, months: string[]): CategoryTrend[] {
  const map = new Map<string, Map<string, number>>();
  for (const ym of months) {
    for (const b of summarizeMonth(state, ym).expenseByCategory) {
      if (!map.has(b.id)) map.set(b.id, new Map());
      map.get(b.id)!.set(ym, b.amount);
    }
  }
  return [...map.entries()]
    .map(([categoryId, byMonth]) => {
      const rows = months.map((ym) => ({ ym, amount: byMonth.get(ym) ?? 0 }));
      const total = rows.reduce((s, r) => s + r.amount, 0);
      return { categoryId, months: rows, total, average: total / Math.max(months.length, 1) };
    })
    .sort((a, b) => b.total - a.total);
}

/** עלות שנתית משוערת של תנועה קבועה */
export function annualAmount(rec: Recurring): number {
  const perYear: Record<Recurring['frequency'], number> = {
    monthly: 12,
    bimonthly: 6,
    quarterly: 4,
    semiannual: 2,
    yearly: 1,
    weekly: 52,
  };
  return rec.amount * perYear[rec.frequency];
}

export function monthlyEquivalent(rec: Recurring): number {
  return annualAmount(rec) / 12;
}

export function categoryLookup(categories: Category[]) {
  return new Map(categories.map((c) => [c.id, c]));
}

export function accountLookup(accounts: Account[]) {
  return new Map(accounts.map((a) => [a.id, a]));
}

/** טווח החודשים שיש עליהם נתונים, עד החודש הנוכחי לכל הפחות */
export function dataMonthRange(state: AppState): { first: string; last: string } {
  let first = monthOf(todayISO());
  let last = monthOf(todayISO());
  const consider = (ym: string) => {
    if (ym < first) first = ym;
    if (ym > last) last = ym;
  };
  state.recurring.forEach((r) => consider(monthOf(r.startDate)));
  state.txns.forEach((t) => consider(monthOf(t.date)));
  state.accounts.forEach((a) => consider(monthOf(a.openingDate)));
  return { first, last };
}
