import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import MainLayout from '../../../src/layouts/MainLayout.jsx';

// Mock AppNavbar to isolate MainLayout testing
vi.mock('../../../src/components/AppNavbar.jsx', () => ({
  default: () => <nav data-testid="app-navbar">Mocked Navbar</nav>,
}));

describe('MainLayout Component Integration Tests', () => {
  it('scrolls to the top when Directions is clicked again on Find us', () => {
    const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<MemoryRouter initialEntries={['/find-us#getting-here']}><Routes>
      <Route element={<MainLayout />}><Route path="/find-us" element={<p>Find us page</p>} /></Route>
    </Routes></MemoryRouter>);
    fireEvent.click(screen.getByRole('link', { name: /directions/i }));
    expect(scroll).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'smooth' });
    scroll.mockRestore();
  });

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

  it('should render full-width layout correctly on /my-bookings route', () => {
    render(
      <MemoryRouter initialEntries={['/my-bookings']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/my-bookings" element={<div data-testid="bookings-outlet">My Bookings Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('bookings-outlet')).toBeInTheDocument();
    
    // Verify that /my-bookings applies 'eh-home-main' just like other full-width routes
    const mainElement = screen.getByTestId('bookings-outlet').parentElement;
    expect(mainElement).toHaveClass('eh-home-main');
  });

  it('should render full-width layout correctly on /my-account route', () => {
    render(
      <MemoryRouter initialEntries={['/my-account']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/my-account" element={<div data-testid="account-outlet">Account Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('account-outlet')).toBeInTheDocument();
    
    // Verify that /my-account applies 'eh-home-main' just like other full-width routes
    const mainElement = screen.getByTestId('account-outlet').parentElement;
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

  it('should render full-width layout on dynamic /book/confirmation/:bookingId routes', () => {
    render(
      <MemoryRouter initialEntries={['/book/confirmation/42']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route
              path="/book/confirmation/:bookingId"
              element={<div data-testid="confirmation-outlet">Confirmation Content</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('confirmation-outlet')).toBeInTheDocument();

    // Verify dynamic confirmation routes trigger the startsWith('/book/confirmation/') full-width branch
    const mainElement = screen.getByTestId('confirmation-outlet').parentElement;
    expect(mainElement).toHaveClass('eh-home-main');
    expect(mainElement).not.toHaveClass('py-4');
  });

  it('should render correct footer links and current copyright year', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<MainLayout />}>
            <Route path="/" element={<div>Home</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    // Verify directions anchor link and contact links
    expect(screen.getByRole('link', { name: /directions/i })).toHaveAttribute('href', '/find-us#getting-here');
    expect(screen.getByRole('link', { name: /\+39 366 364 9009/i })).toHaveAttribute('href', 'tel:+393663649009');
    expect(screen.getByRole('link', { name: /info@edelweisshut\.example/i })).toHaveAttribute(
      'href',
      'mailto:info@edelweisshut.example'
    );

    // Verify dynamic copyright year
    const currentYear = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${currentYear} Edelweiss Hut`))).toBeInTheDocument();
  });

});
