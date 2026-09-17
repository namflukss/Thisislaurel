import { useMemo, useState } from 'react';
import { formatCompact, formatMoney } from '../lib/money';
import { shortMonthLabel } from '../lib/dates';

/* ============================================================
   גרפים. כל גרף מלווה בערכים גלויים (תוויות ישירות או טבלה),
   כדי שהצבע לעולם לא יהיה ערוץ המידע היחיד.
   ============================================================ */

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const ticks: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
  // התווית העליונה חייבת להיות גבוהה מהערך הגבוה ביותר, אחרת העמודה תחרוג מהגרף
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

export interface TrendPoint {
  ym: string;
  income: number;
  expense: number;
}

/** עמודות מקובצות: הכנסות מול הוצאות לאורך חודשים. הזמן זורם מימין לשמאל. */
export function TrendColumns({ data, height = 230 }: { data: TrendPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // רוחב ה-viewBox קרוב לרוחב התצוגה בפועל, כך שעובי העמודות וגודל הטקסט נשמרים
  const W = 1100;
  const H = height;
  const padTop = 18;
  const padBottom = 28;
  const padStart = 8;
  const padEnd = 74; // מקום לתוויות ציר הערכים (בצד ימין בממשק RTL)

  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const plotH = H - padTop - padBottom;
  const plotW = W - padStart - padEnd;
  const band = plotW / Math.max(data.length, 1);
  const barW = Math.min(24, (band - 10) / 2);
  const y = (v: number) => padTop + plotH - (v / top) * plotH;

  // אינדקס 0 (החודש הישן ביותר) בצד ימין
  const bandStart = (i: number) => padStart + (data.length - 1 - i) * band;

  const hovered = hover != null ? data[hover] : null;

  return (
    <div className="chart" style={{ position: 'relative' }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="הכנסות מול הוצאות לפי חודש">
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={padStart} x2={padStart + plotW} y1={y(t)} y2={y(t)} />
            <text className="tick-text" x={padStart + plotW + 8} y={y(t) + 4} textAnchor="start">
              {formatCompact(t)}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x0 = bandStart(i);
          const center = x0 + band / 2;
          const gap = 2; // רווח בצבע הרקע בין עמודות צמודות
          const incomeX = center - barW - gap / 2;
          const expenseX = center + gap / 2;
          const isHover = hover === i;
          return (
            <g
              key={d.ym}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              role="group"
              aria-label={`${shortMonthLabel(d.ym)}: הכנסות ${formatMoney(d.income)}, הוצאות ${formatMoney(d.expense)}`}
            >
              <rect x={x0} y={padTop} width={band} height={plotH} fill={isHover ? 'var(--surface-2)' : 'transparent'} />
              <rect
                x={incomeX}
                y={y(d.income)}
                width={barW}
                height={Math.max(plotH - (y(d.income) - padTop), 1)}
                fill="var(--income)"
                rx="4"
              />
              <rect x={incomeX} y={y(d.income) + 4} width={barW} height={4} fill="var(--income)" />
              <rect
                x={expenseX}
                y={y(d.expense)}
                width={barW}
                height={Math.max(plotH - (y(d.expense) - padTop), 1)}
                fill="var(--expense)"
                rx="4"
              />
              <rect x={expenseX} y={y(d.expense) + 4} width={barW} height={4} fill="var(--expense)" />
              <text className="axis-text" x={center} y={H - 9} textAnchor="middle">
                {shortMonthLabel(d.ym)}
              </text>
              {/* תווית ישירה לחודש האחרון בלבד – שאר הערכים בטולטיפ ובטבלאות */}
              {i === data.length - 1 && (
                <>
                  <text className="tick-text" x={incomeX + barW / 2} y={y(d.income) - 7} textAnchor="middle">
                    {formatCompact(d.income)}
                  </text>
                  <text className="tick-text" x={expenseX + barW / 2} y={y(d.expense) - 7} textAnchor="middle">
                    {formatCompact(d.expense)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {hovered && (
        <div
          style={{
            position: 'absolute',
            top: 4,
            insetInlineStart: 8,
            background: 'var(--surface-1)',
            border: '1px solid var(--border-strong)',
            borderRadius: 10,
            padding: '8px 10px',
            boxShadow: 'var(--shadow-md)',
            fontSize: 13,
            pointerEvents: 'none',
            minWidth: 150,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>{shortMonthLabel(hovered.ym)}</div>
          <div className="row-between">
            <span>
              <i className="dot" style={{ background: 'var(--income)' }} /> הכנסות
            </span>
            <span className="nums">{formatMoney(hovered.income)}</span>
          </div>
          <div className="row-between">
            <span>
              <i className="dot" style={{ background: 'var(--expense)' }} /> הוצאות
            </span>
            <span className="nums">{formatMoney(hovered.expense)}</span>
          </div>
          <div className="row-between" style={{ marginTop: 3, borderTop: '1px solid var(--border)', paddingTop: 3 }}>
            <span>מאזן</span>
            <span className="nums" style={{ color: hovered.income - hovered.expense >= 0 ? 'var(--income)' : 'var(--expense)' }}>
              {formatMoney(hovered.income - hovered.expense)}
            </span>
          </div>
        </div>
      )}

      <div className="chart-legend">
        <span className="item">
          <i className="swatch" style={{ background: 'var(--income)' }} /> הכנסות
        </span>
        <span className="item">
          <i className="swatch" style={{ background: 'var(--expense)' }} /> הוצאות
        </span>
      </div>
    </div>
  );
}

export interface RankRow {
  id: string;
  label: string;
  emoji?: string;
  value: number;
  sub?: string;
  color?: string;
}

/** דירוג מגודל – סולם כחול אחד, ככל שגדול יותר כהה יותר, עם ערך גלוי בכל שורה */
export function RankBars({
  rows,
  max,
  onSelect,
  currency,
}: {
  rows: RankRow[];
  max?: number;
  onSelect?: (id: string) => void;
  currency?: string;
}) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  const shade = (i: number, n: number) => {
    const steps = ['var(--seq-650)', 'var(--seq-550)', 'var(--seq-450)', 'var(--seq-400)', 'var(--seq-250)'];
    const idx = Math.min(steps.length - 1, Math.floor((i / Math.max(n, 1)) * steps.length));
    return steps[idx];
  };
  return (
    <ul className="list-reset stack" style={{ gap: 8 }}>
      {rows.map((r, i) => (
        <li
          key={r.id}
          className="bar-row"
          onClick={onSelect ? () => onSelect(r.id) : undefined}
          style={onSelect ? { cursor: 'pointer' } : undefined}
          title={`${r.label}: ${formatMoney(r.value, { currency })}`}
        >
          <span className="name-cell small">
            {r.emoji && <span className="emoji">{r.emoji}</span>}
            <span className="wrap-anywhere">{r.label}</span>
          </span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: `${Math.max((r.value / top) * 100, 1.5)}%`,
                background: r.color ?? shade(i, rows.length),
              }}
            />
          </span>
          <span className="bar-value">{formatMoney(r.value, { currency })}</span>
        </li>
      ))}
    </ul>
  );
}

export interface ShareSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** חלק-מתוך-שלם: פס אחד מוערם, עם רווח של 2px בצבע הרקע בין מקטעים */
export function StackedShare({ segments, height = 26 }: { segments: ShareSegment[]; height?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const visible = segments.filter((s) => s.value > 0);
  if (!total) return <p className="muted small">אין נתונים להצגה בתקופה זו.</p>;
  return (
    <div>
      <div
        style={{ display: 'flex', gap: 2, height, borderRadius: 8, overflow: 'hidden' }}
        role="img"
        aria-label={visible.map((s) => `${s.label} ${Math.round((s.value / total) * 100)}%`).join(', ')}
      >
        {visible.map((s) => (
          <div
            key={s.id}
            style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            title={`${s.label}: ${formatMoney(s.value)} (${Math.round((s.value / total) * 100)}%)`}
          />
        ))}
      </div>
      <div className="chart-legend">
        {visible.map((s) => (
          <span className="item" key={s.id}>
            <i className="swatch" style={{ background: s.color }} />
            {s.label}
            <span className="nums muted">
              {formatMoney(s.value)} · {Math.round((s.value / total) * 100)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** קו מגמה זעיר לאריח נתון */
export function Sparkline({ values, color = 'var(--accent)' }: { values: number[]; color?: string }) {
  const path = useMemo(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values, 0);
    const span = max - min || 1;
    const w = 100;
    const h = 24;
    return values
      .map((v, i) => {
        // ציר הזמן זורם מימין לשמאל
        const x = w - (i / (values.length - 1)) * w;
        const y = h - ((v - min) / span) * h;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [values]);
  if (!path) return null;
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{ width: '100%', height: 24 }} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** פס דו-כיווני סביב אפס – לתצוגת עודף/גירעון בהתחשבנות */
export function DivergingBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.min(Math.abs(value) / max, 1) : 0;
  const positive = value >= 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 18 }} aria-hidden="true">
      <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
        {!positive && (
          <span style={{ width: `${ratio * 100}%`, height: 10, background: 'var(--expense)', borderRadius: '4px 0 0 4px' }} />
        )}
      </div>
      <span style={{ width: 1, height: 18, background: 'var(--border-strong)' }} />
      <div style={{ flex: 1 }}>
        {positive && (
          <span style={{ display: 'block', width: `${ratio * 100}%`, height: 10, background: 'var(--income)', borderRadius: '0 4px 4px 0' }} />
        )}
      </div>
    </div>
  );
}
