import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import EdelweissBrand from '../../src/components/EdelweissBrand.jsx';

describe('EdelweissBrand Component Tests', () => {

  it('should render brand title and default tagline when compact is false', () => {
    render(<EdelweissBrand />);

    // Verify brand title is present
    expect(screen.getByText('Edelweiss Hut')).toBeInTheDocument();

    // Verify default tagline is present
    expect(screen.getByText('SECEDA · DOLOMITES')).toBeInTheDocument();
  });

  it('should hide the tagline when compact prop is set to true', () => {
    render(<EdelweissBrand compact={true} />);

    // Verify brand title is present
    expect(screen.getByText('Edelweiss Hut')).toBeInTheDocument();

    // Verify tagline is not rendered
    expect(screen.queryByText('SECEDA · DOLOMITES')).not.toBeInTheDocument();
  });

  it('should apply the light style class when light prop is set to true', () => {
    const { container } = render(<EdelweissBrand light={true} />);

    // Verify the wrapper span contains the light modifier class
    const brandElement = container.querySelector('.eh-brand');
    expect(brandElement).toHaveClass('eh-brand--light');
  });

  it('should render the decorative SVG mark with aria-hidden attribute', () => {
    const { container } = render(<EdelweissBrand />);

    const svgElement = container.querySelector('svg.eh-brand-mark');
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveAttribute('aria-hidden', 'true');
  });

});