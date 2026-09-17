/**
 * הופך את תוצר הבנייה (dist/index.html) לעמוד יחיד שניתן לפרסם כ-Artifact:
 * מעטפת הפרסום מוסיפה בעצמה doctype/html/head/body, ולכן צריך לספק תוכן בלבד.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const html = readFileSync(resolve(dist, 'index.html'), 'utf8');

const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
const body = html.match(/<body>([\s\S]*?)<\/body>/)?.[1] ?? '';

// שומרים רק את מה שרלוונטי: כותרת, גופנים, ונכסי הבנייה
const keep = head
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => /<title|fonts\.googleapis|fonts\.gstatic|<script|rel="stylesheet"|rel="icon"/.test(line))
  .join('\n');

writeFileSync(resolve(dist, 'artifact.html'), `${keep}\n${body.trim()}\n`, 'utf8');
console.log('dist/artifact.html written');
