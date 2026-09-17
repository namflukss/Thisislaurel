import { useEffect, useState } from 'react';
import { StoreProvider, useStore } from './lib/store';
import { MonthNav } from './components/ui';
import { currentMonth } from './lib/dates';
import Dashboard from './pages/Dashboard';
import MonthlyFlow from './pages/MonthlyFlow';
import RecurringPage from './pages/RecurringPage';
import TransactionsPage from './pages/TransactionsPage';
import AccountsPage from './pages/AccountsPage';
import CategoriesPage from './pages/CategoriesPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

interface Tab {
  id: string;
  label: string;
  /** האם המסך מושפע מהחודש שנבחר בראש העמוד */
  monthly: boolean;
  title: string;
  description: string;
}

const TABS: Tab[] = [
  {
    id: 'dashboard',
    label: 'סקירה',
    monthly: true,
    title: 'סקירה כללית',
    description: 'תמונת מצב של החודש: כמה נכנס, כמה יצא, מאיזה חשבון, ומה עוד צפוי.',
  },
  {
    id: 'month',
    label: 'תזרים חודשי',
    monthly: true,
    title: 'תזרים חודשי',
    description: 'כל החיובים של החודש – קבועים וחד-פעמיים – עם סימון מה שולם ומה עוד צפוי.',
  },
  {
    id: 'recurring',
    label: 'קבועות',
    monthly: false,
    title: 'הוצאות והכנסות קבועות',
    description: 'שכר דירה, ועד בית, גן, מנויים, ביטוחים, משכורות והעברות קבועות לחשבון המשותף.',
  },
  {
    id: 'txns',
    label: 'יומן תנועות',
    monthly: false,
    title: 'יומן תנועות',
    description: 'התנועות החד-פעמיות – קניות גדולות, תיקונים, מתנות והחזרים.',
  },
  {
    id: 'accounts',
    label: 'חשבונות',
    monthly: true,
    title: 'חשבונות הבית',
    description: 'החשבון של יולי, של נעמה והחשבון המשותף – יתרות, תנועות והעברות.',
  },
  {
    id: 'categories',
    label: 'קטגוריות',
    monthly: true,
    title: 'קטגוריות',
    description: 'ניהול הקטגוריות – שם, קבוצה, סמל וצבע – ומעקב אחרי ההוצאה בכל אחת מהן.',
  },
  {
    id: 'reports',
    label: 'דוחות והתחשבנות',
    monthly: true,
    title: 'דוחות והתחשבנות',
    description: 'סיכומים לאורך זמן, פילוח לפי קטגוריה וחשבון, והתחשבנות הוגנת בין בני הבית.',
  },
  {
    id: 'settings',
    label: 'הגדרות',
    monthly: false,
    title: 'הגדרות',
    description: 'שמות, מטבע, שיטת החלוקה בהתחשבנות, גיבוי ושחזור של הנתונים.',
  },
];

function Shell() {
  const { state, sync } = useStore();
  const [tabId, setTabId] = useState(() => {
    const fromHash = window.location.hash.replace('#', '');
    return TABS.some((t) => t.id === fromHash) ? fromHash : 'dashboard';
  });
  const [ym, setYm] = useState(currentMonth());

  useEffect(() => {
    window.location.hash = tabId;
  }, [tabId]);

  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.replace('#', '');
      if (TABS.some((t) => t.id === id)) setTabId(id);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const tab = TABS.find((t) => t.id === tabId) ?? TABS[0];

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="emoji" aria-hidden="true">
              🏠
            </span>
            <span>
              {state.settings.householdName}
              <small>ניהול כלכלת הבית</small>
            </span>
          </div>
          {sync === 'shared' && (
            <span className="pill" title="הנתונים מסונכרנים בין כל מי שפותח את האפליקציה">
              <i className="dot" style={{ background: 'var(--good)' }} /> מסונכרן
            </span>
          )}
          {tab.monthly && <MonthNav ym={ym} onChange={setYm} />}
        </div>
        <nav className="nav" aria-label="ניווט ראשי">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTabId(t.id)}
              aria-current={t.id === tabId ? 'page' : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="page">
        <div className="page-head">
          <div>
            <h1>{tab.title}</h1>
            <p>{tab.description}</p>
          </div>
        </div>

        {tabId === 'dashboard' && <Dashboard ym={ym} onNavigate={setTabId} />}
        {tabId === 'month' && <MonthlyFlow ym={ym} />}
        {tabId === 'recurring' && <RecurringPage />}
        {tabId === 'txns' && <TransactionsPage />}
        {tabId === 'accounts' && <AccountsPage ym={ym} />}
        {tabId === 'categories' && <CategoriesPage ym={ym} />}
        {tabId === 'reports' && <ReportsPage ym={ym} />}
        {tabId === 'settings' && <SettingsPage />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
