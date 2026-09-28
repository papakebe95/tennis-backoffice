import { Injectable, signal } from '@angular/core';
import { en } from './locales/en';
import { fr, type Dictionary } from './locales/fr';

export const LANGS = ['fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** Every translatable key, e.g. "auth.login.title". */
export type I18nKey = Paths<Dictionary>;
export type I18nParams = Record<string, string | number | null | undefined>;

const DICTIONARIES: Record<Lang, Dictionary> = { fr, en };
const STORAGE_KEY = 'tb.lang';

const lookup = (dictionary: unknown, key: string): string | undefined => {
  let node = dictionary;
  for (const part of key.split('.')) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string' ? node : undefined;
};

/**
 * Runtime translations. `t()` reads the `lang` signal, so templates and
 * computed values calling it update when the language changes. The same
 * language is sent to the API (`lang` header) so its messages match.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<Lang>(readStoredLang());

  setLang(lang: Lang) {
    this.lang.set(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Storage unavailable (private mode): the choice lasts for this tab.
    }
    document.documentElement.lang = lang;
  }

  readonly t = (key: I18nKey | string, params?: I18nParams): string => {
    const template = lookup(DICTIONARIES[this.lang()], key) ?? lookup(DICTIONARIES.fr, key) ?? key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      params?.[name] != null ? String(params[name]) : match,
    );
  };

  /** True when `key` exists (dynamic keys such as error codes). */
  has(key: string): boolean {
    return lookup(DICTIONARIES[this.lang()], key) !== undefined;
  }
}

function readStoredLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (LANGS as readonly string[]).includes(stored)) return stored as Lang;
  } catch {
    // ignore
  }
  return 'fr';
}
