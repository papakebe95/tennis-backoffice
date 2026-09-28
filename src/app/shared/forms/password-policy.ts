import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import type { I18nKey } from '../../core/i18n/i18n.service';

// Same policy the API enforces on new passwords (ChangePasswordDto:
// IsStrongPassword 10/1/1/1/1). Checked here for instant feedback only.
export const PASSWORD_RULES: readonly { id: string; label: I18nKey; test: (v: string) => boolean }[] = [
  { id: 'length', label: 'password.rules.length', test: (v) => v.length >= 10 },
  { id: 'lower', label: 'password.rules.lower', test: (v) => /[a-z]/.test(v) },
  { id: 'upper', label: 'password.rules.upper', test: (v) => /[A-Z]/.test(v) },
  { id: 'digit', label: 'password.rules.digit', test: (v) => /\d/.test(v) },
  { id: 'symbol', label: 'password.rules.symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export const failedPasswordRules = (value: string) =>
  PASSWORD_RULES.filter((rule) => !rule.test(value)).map((rule) => rule.id);

export const strongPassword: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = typeof control.value === 'string' ? control.value : '';
  if (!value) return null; // `required` reports emptiness
  const failed = failedPasswordRules(value);
  return failed.length ? { weakPassword: failed } : null;
};

/** Group validator: `field` must equal `other`. */
export const matchingFields =
  (field: string, other: string): ValidatorFn =>
  (group: AbstractControl): ValidationErrors | null => {
    const a = group.get(field)?.value;
    const b = group.get(other)?.value;
    return a && b && a !== b ? { mismatch: true } : null;
  };
