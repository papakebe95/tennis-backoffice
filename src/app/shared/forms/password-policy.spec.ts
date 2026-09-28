import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { failedPasswordRules, matchingFields, strongPassword } from './password-policy';

describe('password policy', () => {
  it('matches the API policy (10 chars, lower, upper, digit, symbol)', () => {
    expect(failedPasswordRules('Admin@2026!')).toEqual([]);
    expect(failedPasswordRules('admin2026')).toEqual(['length', 'upper', 'symbol']);
  });

  it('leaves emptiness to the required validator', () => {
    expect(strongPassword(new FormControl(''))).toBeNull();
    expect(strongPassword(new FormControl('short'))).toMatchObject({ weakPassword: expect.any(Array) });
  });

  it('flags mismatching confirmation', () => {
    const group = new FormGroup({ a: new FormControl('x'), b: new FormControl('y') });
    expect(matchingFields('a', 'b')(group)).toEqual({ mismatch: true });
    group.controls.b.setValue('x');
    expect(matchingFields('a', 'b')(group)).toBeNull();
  });
});
