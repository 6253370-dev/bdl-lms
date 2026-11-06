// Azərbaycan dilində ay və həftə günü adları.
// Brauzerlərin bir qismində `toLocaleDateString("az-AZ", …)` "M11", "MON" kimi
// nəticə verir (ICU-da az lokalı olmur), ona görə adlar burada sabit saxlanılır.

export const AZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "İyun",
  "İyul", "Avqust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
] as const;

export const AZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "İyn",
  "İyl", "Avq", "Sen", "Okt", "Noy", "Dek",
] as const;

/** Bazar ertəsindən başlayaraq. */
export const AZ_WEEKDAYS_SHORT = ["B.e", "Ç.a", "Ç", "C.a", "C", "Ş", "B"] as const;

/** JS `getDay()` (0 = bazar) üçün qısa həftə günü. */
export function azWeekdayShort(d: Date): string {
  return AZ_WEEKDAYS_SHORT[(d.getDay() + 6) % 7];
}

/** "06 Noyabr 2026" */
export function azDateLong(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "Noyabr 2026" */
export function azMonthYear(d: Date): string {
  return `${AZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "02 Noy" */
export function azDayMonthShort(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")} ${AZ_MONTHS_SHORT[d.getMonth()]}`;
}

/** "HH:MM" (24 saat) */
export function azTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
