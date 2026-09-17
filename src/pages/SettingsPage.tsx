import { useRef, useState } from 'react';
import { isValidState, useStore } from '../lib/store';
import { Card, ConfirmButton, Field } from '../components/ui';
import { personColor } from '../lib/colors';
import { todayISO } from '../lib/dates';
import type { AppState, SplitMode } from '../types';

const SPLIT_LABEL: Record<SplitMode, string> = {
  equal: 'חלוקה שווה – כל אחד נושא במחצית מההוצאות המשותפות',
  income: 'חלוקה יחסית להכנסות – מי שמרוויח יותר נושא בחלק גדול יותר',
  custom: 'חלוקה מותאמת – אחוזים שנקבעים ידנית',
};

export default function SettingsPage() {
  const { state, dispatch } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const individuals = state.persons.filter((p) => p.isIndividual);

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `גיבוי-תקציב-הבית-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('הגיבוי ירד למחשב. אפשר לשמור אותו או להעביר למכשיר אחר.');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!isValidState(parsed)) {
        setMessage('הקובץ אינו קובץ גיבוי תקין של האפליקציה.');
        return;
      }
      dispatch({ type: 'state/replace', state: parsed as AppState });
      setMessage('הנתונים נטענו בהצלחה.');
    } catch {
      setMessage('לא הצלחנו לקרוא את הקובץ.');
    }
  };

  return (
    <>
      <Card title="פרטי משק הבית">
        <div className="form-grid">
          <Field label="שם משק הבית">
            <input
              value={state.settings.householdName}
              onChange={(e) => dispatch({ type: 'settings/update', patch: { householdName: e.target.value } })}
            />
          </Field>
          <Field label="מטבע" hint="קוד מטבע בתקן ISO, למשל ILS או USD">
            <input
              value={state.settings.currency}
              onChange={(e) => dispatch({ type: 'settings/update', patch: { currency: e.target.value.toUpperCase() } })}
            />
          </Field>
          <Field label="מראה">
            <select
              value={state.settings.theme}
              onChange={(e) => dispatch({ type: 'settings/update', patch: { theme: e.target.value as 'auto' | 'light' | 'dark' } })}
            >
              <option value="auto">לפי הגדרות המכשיר</option>
              <option value="light">בהיר</option>
              <option value="dark">כהה</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card title="בני הבית" subtitle="השמות מופיעים בכל הדוחות ובסימון מקור הכסף">
        <div className="form-grid">
          {state.persons.map((p) => (
            <Field key={p.id} label={p.isIndividual ? 'בן/בת בית' : 'ישות משותפת'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <i className="swatch" style={{ background: personColor(state.persons, p.id), width: 14, height: 14 }} />
                <input value={p.name} onChange={(e) => dispatch({ type: 'person/rename', id: p.id, name: e.target.value })} />
              </div>
            </Field>
          ))}
        </div>
      </Card>

      <Card
        title="שיטת החלוקה בהתחשבנות"
        subtitle="קובעת איך מחושב 'החלק ההוגן' של כל אחד בהוצאות המשפחתיות בדוח ההתחשבנות"
      >
        <div className="stack">
          {(Object.keys(SPLIT_LABEL) as SplitMode[]).map((mode) => (
            <label key={mode} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="radio"
                name="split"
                checked={state.settings.splitMode === mode}
                onChange={() => dispatch({ type: 'settings/update', patch: { splitMode: mode } })}
                style={{ marginTop: 4 }}
              />
              <span>{SPLIT_LABEL[mode]}</span>
            </label>
          ))}
        </div>

        {state.settings.splitMode === 'custom' && (
          <div className="form-grid" style={{ marginTop: 14 }}>
            {individuals.map((p) => (
              <Field key={p.id} label={`חלקו של ${p.name} (%)`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={state.settings.customShares[p.id] ?? 0}
                  onChange={(e) =>
                    dispatch({
                      type: 'settings/update',
                      patch: { customShares: { ...state.settings.customShares, [p.id]: Number(e.target.value) || 0 } },
                    })
                  }
                />
              </Field>
            ))}
          </div>
        )}
      </Card>

      <Card
        title="גיבוי ושחזור"
        subtitle="הנתונים נשמרים בדפדפן של המכשיר הזה בלבד. כדי לשתף אותם עם בן/בת הזוג או לעבור מכשיר – ייצאו קובץ וטענו אותו בצד השני."
      >
        <div className="toolbar">
          <button type="button" className="btn primary" onClick={exportJson}>
            ייצוא גיבוי (JSON)
          </button>
          <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
            טעינת גיבוי
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importJson(file);
              e.target.value = '';
            }}
          />
          <span className="spacer" />
          <ConfirmButton
            className="btn danger"
            confirmLabel="לאפס לנתוני הדוגמה?"
            onConfirm={() => {
              dispatch({ type: 'state/reset', mode: 'seed' });
              setMessage('הנתונים אופסו לנתוני הדוגמה.');
            }}
          >
            איפוס לנתוני דוגמה
          </ConfirmButton>
          <ConfirmButton
            className="btn danger"
            confirmLabel="למחוק הכול ולהתחיל מאפס?"
            onConfirm={() => {
              dispatch({ type: 'state/reset', mode: 'empty' });
              setMessage('הכול נמחק. אפשר להתחיל להזין נתונים אמיתיים.');
            }}
          >
            התחלה מאפס
          </ConfirmButton>
        </div>
        {message && (
          <p className="tip" style={{ marginTop: 12 }}>
            {message}
          </p>
        )}
        <p className="small muted" style={{ marginTop: 12 }}>
          כרגע נשמרים {state.recurring.length} חיובים קבועים, {state.txns.length} תנועות חד-פעמיות,{' '}
          {state.categories.length} קטגוריות ו-{state.accounts.length} חשבונות.
        </p>
      </Card>
    </>
  );
}
