import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// כשהעמוד מוגש בתוך מעטפת חיצונית (למשל Artifact), התגיות של המסמך שלנו
// אינן בהכרח שורש הדף – ולכן מוודאים כאן שהכיווניות והשפה נכונות.
document.documentElement.setAttribute('dir', 'rtl');
document.documentElement.setAttribute('lang', 'he');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
