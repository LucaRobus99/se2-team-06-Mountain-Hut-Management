import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import NotFoundPage from '../../src/pages/NotFoundPage.jsx';

describe('NotFoundPage Component Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render 404 message and return home link', () => {
    render(
      <MemoryRouter>
        <NotFoundPage />
      </MemoryRouter>
    );

    // Verifica la presenza dell'intestazione e del messaggio descrittivo
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByText('The requested page does not exist.')).toBeInTheDocument();

    // React-Bootstrap Button as={Link} assegna il ruolo "button" all'elemento <a>
    const returnHomeButton = screen.getByRole('button', { name: /return home/i });
    expect(returnHomeButton).toBeInTheDocument();
    expect(returnHomeButton).toHaveAttribute('href', '/');
  });

});