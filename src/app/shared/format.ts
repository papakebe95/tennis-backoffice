import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nService, type Lang } from '../core/i18n/i18n.service';

const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

/** "il y a 3 h" / "3 hours ago". */
export function relativeTime(iso: string, lang: Lang, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const format = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'auto' });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return format.format(seconds, 'second');
}

export type DateStyle = 'date' | 'datetime' | 'slot' | 'time';

/**
 * 'date' / 'datetime' in the browser's time zone; 'slot' ("sam. 11 oct.,
 * 10:00") and 'time' ("10:00") on tournament wall-clock time, which is Dakar
 * time (UTC) wherever the screen is.
 */
export function formatDate(iso: string | null | undefined, lang: Lang, style: DateStyle = 'datetime'): string {
  if (!iso) return '';
  const options: Intl.DateTimeFormatOptions =
    style === 'slot'
      ? { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
      : style === 'time'
        ? { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }
        : { dateStyle: 'medium', ...(style === 'datetime' ? { timeStyle: 'short' as const } : {}) };
  return new Intl.DateTimeFormat(LOCALES[lang], options).format(new Date(iso));
}

/** A picker's local wall-clock date/time → the same wall-clock time in UTC (Dakar). */
export function wallClockIso(date: Date): string {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes())).toISOString();
}

/** The inverse: an ISO instant shown in a local picker at its UTC wall-clock time. */
export function fromWallClock(iso: string): Date {
  const d = new Date(iso);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes());
}

/** `{{ iso | tbDate }}` / `{{ iso | tbDate: 'date' }}` in the UI language. */
@Pipe({ name: 'tbDate', pure: false })
export class TbDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(iso: string | null | undefined, style: DateStyle = 'datetime'): string {
    return formatDate(iso, this.i18n.lang(), style);
  }
}

/** `{{ iso | tbAgo }}`: relative time in the UI language. */
@Pipe({ name: 'tbAgo', pure: false })
export class TbAgoPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(iso: string | null | undefined): string {
    return iso ? relativeTime(iso, this.i18n.lang()) : '';
  }
}

/** Human label of an audit action ("user.roles.granted" → "Rôle attribué"). */
export function auditActionLabel(i18n: I18nService, action: string): string {
  const key = `audit.actions.${action.replace(/\./g, '_')}`;
  return i18n.has(key) ? i18n.t(key) : action;
}

/** "60 000 FCFA" — amounts are whole francs (XOF has no minor unit). */
export function formatMoney(amount: number | string | null | undefined, lang: Lang, currency = 'XOF'): string {
  if (amount === null || amount === undefined || amount === '') return '—';
  const value = new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 0 }).format(Number(amount));
  return currency === 'XOF' ? `${value} FCFA` : `${value} ${currency}`;
}

/** `{{ amount | tbMoney }}` in the UI language. */
@Pipe({ name: 'tbMoney', pure: false })
export class TbMoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(amount: number | string | null | undefined, currency = 'XOF'): string {
    return formatMoney(amount, this.i18n.lang(), currency);
  }
}
