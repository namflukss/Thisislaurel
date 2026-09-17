import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, Meter, Modal, Stat } from '../components/ui';
import { CategoryForm } from '../components/forms';
import { summarizeMonth } from '../lib/compute';
import { lastMonths, monthLabel } from '../lib/dates';
import type { Category } from '../types';

export default function CategoriesPage({ ym }: { ym: string }) {
  const { state, dispatch } = useStore();
  const { money } = useMoneyFormat();
  const [editing, setEditing] = useState<Category | null>(null);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<'expense' | 'income'>('expense');

  const summary = useMemo(() => summarizeMonth(state, ym), [state, ym]);
  const months = useMemo(() => lastMonths(ym, 3), [ym]);

  /** ממוצע 3 חודשים אחרונים לכל קטגוריה – בסיס טוב לקביעת תקציב */
  const averages = useMemo(() => {
    const totals = new Map<string, number>();
    for (const m of months) {
      const s = summarizeMonth(state, m);
      for (const b of [...s.expenseByCategory, ...s.incomeByCategory]) {
        totals.set(b.id, (totals.get(b.id) ?? 0) + b.amount);
      }
    }
    const avg = new Map<string, number>();
    for (const [id, sum] of totals) avg.set(id, sum / months.length);
    return avg;
  }, [state, months]);

  const actualOf = (id: string) =>
    (type === 'expense' ? summary.expenseByCategory : summary.incomeByCategory).find((b) => b.id === id)?.amount ?? 0;

  const categories = state.categories.filter((c) => c.type === type);
  const groups = [...new Set(categories.map((c) => c.group))];

  const budgetTotal = categories.reduce((s, c) => s + (c.monthlyBudget ?? 0), 0);
  const actualTotal = type === 'expense' ? summary.expense : summary.income;

  return (
    <>
      <div className="grid grid-3">
        <Stat label="קטגוריות" value={String(categories.length)} foot={`ב-${groups.length} קבוצות`} />
        <Stat label="סך התקציב החודשי" value={money(budgetTotal)} foot="סכום התקציבים שהוגדרו" />
        <Stat
          label={`בפועל ב${monthLabel(ym)}`}
          value={money(actualTotal)}
          color={type === 'expense' ? 'var(--expense)' : 'var(--income)'}
          foot={budgetTotal ? `${Math.round((actualTotal / budgetTotal) * 100)}% מהתקציב` : undefined}
        />
      </div>

      <Card
        title="קטגוריות ותקציבים"
        subtitle="כל קטגוריה שייכת לקבוצה, ואפשר להגדיר לה תקציב חודשי, סמל וצבע משלה. שינוי הצבעים של בני הבית נמצא במסך ההגדרות."
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className={`btn small${type === 'expense' ? ' primary' : ' ghost'}`}
              onClick={() => setType('expense')}
            >
              הוצאות
            </button>
            <button
              type="button"
              className={`btn small${type === 'income' ? ' primary' : ' ghost'}`}
              onClick={() => setType('income')}
            >
              הכנסות
            </button>
            <button type="button" className="btn primary small" onClick={() => setAdding(true)}>
              + קטגוריה
            </button>
          </div>
        }
      >
        <div className="stack" style={{ gap: 20 }}>
          {groups.map((group) => {
            const rows = categories.filter((c) => c.group === group);
            const groupActual = rows.reduce((s, c) => s + actualOf(c.id), 0);
            return (
              <div key={group}>
                <div className="row-between" style={{ marginBottom: 6 }}>
                  <h3>{group}</h3>
                  <span className="small muted nums">
                    {money(groupActual)} ב{monthLabel(ym)}
                  </span>
                </div>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th>קטגוריה</th>
                        <th className="num">בפועל החודש</th>
                        <th className="num">ממוצע 3 חודשים</th>
                        <th className="num">תקציב</th>
                        <th style={{ width: 140 }}>ניצול</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => {
                        const actual = actualOf(c.id);
                        const avg = averages.get(c.id) ?? 0;
                        return (
                          <tr key={c.id}>
                            <td>
                              <span className="name-cell">
                                <i
                                  className="swatch"
                                  style={{ background: c.color || 'var(--border-strong)' }}
                                  title={c.color ? 'צבע מותאם' : 'צבע ברירת מחדל'}
                                />
                                <span className="emoji">{c.emoji}</span>
                                {c.name}
                              </span>
                            </td>
                            <td className="num">{actual ? money(actual) : <span className="muted">—</span>}</td>
                            <td className="num muted">{avg ? money(avg) : '—'}</td>
                            <td className="num">{c.monthlyBudget ? money(c.monthlyBudget) : <span className="muted">—</span>}</td>
                            <td>
                              {c.monthlyBudget ? (
                                <div>
                                  <Meter value={actual} max={c.monthlyBudget} />
                                  <span className="small muted nums">
                                    {Math.round((actual / c.monthlyBudget) * 100)}%
                                    {actual > c.monthlyBudget && (
                                      <strong style={{ color: 'var(--critical)' }}> · חריגה של {money(actual - c.monthlyBudget)}</strong>
                                    )}
                                  </span>
                                </div>
                              ) : (
                                <span className="small muted">ללא תקציב</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                                <button type="button" className="btn small ghost" onClick={() => setEditing(c)}>
                                  עריכה
                                </button>
                                <ConfirmButton onConfirm={() => dispatch({ type: 'category/delete', id: c.id })} className="btn small ghost">
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
            );
          })}
        </div>
      </Card>

      {adding && (
        <Modal title="קטגוריה חדשה" onClose={() => setAdding(false)}>
          <CategoryForm onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`עריכת ${editing.name}`} onClose={() => setEditing(null)}>
          <CategoryForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
