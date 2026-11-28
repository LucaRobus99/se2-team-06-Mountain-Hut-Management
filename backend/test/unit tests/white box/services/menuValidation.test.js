import { describe, it, expect } from 'vitest';
import { validateMenuInput } from '../../../../src/services/menuValidation.js';
import { ValidationError } from '../../../../src/errors/AppError.js';

describe('menuValidation - White-Box Tests', () => {
  it('trims name and content and preserves mealId when provided as positive integer or numeric string', () => {
    expect(
      validateMenuInput({
        name: '  Alpine Lunch  ',
        content: '  <p><strong>Polenta</strong> e funghi</p>  ',
        mealId: '2',
      })
    ).toEqual({
      name: 'Alpine Lunch',
      content: '<p><strong>Polenta</strong> e funghi</p>',
      mealId: 2,
    });

    expect(
      validateMenuInput({
        name: 'Breakfast',
        content: 'Brioche',
        mealId: null,
      })
    ).toEqual({
      name: 'Breakfast',
      content: 'Brioche',
      mealId: undefined,
    });
  });

  it('collects multiple field errors in a single ValidationError when multiple checks fail', () => {
    let caught;
    try {
      validateMenuInput({
        name: '   ',
        content: '<script>alert(1)</script>',
        mealId: -3,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ValidationError);
    expect(caught.details).toEqual([
      { field: 'mealId', message: 'Meal ID must be a positive integer.' },
      { field: 'name', message: 'Menu name is required.' },
      { field: 'content', message: 'Menu content contains disallowed or unsafe HTML/scripts.' },
    ]);
  });

  it('enforces the 100-character limit on menu name and checks case-insensitive unsafe patterns', () => {
    const tooLongName = 'a'.repeat(101);
    expect(() =>
      validateMenuInput({ name: tooLongName, content: 'Valid content' })
    ).toThrow(ValidationError);

    const unsafePatterns = [
      '<SCRIPT src="x.js"></SCRIPT>',
      '<a href="JaVaScRiPt:alert(1)">link</a>',
      '<img src="x" OnError="alert(1)">',
      '<body OnLoAd="init()">',
      '<IFRAME src="evil.html"></IFRAME>',
      '<OBJECT data="evil.swf"></OBJECT>',
      '<EMBED src="evil.swf"></EMBED>',
    ];

    for (const badContent of unsafePatterns) {
      expect(() =>
        validateMenuInput({ name: 'Valid Name', content: badContent })
      ).toThrow(ValidationError);
    }
  });

  it('sanitizes event handler attributes that pass the initial blocklist in sanitizeRichText', () => {
    const res = validateMenuInput({
      name: 'Sanitized Menu',
      content: '<p onclick="steal()"><ul><li>Item</li></ul></p>',
    });

    expect(res.content).toBe('<p data-removed="steal()"><ul><li>Item</li></ul></p>');
  });
});