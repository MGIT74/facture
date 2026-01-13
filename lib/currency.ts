export const CURRENCIES = {
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', locale: 'fr-FR' },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', locale: 'en-US' },
  CHF: { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', locale: 'fr-CH' },
} as const

export type CurrencyCode = keyof typeof CURRENCIES

export function formatCurrency(
  amount: number,
  currencyCode: CurrencyCode = 'EUR'
): string {
  const currency = CURRENCIES[currencyCode]

  return new Intl.NumberFormat(currency.locale, {
    style: 'currency',
    currency: currency.code,
  }).format(amount)
}

export function formatDate(date: string | Date, locale: string = 'fr-FR'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dateObj)
}

export function formatShortDate(date: string | Date, locale: string = 'fr-FR'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(dateObj)
}
