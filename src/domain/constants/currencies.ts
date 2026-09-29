const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  USD: '$',
  RUB: '₽',
  BYN: 'Br',
};

/** Символ валюты по ISO-коду; если неизвестен — возвращаем код. */
export function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}
