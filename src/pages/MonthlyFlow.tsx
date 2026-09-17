import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, EmptyState, Field, Modal, Stat } from '../components/ui';
import { TxnForm } from '../components/forms';
import { buildLedger, summarizeMonth } from '../lib/compute';
import { formatDate, monthLabel } from '../lib/dates';
import { personColor, STATUS_LABEL, TYPE_LABEL } from '../lib/colors';
import type { LedgerEntry, OccurrenceStatus, Txn } from '../types';

export default function MonthlyFlow({ ym }: { ym: string }) {
  const { state, dispatch } = useStore();
  const { money, signed } = useMoneyFormat();
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Txn | null>(null);
  const [adding, setAdding] = useState(false);
  const [amountEdit, setAmountEdit] = useState<LedgerEntry | null>(null);

  const summary = useMemo(() => summarizeMonth(state, ym), [state, ym]);
  const entries = useMemo(() => buildLedger(state, ym), [state, ym]);
  const categoryById = useMemo(() => new Map(state.categories.map((c) => [c.id, c])), [state.categories]);
  const accountById = useMemo(() => new Map(state.accounts.map((a) => [a.id, a])), [state.accounts]);

  const filtered = entries.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (accountFilter !== 'all' && e.accountId !== accountFilter && e.toAccountId !== accountFilter) return false;
    if (query) {
      const cat = e.categoryId ? categoryById.get(e.categoryId)?.name ?? '' : '';
      const hay = `${e.name} ${cat} ${e.note ?? ''}`.toLowerCase();
      if (!hay.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const setStatus = (e: LedgerEntry, status: OccurrenceStatus) => {
    if (!e.recurringId) return;
    dispatch({ type: 'override/set', recurringId: e.recurringId, ym, patch: { status } });
  };

  const resetOverride = (e: LedgerEntry) => {
    if (e.recurringId) dispatch({ type: 'override/set', recurringId: e.recurringId, ym, patch: null });
  };

  const filteredIncome = filtered.filter((e) => e.type === 'income' && e.status !== 'skipped').reduce((s, e) => s + e.amount, 0);
  const filteredExpense = filtered.filter((e) => e.type === 'expense' && e.status !== 'skipped').reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <div className="grid grid-4">
        <Stat label="הכנסות בחודש" value={money(summary.income)} color="var(--income)" />
        <Stat label="הוצאות בחודש" value={money(summary.expense)} color="var(--expense)" />
        <Stat label="מאזן" value={money(summary.net)} foot={summary.net >= 0 ? 'עודף' : 'גירעון'} />
        <Stat
          label="העברות פנימיות"
          value={money(summary.transfersOut)}
          foot={summary.savingsDeposits ? `מתוכן ${money(summary.savingsDeposits)} לחיסכון` : 'בין חשבונות הבית'}
        />
      </div>

      <Card
        title={`תזרים ${monthLabel(ym)}`}
        subtitle="כל השורות של החודש – קבועות וחד-פעמיות. אפשר לסמן מה שולם, לעדכן סכום בפועל או לדלג על חיוב."
        actions={
          <button type="button" className="btn primary small" onClick={() => setAdding(true)}>
            + תנועה חדשה
          </button>
        }
      >
        <div className="toolbar" style={{ marginBottom: 12 }}>
          <input
            type="search"
            placeholder="חיפוש לפי שם או קטגוריה…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="חיפוש"
          />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)} aria-label="סינון לפי סוג">
            <option value="all">כל הסוגים</option>
            <option value="expense">הוצאות</option>
            <option value="income">הכנסות</option>
            <option value="transfer">העברות</option>
          </select>
          <select value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)} aria-label="סינון לפי חשבון">
            <option value="all">כל החשבונות</option>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <span className="spacer" />
          <span className="small muted nums">
            {filtered.length} שורות · {money(filteredIncome)} נכנס · {money(filteredExpense)} יצא
          </span>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="אין שורות שתואמות את הסינון">נסו לנקות את החיפוש או לבחור חודש אחר.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>תיאור</th>
                  <th>קטגוריה</th>
                  <th>יוצא מ / נכנס ל</th>
                  <th>מקור</th>
                  <th>סטטוס</th>
                  <th className="num">סכום</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const cat = e.categoryId ? categoryById.get(e.categoryId) : undefined;
                  const acc = accountById.get(e.accountId);
                  const toAcc = e.toAccountId ? accountById.get(e.toAccountId) : undefined;
                  return (
                    <tr key={e.key} className={e.status === 'skipped' ? 'skipped' : undefined}>
                      <td className="muted small nums">{formatDate(e.date)}</td>
                      <td>
                        <span className="name-cell">
                          <span>{e.name}</span>
                          {e.variable && <span className="pill muted small">הערכה</span>}
                        </span>
                        {e.note && <div className="sub muted small">{e.note}</div>}
                      </td>
                      <td className="small">{cat ? `${cat.emoji} ${cat.name}` : <span className="muted">—</span>}</td>
                      <td className="small">
                        <span className="name-cell">
                          <i className="swatch" style={{ background: personColor(state.persons, acc?.ownerId) }} />
                          {acc?.name ?? '—'}
                          {toAcc && <span className="muted"> ← {toAcc.name}</span>}
                        </span>
                      </td>
                      <td className="small muted">{e.source === 'recurring' ? 'קבוע' : 'חד-פעמי'}</td>
                      <td>
                        <span className={`badge-status ${e.status}`}>{STATUS_LABEL[e.status]}</span>
                      </td>
                      <td className={`num ${e.type === 'income' ? 'amount-in' : e.type === 'expense' ? 'amount-out' : 'amount-neutral'}`}>
                        {e.type === 'expense' ? money(-e.amount) : e.type === 'income' ? signed(e.amount) : money(e.amount)}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                          {e.source === 'recurring' ? (
                            <>
                              {e.status !== 'paid' && (
                                <button type="button" className="btn small" onClick={() => setStatus(e, 'paid')}>
                                  סמן כבוצע
                                </button>
                              )}
                              {e.status !== 'skipped' && (
                                <button type="button" className="btn small ghost" onClick={() => setStatus(e, 'skipped')} title="לדלג על החיוב בחודש הזה">
                                  דילוג
                                </button>
                              )}
                              <button type="button" className="btn small ghost" onClick={() => setAmountEdit(e)} title="עדכון הסכום שנגבה בפועל">
                                סכום
                              </button>
                              {state.overrides[`${e.recurringId}|${ym}`] && (
                                <button type="button" className="icon-btn" onClick={() => resetOverride(e)} title="איפוס לשינויים שבוצעו בחודש זה">
                                  ↺
                                </button>
                              )}
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="btn small ghost"
                                onClick={() => setEditing(state.txns.find((t) => t.id === e.txnId) ?? null)}
                              >
                                עריכה
                              </button>
                              <ConfirmButton
                                onConfirm={() => e.txnId && dispatch({ type: 'txn/delete', id: e.txnId })}
                                className="btn small ghost"
                              >
                                מחיקה
                              </ConfirmButton>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={6}>סה״כ מוצג</td>
                  <td className="num">{signed(filteredIncome - filteredExpense)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {summary.skippedCount > 0 && (
          <p className="small muted" style={{ marginTop: 10 }}>
            {summary.skippedCount} חיובים סומנו כדילוג ואינם נכללים בסיכומים.
          </p>
        )}
      </Card>

      {amountEdit && (
        <AmountOverrideModal
          entry={amountEdit}
          ym={ym}
          onClose={() => setAmountEdit(null)}
          onSave={(amount) => {
            if (amountEdit.recurringId) {
              dispatch({ type: 'override/set', recurringId: amountEdit.recurringId, ym, patch: { amount, status: 'paid' } });
            }
            setAmountEdit(null);
          }}
        />
      )}

      {adding && (
        <Modal title="תנועה חדשה" onClose={() => setAdding(false)}>
          <TxnForm defaultMonth={ym} onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`עריכת ${TYPE_LABEL[editing.type]}`} onClose={() => setEditing(null)}>
          <TxnForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}

/** עדכון הסכום שנגבה בפועל עבור חיוב קבוע בחודש מסוים */
function AmountOverrideModal({
  entry,
  ym,
  onClose,
  onSave,
}: {
  entry: LedgerEntry;
  ym: string;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [value, setValue] = useState(String(entry.amount));
  const amount = Math.abs(Number(value.replace(/[^\d.-]/g, '')));
  return (
    <Modal title={`סכום בפועל – ${entry.name}`} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (Number.isFinite(amount)) onSave(amount);
        }}
      >
        <Field label={`הסכום שנגבה ב${monthLabel(ym)} (₪)`} hint="השינוי חל על החודש הזה בלבד; הסכום הקבוע נשאר כפי שהוא">
          <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </Field>
        <div className="modal-actions">
          <button type="submit" className="btn primary">
            שמירה וסימון כבוצע
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            ביטול
          </button>
        </div>
      </form>
    </Modal>
  );
}
