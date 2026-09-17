import { useMemo } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, EmptyState, Stat } from '../components/ui';
import { RankBars, StackedShare, TrendColumns } from '../components/charts';
import {
  accountBalances,
  monthlyTotals,
  settle,
  summarizeMonth,
} from '../lib/compute';
import { addMonths, formatDate, lastMonths, monthLabel, todayISO } from '../lib/dates';
import { accountColor, personColor } from '../lib/colors';
import { plural } from '../lib/text';

export default function Dashboard({ ym, onNavigate }: { ym: string; onNavigate: (tab: string) => void }) {
  const { state } = useStore();
  const { money, signed } = useMoneyFormat();

  const summary = useMemo(() => summarizeMonth(state, ym), [state, ym]);
  const prev = useMemo(() => summarizeMonth(state, addMonths(ym, -1)), [state, ym]);
  const trend = useMemo(() => monthlyTotals(state, lastMonths(ym, 12)), [state, ym]);
  const balances = useMemo(() => accountBalances(state), [state]);
  const settlement = useMemo(() => settle(state, [ym]), [state, ym]);

  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const personById = useMemo(() => new Map(state.persons.map((p) => [p.id, p])), [state.persons]);

  const expenseDelta = summary.expense - prev.expense;
  const topCategories = summary.expenseByCategory.slice(0, 8).map((b) => {
    const c = categoryById.get(b.id);
    return { id: b.id, label: c?.name ?? 'ללא קטגוריה', emoji: c?.emoji, value: b.amount, color: c?.color };
  });

  const payerSegments = summary.expenseByPayer.map((b) => ({
    id: b.id,
    label: personById.get(b.id)?.name ?? 'לא ידוע',
    value: b.amount,
    color: personColor(state.persons, b.id),
  }));

  const incomeSegments = summary.incomeByPerson.map((b) => ({
    id: b.id,
    label: personById.get(b.id)?.name ?? 'לא ידוע',
    value: b.amount,
    color: personColor(state.persons, b.id),
  }));

  const upcoming = summary.entries
    .filter((e) => e.status === 'pending' && e.type !== 'income')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 6);


  return (
    <>
      <div className="grid grid-hero">
        <div className="stat" style={{ justifyContent: 'center' }}>
          <span className="label">מאזן {monthLabel(ym)}</span>
          <span
            className="value hero"
            style={{ color: summary.net >= 0 ? 'var(--income)' : 'var(--expense)' }}
          >
            {signed(summary.net)}
          </span>
          <span className="delta">
            {summary.net >= 0
              ? 'נשאר עודף בסוף החודש'
              : 'ההוצאות גדולות מההכנסות החודש'}
          </span>
          <span className="foot">
            {money(summary.income)} הכנסות · {money(summary.expense)} הוצאות
            {summary.savingsDeposits > 0 && ` · ${money(summary.savingsDeposits)} לחיסכון`}
          </span>
        </div>

        <div className="grid grid-2" style={{ gap: 14 }}>
          <Stat label="הכנסות" value={money(summary.income)} color="var(--income)" foot={plural(summary.incomeByPerson.length, 'מקור', 'מקורות')} />
          <Stat
            label="הוצאות"
            value={money(summary.expense)}
            color="var(--expense)"
            foot={
              prev.expense
                ? `${expenseDelta >= 0 ? '▲' : '▼'} ${money(Math.abs(expenseDelta))} מול ${monthLabel(addMonths(ym, -1))}`
                : undefined
            }
          />
          <Stat
            label="כבר שולם החודש"
            value={money(summary.paidExpense)}
            foot={summary.upcomingExpense > 0 ? `${money(summary.upcomingExpense)} עוד צפויים` : 'הכול שולם'}
          />
          <Stat
            label="יתרה בכל החשבונות"
            value={money([...balances.values()].reduce((s, v) => s + v, 0))}
            foot={`נכון ל-${formatDate(todayISO())}`}
          />
        </div>
      </div>

      <Card
        title="הכנסות מול הוצאות – 12 החודשים האחרונים"
        subtitle="הזמן זורם מימין לשמאל. מעבר עם העכבר מציג את הפירוט החודשי."
      >
        <TrendColumns data={trend.map((t) => ({ ym: t.ym, income: t.income, expense: t.expense }))} />
      </Card>

      <div className="grid grid-2">
        <Card title="מאיפה יצא הכסף" subtitle={`סך ההוצאות ב${monthLabel(ym)} לפי החשבון שממנו שולמו`}>
          <StackedShare segments={payerSegments} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>חשבון</th>
                  <th className="num">יצא החודש</th>
                  <th className="num">יתרה נוכחית</th>
                </tr>
              </thead>
              <tbody>
                {state.accounts.map((a) => {
                  const out = summary.expenseByAccount.find((b) => b.id === a.id)?.amount ?? 0;
                  return (
                    <tr key={a.id}>
                      <td>
                        <span className="name-cell">
                          <i className="swatch" style={{ background: accountColor(state.accounts, state.persons, a.id) }} />
                          {a.name}
                        </span>
                      </td>
                      <td className="num">{out ? money(out) : '—'}</td>
                      <td className="num">{money(balances.get(a.id) ?? 0)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="מי הכניס כמה" subtitle={`הכנסות ב${monthLabel(ym)} לפי מקור`}>
          <StackedShare segments={incomeSegments} />
          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="data">
              <thead>
                <tr>
                  <th>מקור</th>
                  <th className="num">הכנסה</th>
                  <th className="num">שולם מהכיס הפרטי</th>
                </tr>
              </thead>
              <tbody>
                {state.persons.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="name-cell">
                        <i className="swatch" style={{ background: personColor(state.persons, p.id) }} />
                        {p.name}
                      </span>
                    </td>
                    <td className="num">{money(summary.incomeByPerson.find((b) => b.id === p.id)?.amount ?? 0)}</td>
                    <td className="num">{money(summary.expenseByPayer.find((b) => b.id === p.id)?.amount ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="grid grid-2">
        <Card
          title="הקטגוריות הגדולות"
          subtitle={`8 הקטגוריות היקרות ביותר ב${monthLabel(ym)}`}
          actions={
            <button type="button" className="btn small ghost" onClick={() => onNavigate('reports')}>
              כל הדוחות ←
            </button>
          }
        >
          {topCategories.length ? (
            <RankBars rows={topCategories} />
          ) : (
            <EmptyState title="אין הוצאות בחודש הזה">הוסיפו תנועה או הוצאה קבועה כדי להתחיל.</EmptyState>
          )}
        </Card>

        <div className="stack">
          <Card title="תשלומים שעוד צפויים החודש">
            {upcoming.length ? (
              <table className="data">
                <tbody>
                  {upcoming.map((e) => (
                    <tr key={e.key}>
                      <td className="muted small nums">{formatDate(e.date)}</td>
                      <td>
                        <span className="name-cell">
                          <i className="swatch" style={{ background: accountColor(state.accounts, state.persons, e.accountId) }} />
                          {e.name}
                        </span>
                      </td>
                      <td className="num amount-out">{money(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="muted small">אין תשלומים פתוחים – כל החיובים של החודש כבר בוצעו.</p>
            )}
          </Card>
        </div>
      </div>

      {settlement.persons.length === 2 && settlement.transfer && (
        <Card
          title="התחשבנות מהירה"
          subtitle={`${settlement.modeLabel} · מבוסס על ${monthLabel(ym)}`}
          actions={
            <button type="button" className="btn small" onClick={() => onNavigate('reports')}>
              לפירוט המלא ←
            </button>
          }
        >
          <p style={{ margin: 0 }}>
            <strong>{personById.get(settlement.transfer.fromId)?.name}</strong> צריך/ה להעביר{' '}
            <strong>{money(settlement.transfer.amount)}</strong> ל
            <strong>{personById.get(settlement.transfer.toId)?.name}</strong> כדי לאזן את ההוצאות המשותפות של החודש.
          </p>
        </Card>
      )}
    </>
  );
}
