import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, EmptyState, Modal, Stat } from '../components/ui';
import { TxnForm } from '../components/forms';
import { formatDate, monthLabel, monthOf } from '../lib/dates';
import { personColor, TYPE_LABEL } from '../lib/colors';
import type { Txn } from '../types';

export default function TransactionsPage() {
  const { state, dispatch } = useStore();
  const { money, signed } = useMoneyFormat();
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | Txn['type']>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [editing, setEditing] = useState<Txn | null>(null);
  const [adding, setAdding] = useState(false);

  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const accountById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);

  const rows = state.txns
    .filter((t) => {
      if (typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (accountFilter !== 'all' && t.accountId !== accountFilter && t.toAccountId !== accountFilter) return false;
      if (categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      if (query) {
        const cat = t.categoryId ? categoryById.get(t.categoryId)?.name ?? '' : '';
        if (!`${t.name} ${cat} ${t.note ?? ''}`.toLowerCase().includes(query.toLowerCase())) return false;
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const totalIn = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  // קיבוץ לפי חודש לתצוגה נוחה
  const groups = rows.reduce<Record<string, Txn[]>>((acc, t) => {
    const m = monthOf(t.date);
    (acc[m] ??= []).push(t);
    return acc;
  }, {});

  return (
    <>
      <div className="grid grid-3">
        <Stat label="תנועות חד-פעמיות" value={String(rows.length)} foot="לא כולל חיובים קבועים" />
        <Stat label="סך הכנסות" value={money(totalIn)} color="var(--income)" />
        <Stat label="סך הוצאות" value={money(totalOut)} color="var(--expense)" />
      </div>

      <Card
        title="יומן תנועות"
        subtitle="כל ההוצאות וההכנסות החד-פעמיות – קניות, תיקונים, מתנות, החזרים והעברות נקודתיות"
        actions={
          <button type="button" className="btn primary small" onClick={() => setAdding(true)}>
            + תנועה חדשה
          </button>
        }
      >
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input type="search" placeholder="חיפוש…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="חיפוש" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="סוג">
            <option value="all">כל הסוגים</option>
            <option value="expense">הוצאות</option>
            <option value="income">הכנסות</option>
            <option value="transfer">העברות</option>
          </select>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="חשבון">
            <option value="all">כל החשבונות</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="קטגוריה">
            <option value="all">כל הקטגוריות</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState title="אין תנועות להצגה">הוסיפו תנועה חדשה או נקו את הסינון.</EmptyState>
        ) : (
          <div className="stack" style={{ gap: 18 }}>
            {Object.entries(groups).map(([m, list]) => (
              <div key={m}>
                <div className="row-between" style={{ marginBottom: 4 }}>
                  <h3>{monthLabel(m)}</h3>
                  <span className="small muted nums">{list.length} תנועות</span>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <tbody>
                      {list.map((t) => {
                        const cat = t.categoryId ? categoryById.get(t.categoryId) : undefined;
                        const acc = accountById.get(t.accountId);
                        const toAcc = t.toAccountId ? accountById.get(t.toAccountId) : undefined;
                        return (
                          <tr key={t.id}>
                            <td className="muted small nums" style={{ width: 90 }}>
                              {formatDate(t.date)}
                            </td>
                            <td>
                              <span className="name-cell">
                                {cat && <span className="emoji">{cat.emoji}</span>}
                                <span>{t.name}</span>
                              </span>
                              {t.note && <div className="sub muted small">{t.note}</div>}
                            </td>
                            <td className="small muted">{cat?.name ?? TYPE_LABEL[t.type]}</td>
                            <td className="small">
                              <span className="name-cell">
                                <i className="swatch" style={{ background: personColor(state.persons, acc?.ownerId) }} />
                                {acc?.name}
                                {toAcc && <span className="muted"> ← {toAcc.name}</span>}
                              </span>
                            </td>
                            <td className={`num ${t.type === 'income' ? 'amount-in' : t.type === 'expense' ? 'amount-out' : 'amount-neutral'}`}>
                              {t.type === 'expense' ? money(-t.amount) : t.type === 'income' ? signed(t.amount) : money(t.amount)}
                            </td>
                            <td style={{ width: 130 }}>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn small ghost" onClick={() => setEditing(t)}>
                                  עריכה
                                </button>
                                <ConfirmButton onConfirm={() => dispatch({ type: 'txn/delete', id: t.id })} className="btn small ghost">
                                  מחיקה
                                </ConfirmButton>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adding && (
        <Modal title="תנועה חדשה" onClose={() => setAdding(false)}>
          <TxnForm onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`עריכת ${editing.name}`} onClose={() => setEditing(null)}>
          <TxnForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
