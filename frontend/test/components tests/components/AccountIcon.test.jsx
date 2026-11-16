import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import AccountIcon from '../../../src/components/AccountIcon.jsx';

describe('AccountIcon Component', () => {

  it('should render the correct icon path based on the "name" prop (e.g. shield)', () => {
    const { container } = render(<AccountIcon name="shield" />);
    const svg = container.querySelector('svg');
    const path = container.querySelector('path');

    expect(svg).toBeDefined();
    expect(path).toBeDefined();
    // Verifica che l'attributo d del percorso corrisponda a quello dello "shield"
    expect(path.getAttribute('d')).toBe('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z');
  });

  it('should apply default size (19) when size prop is omitted', () => {
    const { container } = render(<AccountIcon name="lock" />);
    const svg = container.querySelector('svg');

    expect(svg.getAttribute('width')).toBe('19');
    expect(svg.getAttribute('height')).toBe('19');
  });

  it('should apply custom size and className when provided', () => {
    const { container } = render(<AccountIcon name="edit" size={32} className="custom-icon-class" />);
    const svg = container.querySelector('svg');

    expect(svg.getAttribute('width')).toBe('32');
    expect(svg.getAttribute('height')).toBe('32');
    expect(svg.getAttribute('class')).toContain('custom-icon-class');
  });

  it('should fall back to "user" icon when an unknown name is provided', () => {
    const { container } = render(<AccountIcon name="non-existent-icon" />);
    const circle = container.querySelector('circle');
    const path = container.querySelector('path');

    // L'icona "user" ha un elemento circle (cx="12", cy="8", r="4") e un path
    expect(circle).toBeDefined();
    expect(circle.getAttribute('cx')).toBe('12');
    expect(circle.getAttribute('cy')).toBe('8');
    expect(circle.getAttribute('r')).toBe('4');
    expect(path).toBeDefined();
  });

  it('should render with proper accessibility attributes (aria-hidden and focusable)', () => {
    const { container } = render(<AccountIcon name="mail" />);
    const svg = container.querySelector('svg');

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('focusable')).toBe('false');
  });

  it('should render various supported icons without throwing errors', () => {
    const iconNames = [
      'user', 'shield', 'lock', 'edit', 'arrow', 'camera', 
      'upload', 'trash', 'mail', 'phone', 'note', 'contact', 'logout'
    ];

    iconNames.forEach((name) => {
      const { container } = render(<AccountIcon name={name} />);
      expect(container.querySelector('svg')).toBeDefined();
    });
  });

});