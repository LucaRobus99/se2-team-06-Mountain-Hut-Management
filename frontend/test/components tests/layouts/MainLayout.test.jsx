import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import MainLayout from '../../../src/layouts/MainLayout.jsx';

// Mock AppNavbar to isolate MainLayout testing
vi.mock('../../../src/components/AppNavbar.jsx', () => ({
  default: () => <nav data-testid="app-navbar">Mocked Navbar</nav>,
}));

describe('MainLayout Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render navbar, footer information, and full-width main section on home route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div data-testid="child-outlet">Home Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify navbar and footer sections are present
    expect(screen.getByTestId('app-navbar')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo', { name: /site footer/i })).toBeInTheDocument();
    
    // Verify footer details
    expect(screen.getByRole('heading', { level: 2, name: /find us/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /opening hours/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /contact/i })).toBeInTheDocument();
    expect(screen.getByText(/streda mastlè 64/i)).toBeInTheDocument();

    // Verify child route content is rendered
    expect(screen.getByTestId('child-outlet')).toBeInTheDocument();

    // Verify that full-width route applies 'eh-home-main' class instead of Container wrapper
    const mainElement = screen.getByTestId('child-outlet').parentElement;
    expect(mainElement).toHaveClass('eh-home-main');
  });

  it('should wrap outlet content in a container for non-full-width routes', () => {
    render(
      <MemoryRouter initialEntries={['/staff/dashboard']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/staff/dashboard" element={<div data-testid="dashboard-outlet">Dashboard Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify child route content is rendered
    expect(screen.getByTestId('dashboard-outlet')).toBeInTheDocument();

    // Verify that non-full-width routes include the py-4 py-md-5 classes and wrap children in a container
    const mainElement = screen.getByTestId('dashboard-outlet').parentElement.parentElement;
    expect(mainElement).toHaveClass('py-4');
    expect(mainElement).toHaveClass('py-md-5');
  });

});