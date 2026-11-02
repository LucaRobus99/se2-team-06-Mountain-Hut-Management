import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import MenuPage from '../../src/pages/MenuPage.jsx';

describe('MenuPage Component Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page heading and introductory text', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Public page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Our menu' })).toBeInTheDocument();
    expect(screen.getByText(/a simple overview of the meal moments/i)).toBeInTheDocument();
  });

  it('should render all menu sections with their hours and items', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    // Verifica le sezioni dei pasti
    expect(screen.getByRole('heading', { level: 2, name: 'Breakfast' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lunch' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Aperitivo' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Dinner' })).toBeInTheDocument();

    // Verifica alcuni orari e voci del menu
    expect(screen.getByText('08:30 – 10:30')).toBeInTheDocument();
    expect(screen.getByText('Homemade cakes')).toBeInTheDocument();
    expect(screen.getByText('Mountain pasta')).toBeInTheDocument();
    expect(screen.getByText('Local cheeses')).toBeInTheDocument();
    expect(screen.getByText('Warm alpine plates')).toBeInTheDocument();
  });

});