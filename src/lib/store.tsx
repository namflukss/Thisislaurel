import React, { createContext, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type {
  Account,
  AppState,
  Category,
  Override,
  Person,
  Recurring,
  SettlementRecord,
  Settings,
  Txn,
} from '../types';
import { buildSeedState, emptyState } from '../data/seed';
import { overrideKey } from './compute';
import { getSharedDoc, type DocRef } from './platform';

const STORAGE_KEY = 'household-budget:v1';

export type Action =
  | { type: 'person/update'; id: string; patch: Partial<Person> }
  | { type: 'account/save'; account: Account }
  | { type: 'account/delete'; id: string }
  | { type: 'category/save'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'recurring/save'; recurring: Recurring }
  | { type: 'recurring/delete'; id: string }
  | { type: 'recurring/toggle'; id: string }
  | { type: 'txn/save'; txn: Txn }
  | { type: 'txn/delete'; id: string }
  | { type: 'override/set'; recurringId: string; ym: string; patch: Override | null }
  | { type: 'settlement/save'; record: SettlementRecord }
  | { type: 'settlement/delete'; id: string }
  | { type: 'settings/update'; patch: Partial<Settings> }
  | { type: 'state/replace'; state: AppState }
  | { type: 'state/reset'; mode: 'seed' | 'empty' };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [...list, item];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'person/update':
      return {
        ...state,
        persons: state.persons.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)),
      };
    case 'account/save':
      return { ...state, accounts: upsert(state.accounts, action.account) };
    case 'account/delete':
      return {
        ...state,
        accounts: state.accounts.filter((a) => a.id !== action.id),
        recurring: state.recurring.filter((r) => r.accountId !== action.id && r.toAccountId !== action.id),
        txns: state.txns.filter((t) => t.accountId !== action.id && t.toAccountId !== action.id),
      };
    case 'category/save':
      return { ...state, categories: upsert(state.categories, action.category) };
    case 'category/delete':
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        recurring: state.recurring.map((r) => (r.categoryId === action.id ? { ...r, categoryId: undefined } : r)),
        txns: state.txns.map((t) => (t.categoryId === action.id ? { ...t, categoryId: undefined } : t)),
      };
    case 'recurring/save':
      return { ...state, recurring: upsert(state.recurring, action.recurring) };
    case 'recurring/delete': {
      const overrides = { ...state.overrides };
      for (const key of Object.keys(overrides)) {
        if (key.startsWith(`${action.id}|`)) delete overrides[key];
      }
      return { ...state, recurring: state.recurring.filter((r) => r.id !== action.id), overrides };
    }
    case 'recurring/toggle':
      return {
        ...state,
        recurring: state.recurring.map((r) => (r.id === action.id ? { ...r, active: !r.active } : r)),
      };
    case 'txn/save':
      return { ...state, txns: upsert(state.txns, action.txn) };
    case 'txn/delete':
      return { ...state, txns: state.txns.filter((t) => t.id !== action.id) };
    case 'override/set': {
      const key = overrideKey(action.recurringId, action.ym);
      const overrides = { ...state.overrides };
      if (action.patch === null) delete overrides[key];
      else overrides[key] = { ...overrides[key], ...action.patch };
      return { ...state, overrides };
    }
    case 'settlement/save':
      return { ...state, settlements: upsert(state.settlements ?? [], action.record) };
    case 'settlement/delete': {
      const record = (state.settlements ?? []).find((r) => r.id === action.id);
      return {
        ...state,
        settlements: (state.settlements ?? []).filter((r) => r.id !== action.id),
        // ההעברה שנרשמה יחד עם הסימון מוסרת גם היא, כדי שהיתרות יישארו נכונות
        txns: record?.txnId ? state.txns.filter((t) => t.id !== record.txnId) : state.txns,
      };
    }
    case 'settings/update':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'state/replace':
      return action.state;
    case 'state/reset':
      return action.mode === 'seed' ? buildSeedState() : emptyState();
    default:
      return state;
  }
}

/** בדיקת שפיות בסיסית לקובץ מיובא / לנתונים שנשמרו */
export function isValidState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const s = value as Partial<AppState>;
  return (
    Array.isArray(s.persons) &&
    Array.isArray(s.accounts) &&
    Array.isArray(s.categories) &&
    Array.isArray(s.recurring) &&
    Array.isArray(s.txns) &&
    !!s.settings
  );
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildSeedState();
    const parsed = JSON.parse(raw);
    if (!isValidState(parsed)) return buildSeedState();
    return { ...buildSeedState(), ...parsed, overrides: parsed.overrides ?? {}, settlements: parsed.settlements ?? [] };
  } catch {
    return buildSeedState();
  }
}

/** 'local' – נשמר רק בדפדפן הזה; 'shared' – מסונכרן בין כל מי שפתח את האפליקציה */
export type SyncStatus = 'local' | 'shared';

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  sync: SyncStatus;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState);
  const [sync, setSync] = useState<SyncStatus>('local');

  // אחסון משותף (כשהאפליקציה רצה כ-Artifact): מסמך אחד שמחזיק את כל המצב,
  // כך ששני בני הבית רואים את אותם נתונים בכל מכשיר.
  const docRef = useRef<DocRef | null>(null);
  const lastSyncedRef = useRef<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    const apply = (raw: unknown) => {
      if (typeof raw !== 'string' || raw === lastSyncedRef.current) return;
      try {
        const parsed = JSON.parse(raw);
        if (!isValidState(parsed)) return;
        lastSyncedRef.current = raw;
        dispatch({ type: 'state/replace', state: parsed as AppState });
      } catch {
        // מסמך פגום – ממשיכים עם הנתונים המקומיים
      }
    };

    void (async () => {
      const doc = await getSharedDoc();
      if (!doc || cancelled) return;
      try {
        const snap = await doc.get();
        if (cancelled) return;
        if (snap.exists) {
          apply(snap.data()?.state);
        } else {
          // פתיחה ראשונה: מעלים את מה שיש במכשיר הזה כנקודת הפתיחה המשותפת
          const payload = JSON.stringify(stateRef.current);
          lastSyncedRef.current = payload;
          await doc.set({ state: payload, updatedAt: new Date().toISOString() });
        }
        if (cancelled) return;
        docRef.current = doc;
        setSync('shared');
        unsubscribe = doc.onSnapshot(
          (next) => apply(next.data()?.state),
          () => setSync('local'),
        );
      } catch {
        // אין הרשאת כתיבה או שהאחסון אינו זמין – נשארים על אחסון מקומי
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // מצב פרטי בדפדפן או אחסון מלא – האפליקציה ממשיכה לעבוד בזיכרון בלבד
    }
  }, [state]);

  // כתיבה לאחסון המשותף אחרי שקט קצר, כדי לאחד רצף עריכות לכתיבה אחת
  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;
    const payload = JSON.stringify(state);
    if (payload === lastSyncedRef.current) return;
    const timer = setTimeout(() => {
      lastSyncedRef.current = payload;
      void doc.set({ state: payload, updatedAt: new Date().toISOString() }).catch(() => setSync('local'));
    }, 700);
    return () => clearTimeout(timer);
  }, [state, sync]);

  useEffect(() => {
    const theme = state.settings.theme;
    const root = document.documentElement;
    if (theme === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [state.settings.theme]);

  // צבע ראשי מותאם אישית; ריק = הטוקנים מגיליון הסגנונות, שמתאימים את עצמם לנושא
  useEffect(() => {
    const root = document.documentElement;
    const accent = state.settings.accent;
    if (accent) {
      root.style.setProperty('--accent', accent);
      root.style.setProperty('--accent-soft', `color-mix(in srgb, ${accent} 14%, transparent)`);
    } else {
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-soft');
    }
  }, [state.settings.accent]);

  const value = useMemo(() => ({ state, dispatch, sync }), [state, sync]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export { STORAGE_KEY };
