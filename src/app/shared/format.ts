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

export function formatDate(iso: string | null | undefined, lang: Lang, style: 'date' | 'datetime' = 'datetime'): string {
  if (!iso) return '';
  return new Intl.DateTimeFormat(LOCALES[lang], {
    dateStyle: 'medium',
    ...(style === 'datetime' ? { timeStyle: 'short' } : {}),
  }).format(new Date(iso));
}

/** `{{ iso | tbDate }}` / `{{ iso | tbDate: 'date' }}` in the UI language. */
@Pipe({ name: 'tbDate', pure: false })
export class TbDatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);
  transform(iso: string | null | undefined, style: 'date' | 'datetime' = 'datetime'): string {
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
