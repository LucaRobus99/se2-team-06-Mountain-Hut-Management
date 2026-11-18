import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, useNavigate } from 'react-router';
import { useEffect } from 'react';
import ScrollToTop from '../../../src/components/ScrollToTop.jsx';

// Helper component to trigger navigation changes during tests
function NavigationTrigger({ to }) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(to);
  }, [navigate, to]);
  return null;
}

describe('ScrollToTop Component Tests', () => {
  beforeEach(() => {
    // Spy on and mock window.scrollTo
    vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render nothing (null)', () => {
    const { container } = render(
      <MemoryRouter>
        <ScrollToTop />
      </MemoryRouter>
    );
    expect(container.firstChild).toBeNull();
  });

  it('should scroll to top (0, 0) on initial mount', () => {
    render(
      <MemoryRouter initialEntries={['/initial-page']}>
        <ScrollToTop />
      </MemoryRouter>
    );

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });

  it('should scroll to top when pathname changes', () => {
    render(
      <MemoryRouter initialEntries={['/page-one']}>
        <ScrollToTop />
        <NavigationTrigger to="/page-two" />
      </MemoryRouter>
    );

    // Initial mount + navigation change should trigger window.scrollTo at least twice
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
    expect(window.scrollTo).toHaveBeenCalledTimes(2);
  });

  it('should scroll to top when search parameters change', () => {
    render(
      <MemoryRouter initialEntries={['/page?tab=info']}>
        <ScrollToTop />
        <NavigationTrigger to="/page?tab=settings" />
      </MemoryRouter>
    );

    expect(window.scrollTo).toHaveBeenCalledTimes(2);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      left: 0,
      behavior: 'auto',
    });
  });
});