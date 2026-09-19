/** מודל הנתונים של האפליקציה. כל הסכומים בשקלים, כמספרים חיוביים. */

export type EntryType = 'expense' | 'income' | 'transfer';

/**
 * האם ההוצאה מתחלקת בין בני הבית או שהיא אישית.
 * 'shared' – נכללת באיזון; 'personal' – מי שההוצאה שלו נושא בה לבד.
 * ריק = לפי הגדרת הקטגוריה, שברירת המחדל שלה היא משותפת.
 */
export type SplitKind = 'shared' | 'personal';

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
  /** האם ההוצאה מתחלקת באיזון. ריק = לפי הקטגוריה */
  split?: SplitKind;
  /** של מי ההוצאה האישית. ריק = בעל החשבון שממנו שולמה */
  forPersonId?: string;
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
  /** האם ההוצאה מתחלקת באיזון. ריק = לפי הקטגוריה */
  split?: SplitKind;
  /** של מי ההוצאה האישית. ריק = בעל החשבון שממנו שולמה */
  forPersonId?: string;
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
  note?: string;
}
