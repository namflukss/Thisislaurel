import type {
  Account,
  AppState,
  Category,
  LedgerEntry,
  OccurrenceStatus,
  Person,
  Recurring,
  SplitKind,
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

/**
 * האם שורה נכללת באיזון. סימון בשורה עצמה קודם להגדרת הקטגוריה,
 * וברירת המחדל היא הוצאה משותפת.
 */
export function resolveSplit(
  entry: { split?: SplitKind; categoryId?: string },
  categories: Map<string, Category>,
): SplitKind {
  if (entry.split) return entry.split;
  const category = entry.categoryId ? categories.get(entry.categoryId) : undefined;
  return category?.personalByDefault ? 'personal' : 'shared';
}

/**
 * למי מיוחסת הוצאה שסומנה כאישית: מי שסומן בשורה, ואם לא סומן – בעל החשבון
 * ששילם. הוצאה אישית שיצאה מחשבון משותף בלי שיוך אינה ניתנת לייחוס, ולכן
 * תיחשב משותפת (המסכים מסמנים אותה כ"חסר שיוך" כדי שאפשר יהיה לתקן).
 */
export function personalBeneficiary(
  entry: { split?: SplitKind; categoryId?: string; accountId: string; forPersonId?: string },
  categories: Map<string, Category>,
  accounts: Account[],
  persons: Person[],
): string | undefined {
  if (resolveSplit(entry, categories) !== 'personal') return undefined;
  const marked = entry.forPersonId ? persons.find((p) => p.id === entry.forPersonId) : undefined;
  if (marked?.isIndividual) return marked.id;
  const ownerId = accounts.find((a) => a.id === entry.accountId)?.ownerId;
  const owner = ownerId ? persons.find((p) => p.id === ownerId) : undefined;
  return owner?.isIndividual ? owner.id : undefined;
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
        split: rec.split,
        forPersonId: rec.forPersonId,
        shares: rec.shares,
        settles: rec.settles,
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
      split: t.split,
      forPersonId: t.forPersonId,
      shares: t.shares,
      settles: t.settles,
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
  /** הוצאות ששולמו מהחשבונות הפרטיים שלו – לא משנה מי נושא בהן */
  paidFromOwnAccount: number;
  /** חלקו במה שהחשבון המשותף שילם, לפי חלקו במימון הקופה */
  paidViaJoint: number;
  /** כסף שהעביר לקופה המשותפת, בניכוי משיכות ממנה */
  jointFunding: number;
  /** החזרים והתאמות: מה שהעביר לצד השני פחות מה שקיבל ממנו */
  settledShift: number;
  /** סך מה ששילם בפועל, כולל החזרים */
  paid: number;
  /** מה שהוא נושא בו לפי חלוקת ההוצאות – זה "החלק ההוגן" שלו */
  borne: number;
  /** מתוך זה, הוצאות שהוא נושא בהן לבד */
  personalBorne: number;
  /** חיובי = שילם מעבר למה שהוא נושא בו */
  balance: number;
  /** חלקו בהוצאות שמתחלקות לפי שיטת החלוקה הכללית */
  ratio: number;
}

export interface Settlement {
  /** סך ההוצאות בתקופה */
  totalExpense: number;
  /** הוצאות ששולמו מהחשבון המשותף */
  jointExpense: number;
  /** סך המימון נטו של הקופה המשותפת */
  jointFundingTotal: number;
  /** הוצאות שאדם אחד נושא בהן לבד */
  personalExpense: number;
  /** סך ההחזרים וההתאמות בין בני הבית בתקופה */
  settledTotal: number;
  persons: PersonSettlement[];
  /** הצעת איזון: מי מעביר למי וכמה */
  transfer?: { fromId: string; toId: string; amount: number };
  modeLabel: string;
}

/** יחס החלוקה הכללי לפי ההגדרות (שווה / יחסי להכנסות / מותאם) */
function fairRatios(
  state: AppState,
  individuals: Person[],
  incomeByPerson: Map<string, number>,
): Map<string, number> {
  const ratios = new Map<string, number>();
  const incomeTotal = individuals.reduce((s, p) => s + (incomeByPerson.get(p.id) ?? 0), 0);
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
  return ratios;
}

/**
 * מי נושא בהוצאה ובאיזה סכום – בנפרד מהשאלה מאיזה חשבון היא שולמה.
 * זה הלב של החלוקה: שכר דירה ששולם מחשבון אחד יכול להתחלק חצי-חצי,
 * והחצי של השני נרשם כהוצאה שלו.
 */
export function expenseBearers(
  entry: {
    amount: number;
    split?: SplitKind;
    categoryId?: string;
    accountId: string;
    forPersonId?: string;
    shares?: Record<string, number>;
  },
  categories: Map<string, Category>,
  accounts: Account[],
  persons: Person[],
  ratios: Map<string, number>,
): Map<string, number> {
  const individuals = persons.filter((p) => p.isIndividual);
  const out = new Map<string, number>();
  const kind = resolveSplit(entry, categories);

  if (kind === 'personal') {
    const who = personalBeneficiary(entry, categories, accounts, persons);
    if (who) {
      out.set(who, entry.amount);
      return out;
    }
    // אין למי לשייך – חוזרים לחלוקה הכללית
  }

  if (kind === 'equal' && individuals.length) {
    for (const p of individuals) out.set(p.id, entry.amount / individuals.length);
    return out;
  }

  if (kind === 'ratio' && entry.shares) {
    const total = individuals.reduce((s, p) => s + Math.max(0, entry.shares?.[p.id] ?? 0), 0);
    if (total > 0) {
      for (const p of individuals) {
        const share = Math.max(0, entry.shares[p.id] ?? 0);
        if (share) out.set(p.id, (entry.amount * share) / total);
      }
      return out;
    }
  }

  for (const p of individuals) {
    const share = ratios.get(p.id) ?? 0;
    if (share) out.set(p.id, entry.amount * share);
  }
  return out;
}

/** תיאור קצר של אופן החלוקה של שורה, לתצוגה */
export function splitLabel(
  entry: { split?: SplitKind; categoryId?: string; accountId: string; forPersonId?: string; shares?: Record<string, number> },
  categories: Map<string, Category>,
  accounts: Account[],
  persons: Person[],
): string | undefined {
  const kind = resolveSplit(entry, categories);
  if (kind === 'personal') {
    const who = personalBeneficiary(entry, categories, accounts, persons);
    const name = persons.find((p) => p.id === who)?.name;
    return name ? `אישי · ${name}` : 'אישי · חסר שיוך';
  }
  if (kind === 'equal') return 'חצי-חצי';
  if (kind === 'ratio' && entry.shares) {
    const individuals = persons.filter((p) => p.isIndividual);
    const total = individuals.reduce((s, p) => s + Math.max(0, entry.shares?.[p.id] ?? 0), 0);
    if (total > 0) {
      return individuals
        .map((p) => `${Math.round((Math.max(0, entry.shares?.[p.id] ?? 0) / total) * 100)}%`)
        .join(' / ');
    }
  }
  return undefined;
}

/**
 * ההתחשבנות. שני צדדים לכל הוצאה: מי שילם אותה, ומי נושא בה.
 * המאזן של כל אחד = מה ששילם (מהחשבון הפרטי + חלקו במה שהמשותף שילם
 * + החזרים שהעביר) פחות מה שהוא נושא בו.
 */
export function settle(state: AppState, months: string[]): Settlement {
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const personById = new Map(state.persons.map((p) => [p.id, p]));
  const categories = categoryLookup(state.categories);
  const isJointAccount = (id: string) => {
    const owner = accountById.get(id)?.ownerId;
    return owner ? personById.get(owner)?.isIndividual === false : false;
  };
  const individuals = state.persons.filter((p) => p.isIndividual);

  // הכנסות נחוצות לפני חישוב היחסים, ולכן מעבר ראשון קצר
  const incomeByPerson = new Map<string, number>();
  const entriesByMonth = months.map((ym) => activeEntries(buildLedger(state, ym)));
  for (const entries of entriesByMonth) {
    for (const e of entries) {
      if (e.type !== 'income') continue;
      const person = e.personId ?? accountById.get(e.accountId)?.ownerId;
      if (person) bump(incomeByPerson, person, e.amount);
    }
  }
  const ratios = fairRatios(state, individuals, incomeByPerson);

  const paidFromOwn = new Map<string, number>();
  const borne = new Map<string, number>();
  const personalBorne = new Map<string, number>();
  const jointFunding = new Map<string, number>();
  const settledShift = new Map<string, number>();
  let jointExpense = 0;
  let totalExpense = 0;
  let personalExpense = 0;
  let settledTotal = 0;

  for (const entries of entriesByMonth) {
    for (const e of entries) {
      if (e.type === 'expense') {
        totalExpense += e.amount;
        const ownerId = accountById.get(e.accountId)?.ownerId;
        if (isJointAccount(e.accountId)) jointExpense += e.amount;
        else if (ownerId && personById.get(ownerId)?.isIndividual) bump(paidFromOwn, ownerId, e.amount);

        const bearers = expenseBearers(e, categories, state.accounts, state.persons, ratios);
        for (const [personId, amount] of bearers) bump(borne, personId, amount);
        if (resolveSplit(e, categories) === 'personal' && bearers.size === 1) {
          personalExpense += e.amount;
          for (const [personId, amount] of bearers) bump(personalBorne, personId, amount);
        }
      } else if (e.type === 'income') {
        const person = e.personId ?? accountById.get(e.accountId)?.ownerId;
        // הכנסה של אדם פרטי שנכנסת ישירות לחשבון המשותף היא מימון של הקופה
        if (person && personById.get(person)?.isIndividual && isJointAccount(e.accountId)) {
          bump(jointFunding, person, e.amount);
        }
      } else if (e.type === 'transfer') {
        const fromJoint = isJointAccount(e.accountId);
        const toJoint = e.toAccountId ? isJointAccount(e.toAccountId) : false;
        const fromOwner = accountById.get(e.accountId)?.ownerId;
        const toOwner = e.toAccountId ? accountById.get(e.toAccountId)?.ownerId : undefined;

        if (!fromJoint && toJoint && fromOwner) {
          bump(jointFunding, fromOwner, e.amount);
        } else if (fromJoint && !toJoint && toOwner) {
          // משיכה מהקופה המשותפת לחשבון פרטי מקטינה את המימון של אותו אדם
          bump(jointFunding, toOwner, -e.amount);
        } else if (!fromJoint && !toJoint && fromOwner && toOwner && fromOwner !== toOwner) {
          // העברה בין שני חשבונות פרטיים – החזר שמאזן בינינו, אלא אם סומן אחרת
          if (e.settles !== false) {
            bump(settledShift, fromOwner, e.amount);
            bump(settledShift, toOwner, -e.amount);
            settledTotal += e.amount;
          }
        }
      }
    }
  }

  // התאמות ידניות שנרשמו בטווח התאריכים של הדוח
  const from = `${months[0]}-01`;
  const to = `${months[months.length - 1]}-31`;
  for (const adj of state.adjustments ?? []) {
    if (adj.date < from || adj.date > to) continue;
    if (!personById.get(adj.fromPersonId)?.isIndividual) continue;
    if (!personById.get(adj.toPersonId)?.isIndividual) continue;
    bump(settledShift, adj.fromPersonId, adj.amount);
    bump(settledShift, adj.toPersonId, -adj.amount);
    settledTotal += adj.amount;
  }

  const jointFundingTotal = individuals.reduce((s, p) => s + (jointFunding.get(p.id) ?? 0), 0);

  const persons: PersonSettlement[] = individuals.map((p) => {
    const funding = jointFunding.get(p.id) ?? 0;
    const fundingShare = jointFundingTotal > 0 ? funding / jointFundingTotal : (ratios.get(p.id) ?? 0);
    const fromOwn = paidFromOwn.get(p.id) ?? 0;
    const viaJoint = jointExpense * fundingShare;
    const shift = settledShift.get(p.id) ?? 0;
    const paid = fromOwn + viaJoint + shift;
    const owes = borne.get(p.id) ?? 0;
    return {
      personId: p.id,
      income: incomeByPerson.get(p.id) ?? 0,
      paidFromOwnAccount: fromOwn,
      paidViaJoint: viaJoint,
      jointFunding: funding,
      settledShift: shift,
      paid,
      borne: owes,
      personalBorne: personalBorne.get(p.id) ?? 0,
      balance: paid - owes,
      ratio: ratios.get(p.id) ?? 0,
    };
  });

  let transfer: Settlement['transfer'];
  if (persons.length === 2) {
    const [a, b] = persons;
    const diff = (a.balance - b.balance) / 2;
    if (Math.abs(diff) >= 1) {
      transfer =
        diff > 0
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

  return {
    totalExpense,
    jointExpense,
    jointFundingTotal,
    personalExpense,
    settledTotal,
    persons,
    transfer,
    modeLabel,
  };
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
