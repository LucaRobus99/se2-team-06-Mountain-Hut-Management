import { describe, it, expect } from 'vitest';
import { validateMenuInput } from '../../../../src/services/menuValidation.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('menuValidation - Black-Box Tests', () => {
  it('accepts valid menu name and rich-text content', () => {
    const output = validateMenuInput({
      name: 'Refuge Dinner',
      content: '<ul><li>Polenta</li><li><em>Spezzatino</em></li></ul>',
    });

    expect(output.name).toBe('Refuge Dinner');
    expect(output.content).toContain('Polenta');
    expect(output.content).toContain('Spezzatino');
  });

  it('rejects missing or blank menu name', () => {
    expect(() => validateMenuInput({ name: '', content: 'Soup' })).toThrow(ValidationError);
    expect(() => validateMenuInput({ name: '   ', content: 'Soup' })).toThrow(ValidationError);
  });

  it('rejects missing or blank menu content', () => {
    expect(() => validateMenuInput({ name: 'Lunch', content: '' })).toThrow(ValidationError);
    expect(() => validateMenuInput({ name: 'Lunch', content: '   ' })).toThrow(ValidationError);
  });

  it('rejects non-positive or non-integer mealId values', () => {
    expect(() => validateMenuInput({ name: 'Lunch', content: 'Soup', mealId: 0 })).toThrow(ValidationError);
    expect(() => validateMenuInput({ name: 'Lunch', content: 'Soup', mealId: -1 })).toThrow(ValidationError);
    expect(() => validateMenuInput({ name: 'Lunch', content: 'Soup', mealId: 'abc' })).toThrow(ValidationError);
  });

  it('rejects content containing script tags or event handlers', () => {
    expect(() =>
      validateMenuInput({ name: 'Lunch', content: '<script>evil()</script>' })
    ).toThrow(ValidationError);
    expect(() =>
      validateMenuInput({ name: 'Lunch', content: '<p onload="evil()">Ok</p>' })
    ).toThrow(ValidationError);
  });
});