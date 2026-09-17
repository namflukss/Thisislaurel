import { useMemo, useState } from 'react';
import { useStore } from '../lib/store';
import { useMoneyFormat } from '../lib/format';
import { Card, ConfirmButton, Modal, Stat } from '../components/ui';
import { AccountForm } from '../components/forms';
import { Sparkline } from '../components/charts';
import { accountBalances, buildLedger, summarizeMonth } from '../lib/compute';
import { ACCOUNT_KIND_LABEL, personColor } from '../lib/colors';
import { formatDate, lastMonths, monthLabel } from '../lib/dates';
import { plural } from '../lib/text';
import type { Account } from '../types';

export default function AccountsPage({ ym }: { ym: string }) {
  const { state, dispatch } = useStore();
  const { money } = useMoneyFormat();
  const [editing, setEditing] = useState<Account | null>(null);
  const [adding, setAdding] = useState(false);

  const balances = useMemo(() => accountBalances(state), [state]);
  const summary = useMemo(() => summarizeMonth(state, ym), [state, ym]);
  const months = useMemo(() => lastMonths(ym, 6), [ym]);

  /** תנועות החודש לכל חשבון: נכנס, יצא, והעברות פנימיות */
  const flows = useMemo(() => {
    const map = new Map<string, { in: number; out: number; transferIn: number; transferOut: number }>();
    for (const a of state.accounts) map.set(a.id, { in: 0, out: 0, transferIn: 0, transferOut: 0 });
    for (const e of buildLedger(state, ym)) {
      if (e.status === 'skipped') continue;
      const row = map.get(e.accountId);
      if (!row) continue;
      if (e.type === 'income') row.in += e.amount;
      else if (e.type === 'expense') row.out += e.amount;
      else {
        row.transferOut += e.amount;
        const target = e.toAccountId ? map.get(e.toAccountId) : undefined;
        if (target) target.transferIn += e.amount;
      }
    }
    return map;
  }, [state, ym]);

  /** מגמת יתרה ל-6 חודשים אחרונים (לסוף כל חודש) */
  const balanceTrend = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const a of state.accounts) map.set(a.id, []);
    for (const m of months) {
      const end = `${m}-28`;
      const snapshot = accountBalances(state, end);
      for (const a of state.accounts) map.get(a.id)!.push(snapshot.get(a.id) ?? 0);
    }
    // הגרף הזעיר מצייר מימין לשמאל, לכן החודש האחרון ראשון ברשימה
    for (const [, arr] of map) arr.reverse();
    return map;
  }, [state, months]);

  const total = [...balances.values()].reduce((s, v) => s + v, 0);
  const personTotals = state.persons.map((p) => ({
    person: p,
    total: state.accounts.filter((a) => a.ownerId === p.id).reduce((s, a) => s + (balances.get(a.id) ?? 0), 0),
  }));

  return (
    <>
      <div className="grid grid-4">
        <Stat label="סך היתרות" value={money(total)} foot="כל החשבונות יחד" />
        {personTotals.map((pt) => (
          <Stat
            key={pt.person.id}
            label={`יתרה – ${pt.person.name}`}
            value={money(pt.total)}
            color={personColor(state.persons, pt.person.id)}
            foot={plural(state.accounts.filter((a) => a.ownerId === pt.person.id).length, 'חשבון', 'חשבונות')}
          />
        ))}
      </div>

      <Card
        title="החשבונות של הבית"
        subtitle="כל חשבון משויך ליולי, לנעמה או למשותף – וכל תנועה מסומנת לפי החשבון שממנו היא יוצאת"
        actions={
          <button type="button" className="btn primary small" onClick={() => setAdding(true)}>
            + חשבון
          </button>
        }
      >
        <div className="grid grid-2">
          {state.accounts.map((a) => {
            const f = flows.get(a.id)!;
            const color = personColor(state.persons, a.ownerId);
            const owner = state.persons.find((p) => p.id === a.ownerId);
            return (
              <div className="card" key={a.id} style={{ borderInlineStartWidth: 4, borderInlineStartColor: color }}>
                <div className="row-between">
                  <div>
                    <h3>{a.name}</h3>
                    <span className="small muted">
                      {ACCOUNT_KIND_LABEL[a.kind]} · {owner?.name}
                    </span>
                  </div>
                  <div style={{ textAlign: 'end' }}>
                    <div className="nums" style={{ fontSize: 22, fontWeight: 700 }}>
                      {money(balances.get(a.id) ?? 0)}
                    </div>
                    <span className="small muted">יתרה נוכחית</span>
                  </div>
                </div>

                <div style={{ margin: '10px 0 4px' }}>
                  <Sparkline values={balanceTrend.get(a.id) ?? []} color={color} />
                  <span className="small muted">מגמת יתרה – 6 חודשים אחרונים</span>
                </div>

                <table className="data" style={{ marginTop: 8 }}>
                  <tbody>
                    <tr>
                      <td className="small">הכנסות ב{monthLabel(ym)}</td>
                      <td className="num amount-in">{money(f.in)}</td>
                    </tr>
                    <tr>
                      <td className="small">הוצאות ב{monthLabel(ym)}</td>
                      <td className="num amount-out">{money(f.out)}</td>
                    </tr>
                    <tr>
                      <td className="small">העברות נכנסות / יוצאות</td>
                      <td className="num amount-neutral">
                        {money(f.transferIn)} / {money(f.transferOut)}
                      </td>
                    </tr>
                    <tr>
                      <td className="small">יתרת פתיחה</td>
                      <td className="num muted">
                        {money(a.openingBalance)} <span className="small">({formatDate(a.openingDate)})</span>
                      </td>
                    </tr>
                  </tbody>
                </table>

                {a.note && <p className="small muted" style={{ marginBottom: 0 }}>{a.note}</p>}

                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  <button type="button" className="btn small ghost" onClick={() => setEditing(a)}>
                    עריכה
                  </button>
                  <ConfirmButton
                    onConfirm={() => dispatch({ type: 'account/delete', id: a.id })}
                    className="btn small ghost"
                    confirmLabel="למחוק? כולל התנועות"
                  >
                    מחיקה
                  </ConfirmButton>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={`תנועה בחשבונות – ${monthLabel(ym)}`} subtitle="סיכום מרוכז של כל מה שנכנס ויצא מכל חשבון">
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>חשבון</th>
                <th>בעלים</th>
                <th className="num">נכנס</th>
                <th className="num">יצא</th>
                <th className="num">העברות נטו</th>
                <th className="num">שינוי נטו</th>
                <th className="num">יתרה</th>
              </tr>
            </thead>
            <tbody>
              {state.accounts.map((a) => {
                const f = flows.get(a.id)!;
                const net = f.in - f.out + f.transferIn - f.transferOut;
                return (
                  <tr key={a.id}>
                    <td>
                      <span className="name-cell">
                        <i className="swatch" style={{ background: personColor(state.persons, a.ownerId) }} />
                        {a.name}
                      </span>
                    </td>
                    <td className="small muted">{state.persons.find((p) => p.id === a.ownerId)?.name}</td>
                    <td className="num amount-in">{money(f.in)}</td>
                    <td className="num amount-out">{money(f.out)}</td>
                    <td className="num amount-neutral">{money(f.transferIn - f.transferOut)}</td>
                    <td className="num" style={{ color: net >= 0 ? 'var(--income)' : 'var(--expense)', fontWeight: 600 }}>
                      {money(net)}
                    </td>
                    <td className="num">{money(balances.get(a.id) ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>סה״כ</td>
                <td className="num">{money(summary.income)}</td>
                <td className="num">{money(summary.expense)}</td>
                <td className="num">—</td>
                <td className="num">{money(summary.net)}</td>
                <td className="num">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {adding && (
        <Modal title="חשבון חדש" onClose={() => setAdding(false)}>
          <AccountForm onDone={() => setAdding(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`עריכת ${editing.name}`} onClose={() => setEditing(null)}>
          <AccountForm initial={editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </>
  );
}
