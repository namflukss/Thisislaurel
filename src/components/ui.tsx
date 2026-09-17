import React, { useEffect, useRef, useState } from 'react';
import { addMonths, monthLabel } from '../lib/dates';
import { PALETTE } from '../lib/colors';

export function Card({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="card-head">
          {title ? <h3>{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {subtitle && <p className="card-sub">{subtitle}</p>}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  delta,
  foot,
  hero,
  color,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: React.ReactNode;
  foot?: React.ReactNode;
  hero?: boolean;
  color?: string;
}) {
  return (
    <div className="stat">
      <span className="label">
        {color && <i className="swatch" style={{ background: color }} aria-hidden="true" />}
        {label}
      </span>
      <span className={`value${hero ? ' hero' : ''}`} style={color && !hero ? { color } : undefined}>
        {value}
      </span>
      {delta && <span className="delta">{delta}</span>}
      {foot && <span className="foot">{foot}</span>}
    </div>
  );
}

export function MonthNav({
  ym,
  onChange,
  label = 'בחירת חודש',
}: {
  ym: string;
  onChange: (ym: string) => void;
  label?: string;
}) {
  return (
    <div className="month-nav" role="group" aria-label={label}>
      {/* ב-RTL החץ הימני מוביל לחודש הקודם */}
      <button type="button" onClick={() => onChange(addMonths(ym, -1))} aria-label="החודש הקודם">
        ›
      </button>
      <span className="current">{monthLabel(ym)}</span>
      <button type="button" onClick={() => onChange(addMonths(ym, 1))} aria-label="החודש הבא">
        ‹
      </button>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
  full,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label>
        <span className="field-label">{label}</span>
        {children}
      </label>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** כמו Field, אבל לתוכן שאינו פקד יחיד (קבוצת כפתורים, בורר צבע) */
export function FieldGroup({
  label,
  hint,
  children,
  full,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`field${full ? ' full' : ''}`} role="group" aria-label={typeof label === 'string' ? label : undefined}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        style={wide ? { width: 'min(860px, 100%)' } : undefined}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="סגירה">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Meter({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? value / max : 0;
  const cls = ratio > 1 ? 'meter over' : ratio > 0.85 ? 'meter warn' : 'meter';
  return (
    <div className={cls} role="img" aria-label={`${Math.round(ratio * 100)} אחוז מהתקציב`}>
      <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
    </div>
  );
}

/** כפתור מחיקה עם אישור בלחיצה שנייה – מונע מחיקות בטעות בלי דיאלוג נוסף */
export function ConfirmButton({
  onConfirm,
  children = 'מחיקה',
  confirmLabel = 'לאשר מחיקה?',
  className = 'btn small danger',
}: {
  onConfirm: () => void;
  children?: React.ReactNode;
  confirmLabel?: string;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      className={className}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
    >
      {armed ? confirmLabel : children}
    </button>
  );
}

export function Toggle({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="month-nav" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          style={
            o.value === value
              ? { background: 'var(--text-primary)', color: 'var(--surface-1)', fontWeight: 600 }
              : undefined
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * בחירת צבע: לוח צבעים מוכן (גוונים שנבדקו לניגודיות ולהבחנה בעיוורון צבעים),
 * אפשרות לצבע חופשי, וחזרה לברירת המחדל.
 */
export function ColorPicker({
  value,
  onChange,
  defaultSwatch,
  defaultLabel = 'ברירת מחדל',
}: {
  value?: string;
  onChange: (color?: string) => void;
  /** הצבע שמוצג כשלא נבחר צבע מותאם */
  defaultSwatch?: string;
  defaultLabel?: string;
}) {
  const custom = value && !PALETTE.some((p) => p.hex.toLowerCase() === value.toLowerCase());
  return (
    <div className="color-picker">
      <button
        type="button"
        className={`color-chip${!value ? ' selected' : ''}`}
        onClick={() => onChange(undefined)}
        title={defaultLabel}
        aria-label={defaultLabel}
        aria-pressed={!value}
      >
        <i style={{ background: defaultSwatch ?? 'var(--text-muted)' }} />
      </button>
      {PALETTE.map((p) => (
        <button
          key={p.hex}
          type="button"
          className={`color-chip${value?.toLowerCase() === p.hex.toLowerCase() ? ' selected' : ''}`}
          onClick={() => onChange(p.hex)}
          title={p.name}
          aria-label={p.name}
          aria-pressed={value?.toLowerCase() === p.hex.toLowerCase()}
        >
          <i style={{ background: p.hex }} />
        </button>
      ))}
      <label className={`color-chip custom${custom ? ' selected' : ''}`} title="צבע חופשי">
        <i style={{ background: custom ? value : 'linear-gradient(135deg,#e34948,#eda100,#1baf7a,#2a78d6,#4a3aa7)' }} />
        <input
          type="color"
          value={value ?? '#2a78d6'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="בחירת צבע חופשי"
        />
      </label>
    </div>
  );
}
