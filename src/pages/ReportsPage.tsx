import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, Stat, Toggle } from '../components/ui';
import { DivergingBar, RankBars, StackedShare, TrendColumns } from '../components/charts';
import { buildLedger, categoryTrends, monthlyTotals, settle, summarizeMonth } from '../lib/compute';
import { formatDate, lastMonths, monthLabel, shortMonthLabel } from '../lib/dates';
import { personColor, STATUS_LABEL, TYPE_LABEL } from '../lib/colors';

const RANGES = [
  { value: '3', label: '3 חודשים' },
  { value: '6', label: '6 חודשים' },
  { value: '12', label: '12 חודשים' },
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  // BOM כדי שאקסל יזהה עברית ב-UTF-8
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage({ ym }: { ym: string }) {
  const { state } = useStore();
  const { money, signed } = useMoneyFormat();
  const [range, setRange] = useState('12');

  const months = useMemo(() => lastMonths(ym, Number(range)), [ym, range]);
  const totals = useMemo(() => monthlyTotals(state, months), [state, months]);
  const trends = useMemo(() => categoryTrends(state, months), [state, months]);
  const settlement = useMemo(() => settle(state, months), [state, months]);

  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const accountById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);
  const personById = useMemo(() => new Map(state.persons.map((p) => [p.id, p])), [state.persons]);

  const income = totals.reduce((s, t) => s + t.income, 0);
  const expense = totals.reduce((s, t) => s + t.expense, 0);
  const savings = totals.reduce((s, t) => s + t.savings, 0);
  const net = income - expense;
  const savingsRate = income ? (net / income) * 100 : 0;

  /** סיכומים לפי חשבון ולפי אדם על כל הטווח */
  const byAccount = useMemo(() => {
    const out = new Map<string, number>();
    const inc = new Map<string, number>();
    const trIn = new Map<string, number>();
    const trOut = new Map<string, number>();
    for (const m of months) {
      for (const e of buildLedger(state, m)) {
        if (e.status === 'skipped') continue;
        if (e.type === 'income') inc.set(e.accountId, (inc.get(e.accountId) ?? 0) + e.amount);
        else if (e.type === 'expense') out.set(e.accountId, (out.get(e.accountId) ?? 0) + e.amount);
        else {
          trOut.set(e.accountId, (trOut.get(e.accountId) ?? 0) + e.amount);
          if (e.toAccountId) trIn.set(e.toAccountId, (trIn.get(e.toAccountId) ?? 0) + e.amount);
        }
      }
    }
    return state.accounts.map((a) => ({
      account: a,
      out: out.get(a.id) ?? 0,
      in: inc.get(a.id) ?? 0,
      transferIn: trIn.get(a.id) ?? 0,
      transferOut: trOut.get(a.id) ?? 0,
    }));
  }, [state, months]);

  const byPerson = useMemo(() => {
    const inc = new Map<string, number>();
    const out = new Map<string, number>();
    for (const m of months) {
      const s = summarizeMonth(state, m);
      for (const b of s.incomeByPerson) inc.set(b.id, (inc.get(b.id) ?? 0) + b.amount);
      for (const b of s.expenseByPayer) out.set(b.id, (out.get(b.id) ?? 0) + b.amount);
    }
    return state.persons.map((p) => ({ person: p, income: inc.get(p.id) ?? 0, expense: out.get(p.id) ?? 0 }));
  }, [state, months]);

  const groupTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const m of months) {
      for (const b of summarizeMonth(state, m).expenseByGroup) map.set(b.id, (map.get(b.id) ?? 0) + b.amount);
    }
    return [...map.entries()].map(([id, amount]) => ({ id, amount })).sort((a, b) => b.amount - a.amount);
  }, [state, months]);

  const exportLedger = () => {
    const rows: (string | number)[][] = [
      ['תאריך', 'תיאור', 'סוג', 'קטגוריה', 'קבוצה', 'חשבון', 'בעל החשבון', 'לחשבון', 'מקור', 'סטטוס', 'סכום'],
    ];
    for (const m of months) {
      for (const e of buildLedger(state, m)) {
        const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
        const acc = accountById.get(e.accountId);
        rows.push([
          formatDate(e.date),
          e.name,
          TYPE_LABEL[e.type],
          cat?.name ?? '',
          cat?.group ?? '',
          acc?.name ?? '',
          personById.get(acc?.ownerId ?? '')?.name ?? '',
          e.toAccountId ? accountById.get(e.toAccountId)?.name ?? '' : '',
          e.source === 'recurring' ? 'קבוע' : 'חד-פעמי',
          STATUS_LABEL[e.status],
          e.type === 'expense' ? -e.amount : e.amount,
        ]);
      }
    }
    downloadCsv(`תזרים-${months[0]}-עד-${months[months.length - 1]}.csv`, rows);
  };

  const exportCategories = () => {
    const rows: (string | number)[][] = [['קטגוריה', 'קבוצה', ...months.map(shortMonthLabel), 'סה״כ', 'ממוצע חודשי']];
    for (const t of trends) {
      const c = categoryById.get(t.categoryId);
      rows.push([c?.name ?? t.categoryId, c?.group ?? '', ...t.months.map((m) => Math.round(m.amount)), Math.round(t.total), Math.round(t.average)]);
    }
    downloadCsv(`קטגוריות-${months[0]}-עד-${months[months.length - 1]}.csv`, rows);
  };

  return (
    <>
      <div className="toolbar">
        <Toggle options={RANGES} value={range} onChange={setRange} ariaLabel="טווח הדוח" />
        <span className="small muted">
          {monthLabel(months[0])} – {monthLabel(months[months.length - 1])}
        </span>
        <span className="spacer" />
        <button type="button" className="btn small" onClick={exportLedger}>
          ייצוא תזרים ל-CSV
        </button>
        <button type="button" className="btn small" onClick={exportCategories}>
          ייצוא קטגוריות ל-CSV
        </button>
      </div>

      <div className="grid grid-4">
        <Stat label="סך הכנסות" value={money(income)} color="var(--income)" foot={`${money(income / months.length)} בממוצע לחודש`} />
        <Stat label="סך הוצאות" value={money(expense)} color="var(--expense)" foot={`${money(expense / months.length)} בממוצע לחודש`} />
        <Stat label="מאזן מצטבר" value={signed(net)} foot={`שיעור חיסכון ${savingsRate.toFixed(0)}%`} />
        <Stat label="הופקד לחיסכון" value={money(savings)} foot="העברות לחשבונות חיסכון" />
      </div>

      <Card title="מגמת הכנסות והוצאות" subtitle={`${months.length} חודשים אחרונים`}>
        <TrendColumns data={totals.map((t) => ({ ym: t.ym, income: t.income, expense: t.expense }))} />
      </Card>

      <Card
        title="התחשבנות בין בני הבית"
        subtitle={`${settlement.modeLabel} · מחושב על ${months.length} חודשים. ההוצאות מהחשבון המשותף מיוחסות לפי חלקו של כל אחד במימון החשבון.`}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>שם</th>
                <th className="num">הכנסות</th>
                <th className="num">שולם מהחשבון הפרטי</th>
                <th className="num">הועבר למשותף</th>
                <th className="num">חלק בהוצאות המשותפות</th>
                <th className="num">סה״כ נשא</th>
                <th className="num">החלק ההוגן</th>
                <th className="num">מאזן</th>
                <th style={{ width: 120 }}>עודף / חוסר</th>
              </tr>
            </thead>
            <tbody>
              {settlement.persons.map((p) => (
                <tr key={p.personId}>
                  <td>
                    <span className="name-cell">
                      <i className="swatch" style={{ background: personColor(state.persons, p.personId) }} />
                      {personById.get(p.personId)?.name}
                      <span className="pill muted">{Math.round(p.ratio * 100)}%</span>
                    </span>
                  </td>
                  <td className="num">{money(p.income)}</td>
                  <td className="num">{money(p.personalExpense)}</td>
                  <td className="num">{money(p.jointFunding)}</td>
                  <td className="num">{money(p.jointShareAmount)}</td>
                  <td className="num">{money(p.borne)}</td>
                  <td className="num muted">{money(p.fairShare)}</td>
                  <td className="num" style={{ color: p.balance >= 0 ? 'var(--income)' : 'var(--expense)', fontWeight: 700 }}>
                    {signed(p.balance)}
                  </td>
                  <td>
                    <DivergingBar
                      value={p.balance}
                      max={Math.max(...settlement.persons.map((x) => Math.abs(x.balance)), 1)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>סה״כ</td>
                <td className="num">{money(income)}</td>
                <td className="num">{money(settlement.totalExpense - settlement.jointExpense)}</td>
                <td className="num">{money(settlement.jointFundingTotal)}</td>
                <td className="num">{money(settlement.jointExpense)}</td>
                <td className="num">{money(settlement.totalExpense)}</td>
                <td className="num">{money(settlement.totalExpense)}</td>
                <td className="num">—</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        {settlement.transfer ? (
          <div className="tip" style={{ marginTop: 12 }}>
            <strong>{personById.get(settlement.transfer.fromId)?.name}</strong> צריך/ה להעביר{' '}
            <strong>{money(settlement.transfer.amount)}</strong> ל
            <strong>{personById.get(settlement.transfer.toId)?.name}</strong> כדי לאזן את התקופה.
            שיטת החלוקה נקבעת במסך ההגדרות.
          </div>
        ) : (
          <div className="tip" style={{ marginTop: 12 }}>
            החלוקה מאוזנת – אין צורך בהעברת כספים בין בני הבית בתקופה זו.
          </div>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="לאן הלך הכסף" subtitle={`הוצאות לפי קבוצה, ${months.length} חודשים`}>
          <RankBars rows={groupTotals.map((g) => ({ id: g.id, label: g.id, value: g.amount }))} />
        </Card>

        <Card title="מי שילם על מה" subtitle="חלוקת ההוצאות לפי החשבון שממנו שולמו">
          <StackedShare
            segments={byPerson
              .filter((p) => p.expense > 0)
              .map((p) => ({
                id: p.person.id,
                label: p.person.name,
                value: p.expense,
                color: personColor(state.persons, p.person.id),
              }))}
          />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>שם</th>
                  <th className="num">הכנסות</th>
                  <th className="num">הוצאות ששולמו</th>
                  <th className="num">הפרש</th>
                </tr>
              </thead>
              <tbody>
                {byPerson.map((p) => (
                  <tr key={p.person.id}>
                    <td>
                      <span className="name-cell">
                        <i className="swatch" style={{ background: personColor(state.persons, p.person.id) }} />
                        {p.person.name}
                      </span>
                    </td>
                    <td className="num amount-in">{money(p.income)}</td>
                    <td className="num amount-out">{money(p.expense)}</td>
                    <td className="num">{signed(p.income - p.expense)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card title="סיכום חודשי" subtitle="שורה לכל חודש, כולל ממוצעים">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>חודש</th>
                <th className="num">הכנסות</th>
                <th className="num">הוצאות</th>
                <th className="num">מאזן</th>
                <th className="num">לחיסכון</th>
                <th className="num">שיעור חיסכון</th>
              </tr>
            </thead>
            <tbody>
              {[...totals].reverse().map((t) => (
                <tr key={t.ym}>
                  <td>{monthLabel(t.ym)}</td>
                  <td className="num amount-in">{money(t.income)}</td>
                  <td className="num amount-out">{money(t.expense)}</td>
                  <td className="num" style={{ color: t.net >= 0 ? 'var(--income)' : 'var(--expense)', fontWeight: 600 }}>
                    {signed(t.net)}
                  </td>
                  <td className="num muted">{t.savings ? money(t.savings) : '—'}</td>
                  <td className="num muted">{t.income ? `${Math.round((t.net / t.income) * 100)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>ממוצע חודשי</td>
                <td className="num">{money(income / months.length)}</td>
                <td className="num">{money(expense / months.length)}</td>
                <td className="num">{signed(net / months.length)}</td>
                <td className="num">{money(savings / months.length)}</td>
                <td className="num">{savingsRate.toFixed(0)}%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card title="קטגוריות לאורך זמן" subtitle="סך ההוצאה בכל קטגוריה, וממוצע חודשי – בסיס לעדכון תקציבים">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>קטגוריה</th>
                <th>קבוצה</th>
                {[...months].reverse().map((m) => (
                  <th key={m} className="num">
                    {shortMonthLabel(m)}
                  </th>
                ))}
                <th className="num">סה״כ</th>
                <th className="num">ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((t) => {
                const c = categoryById.get(t.categoryId);
                return (
                  <tr key={t.categoryId}>
                    <td>
                      <span className="name-cell">
                        <span className="emoji">{c?.emoji}</span>
                        {c?.name ?? 'ללא קטגוריה'}
                      </span>
                    </td>
                    <td className="small muted">{c?.group}</td>
                    {[...t.months].reverse().map((m) => (
                      <td key={m.ym} className="num small">
                        {m.amount ? money(m.amount) : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td className="num">{money(t.total)}</td>
                    <td className="num muted">{money(t.average)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="תנועה לפי חשבון" subtitle={`סך ההכנסות, ההוצאות וההעברות בכל חשבון, ${months.length} חודשים`}>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>חשבון</th>
                <th>בעלים</th>
                <th className="num">הכנסות</th>
                <th className="num">הוצאות</th>
                <th className="num">העברות נכנסות</th>
                <th className="num">העברות יוצאות</th>
                <th className="num">שינוי נטו</th>
              </tr>
            </thead>
            <tbody>
              {byAccount.map((r) => (
                <tr key={r.account.id}>
                  <td>
                    <span className="name-cell">
                      <i className="swatch" style={{ background: personColor(state.persons, r.account.ownerId) }} />
                      {r.account.name}
                    </span>
                  </td>
                  <td className="small muted">{personById.get(r.account.ownerId)?.name}</td>
                  <td className="num amount-in">{money(r.in)}</td>
                  <td className="num amount-out">{money(r.out)}</td>
                  <td className="num amount-neutral">{money(r.transferIn)}</td>
                  <td className="num amount-neutral">{money(r.transferOut)}</td>
                  <td className="num">{signed(r.in - r.out + r.transferIn - r.transferOut)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
