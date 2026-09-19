import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, EmptyState, Field, Modal, Stat } from '../components/ui';
import { TxnForm } from '../components/forms';
import { buildLedger, resolveSplit, splitLabel, summarizeMonth } from '../lib/compute';
import { formatDate, monthLabel } from '../lib/dates';
import { accountColor, STATUS_LABEL, TYPE_LABEL } from '../lib/colors';
import type { LedgerEntry, OccurrenceStatus, SplitKind, Txn } from '../types';

export default function MonthlyFlow({ ym }: { ym: string }) {
  const { state, dispatch } = useStore();
  const { money, signed } = useMoneyFormat();
  const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Txn | null>(null);
  const [adding, setAdding] = useState(false);
  const [amountEdit, setAmountEdit] = useState<LedgerEntry | null>(null);
  const [attributing, setAttributing] = useState<LedgerEntry | null>(null);

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

  /** קביעת אופן החלוקה של שורה. בשורה קבועה השינוי חל על כל החודשים. */
  const applySplit = (
    e: LedgerEntry,
    split: SplitKind,
    forPersonId?: string,
    shares?: Record<string, number>,
  ) => {
    if (e.txnId) {
      const txn = state.txns.find((t) => t.id === e.txnId);
      if (txn) dispatch({ type: 'txn/save', txn: { ...txn, split, forPersonId, shares } });
    } else if (e.recurringId) {
      const rec = state.recurring.find((r) => r.id === e.recurringId);
      if (rec) dispatch({ type: 'recurring/save', recurring: { ...rec, split, forPersonId, shares } });
    }
  };

  const clearSplit = (e: LedgerEntry) => {
    if (e.txnId) {
      const txn = state.txns.find((t) => t.id === e.txnId);
      if (txn) dispatch({ type: 'txn/save', txn: { ...txn, split: undefined, forPersonId: undefined, shares: undefined } });
    } else if (e.recurringId) {
      const rec = state.recurring.find((r) => r.id === e.recurringId);
      if (rec) {
        dispatch({
          type: 'recurring/save',
          recurring: { ...rec, split: undefined, forPersonId: undefined, shares: undefined },
        });
      }
    }
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
                          {e.type === 'expense' &&
                            (() => {
                              const label = splitLabel(e, categoryById, state.accounts, state.persons);
                              if (!label) return null;
                              return label === 'אישי · חסר שיוך' ? (
                                <button
                                  type="button"
                                  className="pill warn-pill small"
                                  onClick={() => setAttributing(e)}
                                  title="סומן כאישי אך לא ידוע של מי – עד שייבחר, ההוצאה מתחלקת כרגיל"
                                >
                                  {label}
                                </button>
                              ) : (
                                <span className="pill muted small" title="אופן החלוקה של ההוצאה">
                                  {label}
                                </span>
                              );
                            })()}
                        </span>
                        {e.note && <div className="sub muted small">{e.note}</div>}
                      </td>
                      <td className="small">{cat ? `${cat.emoji} ${cat.name}` : <span className="muted">—</span>}</td>
                      <td className="small">
                        <span className="name-cell">
                          <i className="swatch" style={{ background: accountColor(state.accounts, state.persons, e.accountId) }} />
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
                          {e.type === 'expense' && (
                            <button
                              type="button"
                              className="btn small ghost"
                              onClick={() => setAttributing(e)}
                              title={
                                e.source === 'recurring'
                                  ? 'קביעת אופן החלוקה – חל על כל החודשים של החיוב הקבוע'
                                  : 'קביעת אופן החלוקה של ההוצאה'
                              }
                            >
                              חלוקה
                            </button>
                          )}
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

      {attributing && (
        <SplitPicker
          entry={attributing}
          current={resolveSplit(attributing, categoryById)}
          onClose={() => setAttributing(null)}
          onPick={(split, forPersonId, shares) => {
            if (split === null) clearSplit(attributing);
            else applySplit(attributing, split, forPersonId, shares);
            setAttributing(null);
          }}
        />
      )}

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

/** בחירת אופן החלוקה של הוצאה אחת, ישר מהתזרים */
function SplitPicker({
  entry,
  current,
  onClose,
  onPick,
}: {
  entry: LedgerEntry;
  current: SplitKind;
  onClose: () => void;
  onPick: (split: SplitKind | null, forPersonId?: string, shares?: Record<string, number>) => void;
}) {
  const { state } = useStore();
  const individuals = state.persons.filter((p) => p.isIndividual);
  const account = state.accounts.find((a) => a.id === entry.accountId);
  const [shares, setShares] = useState<Record<string, number>>(
    entry.shares ?? Object.fromEntries(individuals.map((p) => [p.id, Math.round(100 / Math.max(individuals.length, 1))])),
  );
  const sharesTotal = individuals.reduce((sum, p) => sum + (shares[p.id] ?? 0), 0);

  const option = (label: string, hint: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      key={label}
      className="split-option"
      aria-pressed={active}
      onClick={onClick}
      style={active ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}
    >
      <strong>{label}</strong>
      <span className="small muted">{hint}</span>
    </button>
  );

  return (
    <Modal title={`איך מתחלקת ההוצאה? – ${entry.name}`} onClose={onClose}>
      <p className="small muted" style={{ marginTop: 0 }}>
        שולמה מ{account?.name}. מי שילמה זה דבר אחד, ומי נושאת בהוצאה זה דבר אחר – כאן קובעים את השני.
        {entry.source === 'recurring' && ' השינוי חל על כל החודשים של החיוב הקבוע.'}
      </p>

      <div className="split-options">
        {option('לפי הקטגוריה', 'חוזר לברירת המחדל של הקטגוריה', !entry.split, () => onPick(null))}
        {option(
          'לפי שיטת החלוקה הכללית',
          'לפי מה שנקבע בהגדרות (שווה / יחסי להכנסות)',
          entry.split === 'shared',
          () => onPick('shared'),
        )}
        {option('חצי-חצי', 'שתיכן נושאות בחלקים שווים', entry.split === 'equal', () => onPick('equal'))}
        {individuals.map((p) =>
          option(
            `אישית של ${p.name}`,
            `${p.name} נושאת בהוצאה במלואה`,
            current === 'personal' && (entry.forPersonId === p.id || (!entry.forPersonId && account?.ownerId === p.id)),
            () => onPick('personal', p.id),
          ),
        )}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
        <div className="row-between" style={{ marginBottom: 8 }}>
          <strong style={{ fontSize: 14 }}>לפי אחוזים</strong>
          <span className="small muted">סה״כ {sharesTotal}%</span>
        </div>
        <div className="form-grid">
          {individuals.map((p) => (
            <Field key={p.id} label={`${p.name} (%)`}>
              <input
                type="number"
                min={0}
                max={100}
                value={shares[p.id] ?? 0}
                onChange={(ev) => setShares({ ...shares, [p.id]: Math.max(0, Number(ev.target.value) || 0) })}
              />
            </Field>
          ))}
        </div>
        <button
          type="button"
          className="btn small"
          style={{ marginTop: 8 }}
          disabled={sharesTotal <= 0}
          onClick={() => onPick('ratio', undefined, shares)}
        >
          שמירת החלוקה באחוזים
        </button>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn ghost" onClick={onClose}>
          סגירה
        </button>
      </div>
    </Modal>
  );
}
