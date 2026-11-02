import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import HomePage from '../../src/pages/HomePage.jsx';
import { useAuth } from '../../src/auth/AuthContext.jsx';

// Mock AuthContext
vi.mock('../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('HomePage Component Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render welcome heading and main navigation options when logged out', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // Verifica la presenza del titolo principale della Hero
    expect(screen.getByRole('heading', { level: 1, name: /take a break/i })).toBeInTheDocument();
    
    // Verifica la presenza del pulsante/link per prenotare
    expect(screen.getByRole('link', { name: /book a table/i })).toBeInTheDocument();
  });

  it('should render successfully when user is logged in', () => {
    const mockUser = { id: 1, name: 'Mario Rossi', role: 'hiker' };
    useAuth.mockReturnValue({ user: mockUser, loadingAuth: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // La home page mostra i contenuti pubblici anche se l'utente è autenticato
    expect(screen.getByRole('heading', { level: 1, name: /take a break/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /check availability/i })).toBeInTheDocument();
  });

});