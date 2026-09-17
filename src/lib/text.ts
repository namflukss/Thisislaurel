/** ניסוח בעברית לפי כמות: "חשבון אחד" מול "3 חשבונות" */
export function plural(count: number, one: string, many: string): string {
  if (count === 1) return `${one} אחד`;
  return `${count} ${many}`;
}

export function pluralF(count: number, one: string, many: string): string {
  if (count === 1) return `${one} אחת`;
  return `${count} ${many}`;
}
