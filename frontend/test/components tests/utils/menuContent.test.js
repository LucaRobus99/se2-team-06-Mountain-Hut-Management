import { describe, it, expect } from 'vitest';
import { menuToHtml } from '../../../src/utils/menuContent.js';

describe('menu formatting', () => {
  it('formats text and nested lists', () => {
    expect(menuToHtml('**Main**\n- Polenta\n  - *Mushrooms*\n- Bread')).toBe('<p><strong>Main</strong></p><ul><li>Polenta<ul><li><em>Mushrooms</em></li></ul></li><li>Bread</li></ul>');
  });
  it('escapes user-supplied markup', () => {
    expect(menuToHtml('<img src=x> & bread')).toBe('<p>&lt;img src=x&gt; &amp; bread</p>');
  });
  it('handles empty content', () => expect(menuToHtml(' \n')).toBe(''));
});
