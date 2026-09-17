import { useCallback } from 'react';
import { formatMoney, formatSigned } from './money';
import { useStore } from './store';

/** עיצוב סכומים לפי הגדרות משק הבית (מטבע ושפה) */
export function useMoneyFormat() {
  const { state } = useStore();
  const { locale, currency } = state.settings;
  const money = useCallback(
    (v: number, decimals = false) => formatMoney(v, { locale, currency, decimals }),
    [locale, currency],
  );
  const signed = useCallback((v: number) => formatSigned(v, { locale, currency }), [locale, currency]);
  return { money, signed, currency, locale };
}
