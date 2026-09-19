import { useMemo, useState } from 'react';
import { newId, useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, Field, Modal, Stat, Toggle } from '../components/ui';
import { DivergingBar, RankBars, StackedShare, TrendColumns } from '../components/charts';
import { buildLedger, categoryTrends, monthlyTotals, settle, summarizeMonth } from '../lib/compute';
import { formatDate, lastMonths, monthLabel, shortMonthLabel, todayISO } from '../lib/dates';
import { accountColor, personColor, STATUS_LABEL, TYPE_LABEL } from '../lib/colors';
import { saveFile } from '../lib/platform';
import { plural } from '../lib/text';
import type { SettlementRecord } from '../types';

const RANGES = [
  { value: '1', label: 'החודש' },
  { value: '3', label: '3 חודשים' },
  { value: '6', label: '6 חודשים' },
  { value: '12', label: '12 חודשים' },
];

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const body = rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  // BOM כדי שאקסל יזהה עברית ב-UTF-8
  void saveFile(filename, '\uFEFF' + body, 'text/csv;charset=utf-8;');
}

/** תיאור התקופה שעליה מדובר – חודש בודד או טווח */
function periodLabel(from: string, to: string): string {
  return from === to ? monthLabel(from) : `${monthLabel(from)} – ${monthLabel(to)}`;
}

export default function ReportsPage({ ym }: { ym: string }) {
  const { state, dispatch } = useStore();
  const { money, signed } = useMoneyFormat();
  const [range, setRange] = useState('12');
  const [settling, setSettling] = useState(false);

  const months = useMemo(() => lastMonths(ym, Number(range)), [ym, range]);
  const totals = useMemo(() => monthlyTotals(state, months), [state, months]);
  const trends = useMemo(() => categoryTrends(state, months), [state, months]);
  const settlement = useMemo(() => settle(state, months), [state, months]);

  const fromMonth = months[0];
  const toMonth = months[months.length - 1];
  const settledRecord = (state.settlements ?? []).find(
    (r) => r.fromMonth === fromMonth && r.toMonth === toMonth,
  );
  const pastSettlements = [...(state.settlements ?? [])]
    .filter((r) => r.id !== settledRecord?.id)
    .sort((a, b) => b.settledOn.localeCompare(a.settledOn));

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
        <Stat
          label="סך הכנסות"
          value={money(income)}
          color="var(--income)"
          foot={months.length > 1 ? `${money(income / months.length)} בממוצע לחודש` : undefined}
        />
        <Stat
          label="סך הוצאות"
          value={money(expense)}
          color="var(--expense)"
          foot={months.length > 1 ? `${money(expense / months.length)} בממוצע לחודש` : undefined}
        />
        <Stat label="מאזן מצטבר" value={signed(net)} foot={`שיעור חיסכון ${savingsRate.toFixed(0)}%`} />
        <Stat label="הופקד לחיסכון" value={money(savings)} foot="העברות לחשבונות חיסכון" />
      </div>

      <Card title="מגמת הכנסות והוצאות" subtitle={months.length === 1 ? monthLabel(months[0]) : `${months.length} חודשים אחרונים`}>
        <TrendColumns data={totals.map((t) => ({ ym: t.ym, income: t.income, expense: t.expense }))} />
      </Card>

      <Card
        title="התחשבנות בין בני הבית"
        subtitle={`${settlement.modeLabel} · מחושב על ${plural(months.length, 'חודש', 'חודשים')}. לכל הוצאה יש מי ששילמה אותה ומי שנושאת בה – וזה לא בהכרח אותו אדם. המאזן הוא ההפרש בין השניים.`}
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>שם</th>
                <th className="num">הכנסות</th>
                <th className="num">שילמה מהפרטי</th>
                <th className="num">דרך המשותף</th>
                <th className="num">החזרים והתאמות</th>
                <th className="num">סה״כ שילמה</th>
                <th className="num">נושאת ב-</th>
                <th className="num">מאזן</th>
                <th style={{ width: 110 }}>עודף / חוסר</th>
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
                  <td className="num">{money(p.paidFromOwnAccount)}</td>
                  <td className="num">{money(p.paidViaJoint)}</td>
                  <td className="num">{p.settledShift ? signed(p.settledShift) : '—'}</td>
                  <td className="num">{money(p.paid)}</td>
                  <td className="num">
                    {money(p.borne)}
                    {p.personalBorne > 0 && <div className="small muted">{money(p.personalBorne)} אישי</div>}
                  </td>
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
                <td className="num">
                  {money(settlement.persons.reduce((sum, p) => sum + p.paidFromOwnAccount, 0))}
                </td>
                <td className="num">{money(settlement.jointExpense)}</td>
                <td className="num">—</td>
                <td className="num">{money(settlement.totalExpense)}</td>
                <td className="num">{money(settlement.totalExpense)}</td>
                <td className="num">—</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
          מתוך {money(settlement.totalExpense)} הוצאות בתקופה,{' '}
          {settlement.personalExpense > 0
            ? `${money(settlement.personalExpense)} נושא בהן אדם אחד לבד`
            : 'הכול מתחלק בין שתיכן'}
          {settlement.settledTotal > 0 && ` · ${money(settlement.settledTotal)} כבר הועברו ביניכן`}. את אופן החלוקה
          של כל שורה אפשר לשנות בתזרים החודשי או בטופס שלה.
        </p>

        {settledRecord ? (
          <div className="tip settled" style={{ marginTop: 12 }}>
            <span className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span>
                <span className="badge-status paid" style={{ marginInlineEnd: 8 }}>
                  הוסדר
                </span>
                <strong>{personById.get(settledRecord.fromPersonId)?.name}</strong> העביר/ה{' '}
                <strong>{money(settledRecord.amount)}</strong> ל
                <strong>{personById.get(settledRecord.toPersonId)?.name}</strong> בתאריך{' '}
                {formatDate(settledRecord.settledOn)}
                {settledRecord.txnId && <span className="muted small"> · ההעברה נרשמה ביומן התנועות</span>}
              </span>
              <button
                type="button"
                className="btn small ghost"
                onClick={() => dispatch({ type: 'settlement/delete', id: settledRecord.id })}
              >
                ביטול הסימון
              </button>
            </span>
          </div>
        ) : settlement.transfer ? (
          <div className="tip" style={{ marginTop: 12 }}>
            <span className="row-between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <span>
                <span className="badge-status pending" style={{ marginInlineEnd: 8 }}>
                  טרם הוסדר
                </span>
                <strong>{personById.get(settlement.transfer.fromId)?.name}</strong> משלים/ה{' '}
                <strong>{money(settlement.transfer.amount)}</strong> ל
                <strong>{personById.get(settlement.transfer.toId)?.name}</strong> כדי לסגור את התקופה
                באיזון. שיטת החלוקה נקבעת במסך ההגדרות.
              </span>
              <button type="button" className="btn small primary" onClick={() => setSettling(true)}>
                סימון כהוסדר
              </button>
            </span>
          </div>
        ) : (
          <div className="tip" style={{ marginTop: 12 }}>
            החלוקה מאוזנת – אין צורך בהעברה בין בני הבית בתקופה זו.
          </div>
        )}

        <AdjustmentsSection months={months} />

        {pastSettlements.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <h3 style={{ fontSize: 14, marginBottom: 6 }}>איזונים קודמים</h3>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>תקופה</th>
                    <th>מי השלים</th>
                    <th className="num">סכום</th>
                    <th>תאריך</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pastSettlements.map((r) => (
                    <tr key={r.id}>
                      <td>{periodLabel(r.fromMonth, r.toMonth)}</td>
                      <td className="small">
                        {personById.get(r.fromPersonId)?.name} ← {personById.get(r.toPersonId)?.name}
                      </td>
                      <td className="num">{money(r.amount)}</td>
                      <td className="small muted nums">{formatDate(r.settledOn)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => dispatch({ type: 'settlement/delete', id: r.id })}
                        >
                          ביטול
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-2">
        <Card title="לאן הלך הכסף" subtitle={`הוצאות לפי קבוצה, ${plural(months.length, 'חודש', 'חודשים')}`}>
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

      <Card title="קטגוריות לאורך זמן" subtitle="סך ההוצאה בכל קטגוריה וממוצע חודשי – כדי לראות לאן הכסף הולך לאורך זמן">
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
                        {c?.color && <i className="swatch" style={{ background: c.color }} />}
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

      {settling && settlement.transfer && (
        <SettleModal
          fromMonth={fromMonth}
          toMonth={toMonth}
          fromPersonId={settlement.transfer.fromId}
          toPersonId={settlement.transfer.toId}
          amount={settlement.transfer.amount}
          onClose={() => setSettling(false)}
        />
      )}

      <Card title="תנועה לפי חשבון" subtitle={`סך ההכנסות, ההוצאות וההעברות בכל חשבון, ${plural(months.length, 'חודש', 'חודשים')}`}>
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
                      <i className="swatch" style={{ background: accountColor(state.accounts, state.persons, r.account.id) }} />
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

/**
 * התאמות ידניות לאיזון – מזומן, העברה שלא נרשמה, או הוצאה ששולמה עבור השנייה
 * ולא נכנסה לאפליקציה. כל שורה מזיזה את המאזן ישירות.
 */
function AdjustmentsSection({ months }: { months: string[] }) {
  const { state, dispatch } = useStore();
  const { money } = useMoneyFormat();
  const individuals = state.persons.filter((p) => p.isIndividual);
  const personName = (id: string) => state.persons.find((p) => p.id === id)?.name ?? '';

  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [fromPersonId, setFromPersonId] = useState(individuals[0]?.id ?? '');
  const [toPersonId, setToPersonId] = useState(individuals[1]?.id ?? individuals[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());

  const from = `${months[0]}-01`;
  const to = `${months[months.length - 1]}-31`;
  const rows = (state.adjustments ?? [])
    .filter((a) => a.date >= from && a.date <= to)
    .sort((a, b) => b.date.localeCompare(a.date));

  const value = Math.abs(Number(amount.replace(/[^\d.-]/g, ''))) || 0;
  const valid = value > 0 && !!description.trim() && fromPersonId !== toPersonId;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    dispatch({
      type: 'adjustment/save',
      adjustment: {
        id: newId('adj'),
        date,
        description: description.trim(),
        amount: value,
        fromPersonId,
        toPersonId,
      },
    });
    setDescription('');
    setAmount('');
  };

  return (
    <div style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: 14, marginBottom: 4 }}>התאמות ידניות</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        כל שורה כאן מזיזה את המאזן: מי שילמה או העבירה, ועבור מי. שימושי למזומן, להעברה שלא נרשמה
        באפליקציה, או להוצאה ששולמה עבור השנייה.
      </p>

      <form onSubmit={add} className="toolbar" style={{ marginBottom: 10 }}>
        <input
          type="text"
          placeholder="תיאור, למשל: מזומן עבור הגן"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="תיאור ההתאמה"
          style={{ minWidth: 190 }}
        />
        <input
          inputMode="decimal"
          placeholder="סכום"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="סכום ההתאמה"
          style={{ width: 96 }}
        />
        <select value={fromPersonId} onChange={(e) => setFromPersonId(e.target.value)} aria-label="מי שילמה">
          {individuals.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} שילמה
            </option>
          ))}
        </select>
        <select value={toPersonId} onChange={(e) => setToPersonId(e.target.value)} aria-label="עבור מי">
          {individuals.map((p) => (
            <option key={p.id} value={p.id}>
              עבור {p.name}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="תאריך ההתאמה" />
        <button type="submit" className="btn primary small" disabled={!valid}>
          הוספה
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="small muted" style={{ margin: 0 }}>
          אין התאמות בתקופה הזו.
        </p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>תאריך</th>
                <th>תיאור</th>
                <th>מי שילמה</th>
                <th>עבור מי</th>
                <th className="num">סכום</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="small muted nums">{formatDate(a.date)}</td>
                  <td>{a.description}</td>
                  <td className="small">
                    <span className="name-cell">
                      <i className="swatch" style={{ background: personColor(state.persons, a.fromPersonId) }} />
                      {personName(a.fromPersonId)}
                    </span>
                  </td>
                  <td className="small">
                    <span className="name-cell">
                      <i className="swatch" style={{ background: personColor(state.persons, a.toPersonId) }} />
                      {personName(a.toPersonId)}
                    </span>
                  </td>
                  <td className="num">{money(a.amount)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => dispatch({ type: 'adjustment/delete', id: a.id })}
                    >
                      מחיקה
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * סימון שהאיזון בוצע: רישום התאריך והסכום, ואפשרות לרשום גם את ההעברה
 * עצמה בין החשבונות הפרטיים, כדי שהיתרות יישארו נכונות.
 */
function SettleModal({
  fromMonth,
  toMonth,
  fromPersonId,
  toPersonId,
  amount: suggested,
  onClose,
}: {
  fromMonth: string;
  toMonth: string;
  fromPersonId: string;
  toPersonId: string;
  amount: number;
  onClose: () => void;
}) {
  const { state, dispatch } = useStore();
  const { money } = useMoneyFormat();
  const personById = new Map(state.persons.map((p) => [p.id, p]));
  const accountsOf = (personId: string) => state.accounts.filter((a) => a.ownerId === personId);

  const [amount, setAmount] = useState(String(Math.round(suggested)));
  const [date, setDate] = useState(todayISO());
  const [recordTransfer, setRecordTransfer] = useState(true);
  const [fromAccountId, setFromAccountId] = useState(accountsOf(fromPersonId)[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(accountsOf(toPersonId)[0]?.id ?? '');

  const value = Math.abs(Number(amount.replace(/[^\d.-]/g, ''))) || 0;
  const canRecord = recordTransfer && fromAccountId && toAccountId && fromAccountId !== toAccountId;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const record: SettlementRecord = {
      id: newId('s'),
      fromMonth,
      toMonth,
      fromPersonId,
      toPersonId,
      amount: value,
      settledOn: date,
    };
    if (canRecord) {
      const txnId = newId('t');
      dispatch({
        type: 'txn/save',
        txn: {
          id: txnId,
          date,
          type: 'transfer',
          name: `איזון ${periodLabel(fromMonth, toMonth)}`,
          amount: value,
          accountId: fromAccountId,
          toAccountId,
          note: `השלמת איזון בין ${personById.get(fromPersonId)?.name} ל${personById.get(toPersonId)?.name}`,
        },
      });
      record.txnId = txnId;
    }
    dispatch({ type: 'settlement/save', record });
    onClose();
  };

  return (
    <Modal title={`סימון איזון – ${periodLabel(fromMonth, toMonth)}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="small muted" style={{ marginTop: 0 }}>
          לפי החישוב, {personById.get(fromPersonId)?.name} משלים/ה {money(suggested)} ל
          {personById.get(toPersonId)?.name}. אפשר לשנות את הסכום אם הועבר סכום אחר.
        </p>
        <div className="form-grid">
          <Field label="סכום שהועבר (₪)">
            <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="תאריך ההעברה">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <div className="full">
            <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={recordTransfer}
                onChange={(e) => setRecordTransfer(e.target.checked)}
              />
              לרשום גם את ההעברה בפועל בין החשבונות
            </label>
          </div>
          {recordTransfer && (
            <>
              <Field label="מהחשבון">
                <select value={fromAccountId} onChange={(e) => setFromAccountId(e.target.value)}>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="לחשבון">
                <select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
                  {state.accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button type="submit" className="btn primary" disabled={!value}>
            סימון כהוסדר
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}
