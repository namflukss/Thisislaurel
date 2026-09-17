import { useState } from 'react';
import type { Account, Category, Recurring, Txn } from '../types';
import { ColorPicker, Field, FieldGroup } from './ui';
import { useStore, newId } from '../lib/store';
import { todayISO } from '../lib/dates';
import { FREQUENCY_LABEL } from '../lib/compute';
import { ACCOUNT_KIND_LABEL, personColor } from '../lib/colors';
import { WEEKDAY_NAMES } from '../lib/dates';

const EMOJIS = ['🏠', '🏢', '🧾', '💡', '🚿', '🔥', '📶', '📱', '🔧', '🎒', '🧸', '⚽', '👕', '👶', '🛒', '🍽️', '⛽', '🚗', '🚌', '🩺', '🛡️', '🚙', '💊', '🎬', '🏋️', '🎭', '🎁', '🧴', '🏦', '📦', '💼', '💻', '🏛️', '↩️', '✨', '🐾', '✈️', '📚'];

function num(v: string): number {
  const n = Number(v.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

/* ------------------------------ תנועה קבועה ------------------------------ */

export function RecurringForm({
  initial,
  onDone,
}: {
  initial?: Recurring;
  onDone: () => void;
}) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<Recurring>(
    initial ?? {
      id: newId('r'),
      name: '',
      type: 'expense',
      amount: 0,
      categoryId: state.categories.find((c) => c.type === 'expense')?.id,
      accountId: state.accounts[0]?.id ?? '',
      frequency: 'monthly',
      dayOfMonth: 1,
      startDate: `${todayISO().slice(0, 7)}-01`,
      active: true,
    },
  );

  const set = <K extends keyof Recurring>(key: K, value: Recurring[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const categories = state.categories.filter(
    (c) => !c.archived && c.type === (form.type === 'income' ? 'income' : 'expense'),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.accountId) return;
    const clean: Recurring = {
      ...form,
      name: form.name.trim(),
      categoryId: form.type === 'transfer' ? undefined : form.categoryId,
      toAccountId: form.type === 'transfer' ? form.toAccountId : undefined,
      personId: form.type === 'income' ? form.personId : undefined,
    };
    dispatch({ type: 'recurring/save', recurring: clean });
    onDone();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="שם">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="למשל: שכר דירה" required />
        </Field>
        <Field label="סוג">
          <select value={form.type} onChange={(e) => set('type', e.target.value as Recurring['type'])}>
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
            <option value="transfer">העברה בין חשבונות</option>
          </select>
        </Field>

        <Field label="סכום (₪)">
          <input
            inputMode="decimal"
            value={form.amount || ''}
            onChange={(e) => set('amount', num(e.target.value))}
            placeholder="0"
            required
          />
        </Field>

        {form.type !== 'transfer' && (
          <Field label="קטגוריה">
            <select value={form.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || undefined)}>
              <option value="">— ללא —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label={form.type === 'income' ? 'נכנס לחשבון' : 'יוצא מהחשבון'}>
          <select value={form.accountId} onChange={(e) => set('accountId', e.target.value)} required>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>

        {form.type === 'transfer' && (
          <Field label="לחשבון">
            <select value={form.toAccountId ?? ''} onChange={(e) => set('toAccountId', e.target.value)} required>
              <option value="">— בחירה —</option>
              {state.accounts
                .filter((a) => a.id !== form.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
        )}

        {form.type === 'income' && (
          <Field label="ההכנסה של" hint="משמש לחישוב החלוקה בין בני הבית">
            <select value={form.personId ?? ''} onChange={(e) => set('personId', e.target.value || undefined)}>
              <option value="">— לפי בעל החשבון —</option>
              {state.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="תדירות">
          <select value={form.frequency} onChange={(e) => set('frequency', e.target.value as Recurring['frequency'])}>
            {Object.entries(FREQUENCY_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>

        {form.frequency === 'weekly' ? (
          <Field label="יום בשבוע">
            <select value={form.weekday ?? 0} onChange={(e) => set('weekday', Number(e.target.value))}>
              {WEEKDAY_NAMES.map((d, i) => (
                <option key={d} value={i}>
                  יום {d}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field label="יום בחודש" hint="בחודשים קצרים יוצג היום האחרון בחודש">
            <input
              type="number"
              min={1}
              max={31}
              value={form.dayOfMonth}
              onChange={(e) => set('dayOfMonth', Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
            />
          </Field>
        )}

        <Field label="מתאריך">
          <input type="date" value={form.startDate} onChange={(e) => set('startDate', e.target.value)} required />
        </Field>
        <Field label="עד תאריך" hint="ריק = ללא הגבלה">
          <input type="date" value={form.endDate ?? ''} onChange={(e) => set('endDate', e.target.value || undefined)} />
        </Field>

        <Field label="הערה" full>
          <input value={form.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </Field>

        <div className="full" style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={!!form.variable} onChange={(e) => set('variable', e.target.checked)} />
            סכום משתנה (הערכה)
          </label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={form.active} onChange={(e) => set('active', e.target.checked)} />
            פעיל
          </label>
        </div>
      </div>

      <div className="modal-actions">
        <button type="submit" className="btn primary">
          שמירה
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          ביטול
        </button>
      </div>
    </form>
  );
}

/* --------------------------- תנועה חד-פעמית --------------------------- */

export function TxnForm({ initial, onDone, defaultMonth }: { initial?: Txn; onDone: () => void; defaultMonth?: string }) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<Txn>(
    initial ?? {
      id: newId('t'),
      date: defaultMonth && defaultMonth !== todayISO().slice(0, 7) ? `${defaultMonth}-01` : todayISO(),
      name: '',
      type: 'expense',
      amount: 0,
      categoryId: state.categories.find((c) => c.type === 'expense')?.id,
      accountId: state.accounts[0]?.id ?? '',
    },
  );
  const set = <K extends keyof Txn>(key: K, value: Txn[K]) => setForm((f) => ({ ...f, [key]: value }));
  const categories = state.categories.filter(
    (c) => !c.archived && c.type === (form.type === 'income' ? 'income' : 'expense'),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.accountId) return;
    dispatch({
      type: 'txn/save',
      txn: {
        ...form,
        name: form.name.trim(),
        categoryId: form.type === 'transfer' ? undefined : form.categoryId,
        toAccountId: form.type === 'transfer' ? form.toAccountId : undefined,
        personId: form.type === 'income' ? form.personId : undefined,
      },
    });
    onDone();
  };

  return (
    <form onSubmit={submit}>
      <div className="form-grid">
        <Field label="תיאור">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="למשל: קניות בסופר" required />
        </Field>
        <Field label="תאריך">
          <input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} required />
        </Field>
        <Field label="סוג">
          <select value={form.type} onChange={(e) => set('type', e.target.value as Txn['type'])}>
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
            <option value="transfer">העברה בין חשבונות</option>
          </select>
        </Field>
        <Field label="סכום (₪)">
          <input inputMode="decimal" value={form.amount || ''} onChange={(e) => set('amount', num(e.target.value))} required />
        </Field>
        {form.type !== 'transfer' && (
          <Field label="קטגוריה">
            <select value={form.categoryId ?? ''} onChange={(e) => set('categoryId', e.target.value || undefined)}>
              <option value="">— ללא —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label={form.type === 'income' ? 'נכנס לחשבון' : 'יוצא מהחשבון'}>
          <select value={form.accountId} onChange={(e) => set('accountId', e.target.value)} required>
            {state.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {form.type === 'transfer' && (
          <Field label="לחשבון">
            <select value={form.toAccountId ?? ''} onChange={(e) => set('toAccountId', e.target.value)} required>
              <option value="">— בחירה —</option>
              {state.accounts
                .filter((a) => a.id !== form.accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        {form.type === 'income' && (
          <Field label="ההכנסה של">
            <select value={form.personId ?? ''} onChange={(e) => set('personId', e.target.value || undefined)}>
              <option value="">— לפי בעל החשבון —</option>
              {state.persons.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="הערה" full>
          <input value={form.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </Field>
      </div>
      <div className="modal-actions">
        <button type="submit" className="btn primary">
          שמירה
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          ביטול
        </button>
      </div>
    </form>
  );
}

/* ------------------------------- חשבון ------------------------------- */

export function AccountForm({ initial, onDone }: { initial?: Account; onDone: () => void }) {
  const { state, dispatch } = useStore();
  const [form, setForm] = useState<Account>(
    initial ?? {
      id: newId('a'),
      name: '',
      ownerId: state.persons[0]?.id ?? '',
      kind: 'checking',
      openingBalance: 0,
      openingDate: todayISO(),
    },
  );
  const set = <K extends keyof Account>(key: K, value: Account[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        dispatch({ type: 'account/save', account: { ...form, name: form.name.trim() } });
        onDone();
      }}
    >
      <div className="form-grid">
        <Field label="שם החשבון">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="שייך ל">
          <select value={form.ownerId} onChange={(e) => set('ownerId', e.target.value)}>
            {state.persons.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="סוג חשבון">
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as Account['kind'])}>
            {Object.entries(ACCOUNT_KIND_LABEL).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="יתרת פתיחה (₪)">
          <input
            inputMode="decimal"
            value={form.openingBalance}
            onChange={(e) => set('openingBalance', Number(e.target.value.replace(/[^\d.-]/g, '')) || 0)}
          />
        </Field>
        <Field label="נכון לתאריך">
          <input type="date" value={form.openingDate} onChange={(e) => set('openingDate', e.target.value)} />
        </Field>
        <Field label="הערה">
          <input value={form.note ?? ''} onChange={(e) => set('note', e.target.value || undefined)} />
        </Field>
        <FieldGroup label="צבע החשבון" hint="ברירת מחדל = הצבע של בעל החשבון" full>
          <ColorPicker
            value={form.color}
            defaultSwatch={personColor(state.persons, form.ownerId)}
            onChange={(color) => set('color', color)}
          />
        </FieldGroup>
      </div>
      <div className="modal-actions">
        <button type="submit" className="btn primary">
          שמירה
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          ביטול
        </button>
      </div>
    </form>
  );
}

/* ------------------------------ קטגוריה ------------------------------ */

export function CategoryForm({ initial, onDone }: { initial?: Category; onDone: () => void }) {
  const { state, dispatch } = useStore();
  const groups = [...new Set(state.categories.map((c) => c.group))];
  const [form, setForm] = useState<Category>(
    initial ?? { id: newId('c'), name: '', group: groups[0] ?? 'שונות', type: 'expense', emoji: '📦' },
  );
  const set = <K extends keyof Category>(key: K, value: Category[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        dispatch({ type: 'category/save', category: { ...form, name: form.name.trim(), group: form.group.trim() || 'שונות' } });
        onDone();
      }}
    >
      <div className="form-grid">
        <Field label="שם הקטגוריה">
          <input value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </Field>
        <Field label="קבוצה" hint="קבוצות מאגדות קטגוריות בדוחות">
          <input list="group-list" value={form.group} onChange={(e) => set('group', e.target.value)} />
          <datalist id="group-list">
            {groups.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
        <Field label="סוג">
          <select value={form.type} onChange={(e) => set('type', e.target.value as Category['type'])}>
            <option value="expense">הוצאה</option>
            <option value="income">הכנסה</option>
          </select>
        </Field>
        <FieldGroup label="צבע" hint="משמש בגרף הקטגוריות וברשימות. ברירת מחדל = גוון לפי גודל ההוצאה" full>
          <ColorPicker value={form.color} onChange={(color) => set('color', color)} />
        </FieldGroup>
        <FieldGroup label="סמל" full>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {EMOJIS.map((em) => (
              <button
                type="button"
                key={em}
                className="btn small"
                onClick={() => set('emoji', em)}
                style={
                  form.emoji === em
                    ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' }
                    : undefined
                }
              >
                {em}
              </button>
            ))}
          </div>
        </FieldGroup>
      </div>
      <div className="modal-actions">
        <button type="submit" className="btn primary">
          שמירה
        </button>
        <button type="button" className="btn ghost" onClick={onDone}>
          ביטול
        </button>
      </div>
    </form>
  );
}
