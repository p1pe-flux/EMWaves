import { describe, expect, it } from 'vitest';
import { DOMAIN_ERROR_MESSAGES, DOMAIN_VALUE_LABELS, DomainError, type FixedDomainErrorCode } from './domain/errors';
import { translateMessage } from './i18n-messages';

describe('structured domain error localization', () => {
  it.each(Object.keys(DOMAIN_ERROR_MESSAGES) as FixedDomainErrorCode[])('translates the stable %s code', (code) => {
    const error = new DomainError(code);
    expect(translateMessage(error, 'en')).toBe(DOMAIN_ERROR_MESSAGES[code]);
    const translated = translateMessage(error, 'es');
    expect(translated.length).toBeGreaterThan(0);
    expect(translated).not.toBe(error.message);
    expect(translateMessage(error.message, 'es')).toBe(translated);
  });

  it.each(DOMAIN_VALUE_LABELS)('translates all validation kinds and coordinates for %s', (label) => {
    for (const parameter of [label, `${label}: real part`, `${label}: imaginary part`] as const) {
      for (const code of ['value.not-finite', 'value.not-positive', 'value.negative'] as const) {
        const error = new DomainError(code, { label: parameter });
        const translated = translateMessage(error, 'es');
        expect(translated).not.toBe(error.message);
        expect(translated).not.toContain('undefined');
        expect(translated).toContain('debe ser');
      }
    }
  });

  it('localizes codes even when English wording changes', () => {
    const error = new DomainError('projection.invalid-bounds');
    error.message = 'Updated author-facing wording.';
    expect(translateMessage(error, 'es')).toBe('Los límites de la proyección deben ser finitos y tener anchura y altura positivas.');
    expect(translateMessage(error, 'en')).toBe('Updated author-facing wording.');
  });

  it('preserves the legacy string and ordinary Error boundary', () => {
    expect(translateMessage('Resistance must be greater than or equal to zero.', 'es')).toBe('La resistencia debe ser mayor o igual que cero.');
    expect(translateMessage(new Error('Check the parameters.'), 'es')).toBe('Revisa los parámetros.');
    expect(translateMessage(new Error('__unknown__'), 'es')).toBe('__unknown__');
    expect(translateMessage('toString', 'es')).toBe('toString');
    expect(translateMessage('__proto__', 'es')).toBe('__proto__');
    expect(translateMessage('constructor must be a finite number.', 'es')).toBe('constructor must be a finite number.');
  });
});
