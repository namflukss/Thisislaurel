import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, EmptyState, Modal, Stat } from '../components/ui';
import { RecurringForm } from '../components/forms';
import { annualAmount, FREQUENCY_LABEL, monthlyEquivalent, resolveSplit } from '../lib/compute';
import { accountColor } from '../lib/colors';
import type { Recurring } from '../types';

type Tab = 'expense' | 'income' | 'transfer';

const TAB_LABEL: Record<Tab, string> = {
  expense: 'הוצאות קבועות',
  income: 'הכנסות קבועות',
  transfer: 'העברות קבועות',
};

export default function RecurringPage() {
  const { state, dispatch } = useStore();
  const { money } = useMoneyFormat();
  const [tab, setTab] = useState<Tab>('expense');
  const [editing, setEditing] = useState<Recurring | null>(null);
  const [adding, setAdding] = useState(false);
  const [accountFilter, setAccountFilter] = useState('all');

  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const accountById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);

  const list = state.recurring
    .filter((r) => r.type === tab)
    .filter((r) => accountFilter === 'all' || r.accountId === accountFilter || r.toAccountId === accountFilter)
    .sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));

  const activeOf = (type: Tab) => state.recurring.filter((r) => r.type === type && r.active);
  const monthlyExpense = activeOf('expense').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyIncome = activeOf('income').reduce((s, r) => s + monthlyEquivalent(r), 0);
  const monthlyTransfers = activeOf('transfer').reduce((s, r) => s + monthlyEquivalent(r), 0);

  // הוצאות קבועות לפי הקבוצה שאליה משויכת הקטגוריה
  const byGroup = new Map<string, number>();
  for (const r of activeOf('expense')) {
    const group = r.categoryId ? categoryById.get(r.categoryId)?.group ?? 'שונות' : 'שונות';
    byGroup.set(group, (byGroup.get(group) ?? 0) + monthlyEquivalent(r));
  }

  return (
    <>
      <div className="grid grid-4">
        <Stat
          label="הוצאות קבועות לחודש"
          value={money(monthlyExpense)}
          color="var(--expense)"
          foot={`${money(monthlyExpense * 12)} בשנה`}
        />
        <Stat
          label="הכנסות קבועות לחודש"
          value={money(monthlyIncome)}
          color="var(--income)"
          foot={`${money(monthlyIncome * 12)} בשנה`}
        />
        <Stat
          label="עודף קבוע חודשי"
          value={money(monthlyIncome - monthlyExpense)}
          foot="לפני הוצאות משתנות"
        />
        <Stat label="העברות קבועות" value={money(monthlyTransfers)} foot="בין חשבונות הבית" />
      </div>

      <Card
        title="פילוח ההוצאות הקבועות"
        subtitle="ממוצע חודשי לפי קבוצת קטגוריות – חיובים דו-חודשיים ושנתיים מחולקים לחודשים"
      >
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>קבוצה</th>
                <th className="num">לחודש</th>
                <th className="num">לשנה</th>
                <th className="num">חלק מההוצאות הקבועות</th>
              </tr>
            </thead>
            <tbody>
              {[...byGroup.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([group, amount]) => (
                  <tr key={group}>
                    <td>{group}</td>
                    <td className="num">{money(amount)}</td>
                    <td className="num">{money(amount * 12)}</td>
                    <td className="num">{monthlyExpense ? Math.round((amount / monthlyExpense) * 100) : 0}%</td>
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td>סה״כ</td>
                <td className="num">{money(monthlyExpense)}</td>
                <td className="num">{money(monthlyExpense * 12)}</td>
                <td className="num">100%</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card
        title={TAB_LABEL[tab]}
        subtitle="שכר דירה, ועד בית, גן, מנויים, משכורות והעברות קבועות – כל מה שחוזר על עצמו"
        actions={
          <button type="button" className="btn primary small" onClick={() => setAdding(true)}>
            + תנועה קבועה
          </button>
        }
      >
        <div className="toolbar" style={{ marginBottom: 12 }}>
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              className={`btn small${tab === t ? ' primary' : ' ghost'}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABEL[t]} ({state.recurring.filter((r) => r.type === t).length})
            </button>
          ))}
          <span className="spacer" />
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="סינון לפי חשבון">
            <option value="all">כל החשבונות</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {list.length === 0 ? (
          <EmptyState title="אין כאן תנועות קבועות">הוסיפו את החיובים שחוזרים כל חודש כדי לראות תמונה מלאה.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>קטגוריה</th>
                  <th>{tab === 'income' ? 'נכנס לחשבון' : 'יוצא מהחשבון'}</th>
                  <th>תדירות</th>
                  <th className="num">סכום</th>
                  <th className="num">ממוצע לחודש</th>
                  <th className="num">לשנה</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {list.map((r) => {
                  const cat = r.categoryId ? categoryById.get(r.categoryId) : undefined;
                  const acc = accountById.get(r.accountId);
                  const toAcc = r.toAccountId ? accountById.get(r.toAccountId) : undefined;
                  return (
                    <tr key={r.id} style={r.active ? undefined : { opacity: 0.55 }}>
                      <td>
                        <span className="name-cell">
                          <span>{r.name}</span>
                          {r.variable && <span className="pill muted">הערכה</span>}
                          {r.type === 'expense' && resolveSplit(r, categoryById) === 'personal' && (
                            <span className="pill muted" title="אישי – לא נכלל באיזון">
                              אישי
                            </span>
                          )}
                          {!r.active && <span className="pill muted">מושהה</span>}
                        </span>
                        {r.note && <div className="sub muted small">{r.note}</div>}
                      </td>
                      <td className="small">{cat ? `${cat.emoji} ${cat.name}` : <span className="muted">—</span>}</td>
                      <td className="small">
                        <span className="name-cell">
                          <i className="swatch" style={{ background: accountColor(state.accounts, state.persons, r.accountId) }} />
                          {acc?.name ?? '—'}
                          {toAcc && <span className="muted"> ← {toAcc.name}</span>}
                        </span>
                      </td>
                      <td className="small">
                        {FREQUENCY_LABEL[r.frequency]}
                        <span className="muted"> · {r.frequency === 'weekly' ? '' : `ב-${r.dayOfMonth} לחודש`}</span>
                      </td>
                      <td className="num">{money(r.amount)}</td>
                      <td className="num">{money(monthlyEquivalent(r))}</td>
                      <td className="num muted">{money(annualAmount(r))}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          <button type="button" className="btn small ghost" onClick={() => dispatch({ type: 'recurring/toggle', id: r.id })}>
                            {r.active ? 'השהיה' : 'הפעלה'}
                          </button>
                          <button type="button" className="btn small ghost" onClick={() => setEditing(r)}>
                            עריכה
                          </button>
                          <ConfirmButton onConfirm={() => dispatch({ type: 'recurring/delete', id: r.id })} className="btn small ghost">
                            מחיקה
                          </ConfirmButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>סה״כ מוצג</td>
                  <td className="num">{money(list.filter((r) => r.active).reduce((s, r) => s + monthlyEquivalent(r), 0))}</td>
                  <td className="num">{money(list.filter((r) => r.active).reduce((s, r) => s + annualAmount(r), 0))}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {adding && (
        <Modal title="תנועה קבועה חדשה" onClose={() => setAdding(false)}>
          <RecurringForm onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`עריכת ${editing.name}`} onClose={() => setEditing(null)}>
          <RecurringForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
