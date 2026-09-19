/** מודל הנתונים של האפליקציה. כל הסכומים בשקלים, כמספרים חיוביים. */

export type EntryType = 'expense' | 'income' | 'transfer';

/**
 * איך ההוצאה מתחלקת בין בני הבית – בנפרד לגמרי מהשאלה מאיזה חשבון היא שולמה.
 * 'shared'   – לפי שיטת החלוקה הכללית שנבחרה בהגדרות
 * 'equal'    – חלוקה שווה בין בני הבית (חצי-חצי לשניים)
 * 'personal' – אדם אחד נושא בהוצאה במלואה
 * 'ratio'    – חלוקה לפי אחוזים שנקבעים בשורה עצמה (shares)
 * ריק = לפי הגדרת הקטגוריה, שברירת המחדל שלה היא 'shared'.
 */
export type SplitKind = 'shared' | 'equal' | 'personal' | 'ratio';

/** תדירות של תנועה קבועה */
export type Frequency =
  | 'monthly'
  | 'bimonthly'
  | 'quarterly'
  | 'semiannual'
  | 'yearly'
  | 'weekly';

/** בעלי החשבונות – יולי, נעמה, ומשותף */
export interface Person {
  id: string;
  name: string;
  /** false עבור "משותף" – ישות שאינה אדם פרטי, ולכן לא נכללת בהתחשבנות כצד */
  isIndividual: boolean;
  /** צבע זהות מותאם אישית. ריק = צבע ברירת המחדל, שמתאים את עצמו למצב בהיר/כהה */
  color?: string;
}

export type AccountKind = 'checking' | 'credit' | 'savings' | 'cash';

export interface Account {
  id: string;
  name: string;
  /** מזהה הבעלים (Person). חשבון משותף שייך ל-person "joint" */
  ownerId: string;
  kind: AccountKind;
  /** יתרת פתיחה נכון לתאריך openingDate */
  openingBalance: number;
  openingDate: string; // YYYY-MM-DD
  /** צבע מותאם לחשבון. ריק = הצבע של בעל החשבון */
  color?: string;
  archived?: boolean;
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  /** קבוצת-על לתצוגה ולסיכומים, למשל "דיור" או "חינוך" */
  group: string;
  type: 'expense' | 'income';
  emoji: string;
  /** קטגוריה אישית – ההוצאות בה אינן נכללות באיזון, אלא אם סומן אחרת בתנועה עצמה */
  personalByDefault?: boolean;
  /** צבע מותאם אישית לקטגוריה בגרפים וברשימות */
  color?: string;
  archived?: boolean;
}

/** תנועה קבועה – שכר דירה, גן, מנוי, משכורת, העברה קבועה לחשבון המשותף וכו' */
export interface Recurring {
  id: string;
  name: string;
  type: EntryType;
  amount: number;
  categoryId?: string;
  /** החשבון שממנו יוצא הכסף (הוצאה/העברה) או שאליו הוא נכנס (הכנסה) */
  accountId: string;
  /** יעד ההעברה – רק עבור type === 'transfer' */
  toAccountId?: string;
  /** של מי ההכנסה – רק עבור type === 'income' */
  personId?: string;
  frequency: Frequency;
  /** יום בחודש לחיוב (1–31, נחתך לאורך החודש בפועל) */
  dayOfMonth: number;
  /** יום בשבוע לתדירות שבועית (0=ראשון) */
  weekday?: number;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  active: boolean;
  /** סכום משתנה (חשמל, סופר) – מוצג כהערכה */
  variable?: boolean;
  /** איך ההוצאה מתחלקת. ריק = לפי הקטגוריה */
  split?: SplitKind;
  /** של מי ההוצאה האישית. ריק = בעל החשבון שממנו שולמה */
  forPersonId?: string;
  /** אחוזים לפי personId, בשימוש כאשר split === 'ratio' */
  shares?: Record<string, number>;
  /** להעברה בין חשבונות פרטיים: האם היא מאזנת בין בני הבית. ריק = כן */
  settles?: boolean;
  note?: string;
}

/** תנועה חד-פעמית שנרשמה בפועל */
export interface Txn {
  id: string;
  date: string; // YYYY-MM-DD
  type: EntryType;
  name: string;
  amount: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  personId?: string;
  /** איך ההוצאה מתחלקת. ריק = לפי הקטגוריה */
  split?: SplitKind;
  /** של מי ההוצאה האישית. ריק = בעל החשבון שממנו שולמה */
  forPersonId?: string;
  /** אחוזים לפי personId, בשימוש כאשר split === 'ratio' */
  shares?: Record<string, number>;
  /** להעברה בין חשבונות פרטיים: האם היא מאזנת בין בני הבית. ריק = כן */
  settles?: boolean;
  note?: string;
}

export type OccurrenceStatus = 'pending' | 'paid' | 'skipped';

/** דריסה לחודש מסוים של תנועה קבועה (סומן כשולם, סכום אחר, דילוג) */
export interface Override {
  status?: OccurrenceStatus;
  amount?: number;
  accountId?: string;
}

/** מפתח: `${recurringId}|${YYYY-MM}` */
export type Overrides = Record<string, Override>;

/** רישום של איזון שבוצע בפועל בין בני הבית, לתקופה מסוימת */
export interface SettlementRecord {
  id: string;
  /** התקופה שעליה בוצע האיזון (חודש בודד: fromMonth === toMonth) */
  fromMonth: string; // YYYY-MM
  toMonth: string; // YYYY-MM
  /** מי השלים למי */
  fromPersonId: string;
  toPersonId: string;
  amount: number;
  /** מתי סומן כהוסדר */
  settledOn: string; // YYYY-MM-DD
  /** מזהה ההעברה שנרשמה בפועל, אם נרשמה */
  txnId?: string;
  note?: string;
}

/**
 * התאמה ידנית לאיזון: "X העבירה / שילמה סכום עבור Y".
 * מקטינה את מה ש-X חייבת ומגדילה את מה ש-Y חייבת, בלי קשר להוצאות שנרשמו.
 */
export interface SettlementAdjustment {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  /** מי העבירה / שילמה */
  fromPersonId: string;
  /** עבור מי */
  toPersonId: string;
}

export type SplitMode = 'equal' | 'income' | 'custom';

export interface Settings {
  householdName: string;
  currency: string;
  locale: string;
  /** אופן חלוקת ההוצאות המשותפות בהתחשבנות */
  splitMode: SplitMode;
  /** אחוזים לפי personId, בשימוש כאשר splitMode === 'custom' */
  customShares: Record<string, number>;
  theme: 'auto' | 'light' | 'dark';
  /** צבע ראשי לכפתורים ולהדגשות. ריק = ברירת המחדל */
  accent?: string;
}

export interface AppState {
  version: number;
  persons: Person[];
  accounts: Account[];
  categories: Category[];
  recurring: Recurring[];
  txns: Txn[];
  overrides: Overrides;
  /** איזונים שכבר בוצעו בין בני הבית */
  settlements: SettlementRecord[];
  /** התאמות ידניות לאיזון */
  adjustments: SettlementAdjustment[];
  settings: Settings;
}

/** שורה מחושבת בתזרים החודשי – מאוחדת מתנועות קבועות ומחד-פעמיות */
export interface LedgerEntry {
  key: string;
  date: string;
  name: string;
  type: EntryType;
  amount: number;
  categoryId?: string;
  accountId: string;
  toAccountId?: string;
  personId?: string;
  source: 'recurring' | 'once';
  recurringId?: string;
  txnId?: string;
  status: OccurrenceStatus;
  variable?: boolean;
  split?: SplitKind;
  forPersonId?: string;
  shares?: Record<string, number>;
  settles?: boolean;
  note?: string;
}
