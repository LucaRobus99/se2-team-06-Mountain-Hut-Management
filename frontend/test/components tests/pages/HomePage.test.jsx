import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import HomePage from '../../../src/pages/HomePage.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock react-router's useNavigate to track route redirection
const mockNavigate = vi.fn();
vi.mock('react-router', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock AuthContext
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
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
    
    // Verifica la presenza del pulsante/link per prenotare (per utenti non hiker reindirizza a /availability)
    const bookLink = screen.getByRole('link', { name: /book a table/i });
    expect(bookLink).toBeInTheDocument();
    expect(bookLink).toHaveAttribute('href', '/availability');
  });

  it('should render successfully when user is logged in as hiker', () => {
    const mockUser = { id: 1, name: 'Mario Rossi', role: 'hiker' };
    useAuth.mockReturnValue({ user: mockUser, loadingAuth: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    // La home page mostra i contenuti pubblici e per gli hiker il link di prenotazione punta a /book
    expect(screen.getByRole('heading', { level: 1, name: /take a break/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /check availability/i })).toBeInTheDocument();

    const bookLink = screen.getByRole('link', { name: /book a table/i });
    expect(bookLink).toHaveAttribute('href', '/book');
  });

  it('should perform search and navigate to availability/booking when search form is submitted with valid inputs', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const guestsInput = screen.getByLabelText(/guests/i);
    await user.clear(guestsInput);
    await user.type(guestsInput, '3');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Verifica che il reindirizzamento avvenga con i parametri corretti nell'URL
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/availability?date=') &&
      expect.stringContaining('&meal=lunch&guests=3')
    );
  });

  it('should show error message if search form receives invalid guest count', async () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });

    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    );

    const guestsInput = screen.getByLabelText(/guests/i);
    
    // Rimuoviamo l'attributo min per evitare che la validazione HTML5 blocchi il submit del form nel test
    guestsInput.removeAttribute('min');

    const user = userEvent.setup();
    await user.clear(guestsInput);
    await user.type(guestsInput, '0');

    const searchButton = screen.getByRole('button', { name: /search/i });
    await user.click(searchButton);

    // Verifica la visualizzazione del messaggio di errore
    expect(screen.getByText(/please choose a valid date, meal and number of guests/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

});