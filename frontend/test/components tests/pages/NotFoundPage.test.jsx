import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NotFoundPage from '../../../src/pages/NotFoundPage.jsx';

describe('NotFoundPage Component Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render 404 eyebrow, main heading, and return home link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    // Verify the presence of the 404 eyebrow and the main heading
    expect(screen.getByText(/404 · wrong trail/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /we can't find that path/i })).toBeInTheDocument();
    
    // Verify the descriptive message
    expect(screen.getByText(/the page you're looking for doesn't exist/i)).toBeInTheDocument();

    // Verify the home link / button and its target attribute
    const homeLink = screen.getByRole('link', { name: /back to the home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute('href', '/');
  });

});