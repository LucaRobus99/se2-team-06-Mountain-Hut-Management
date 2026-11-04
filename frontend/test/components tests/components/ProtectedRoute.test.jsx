import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import ProtectedRoute from '../../../src/components/ProtectedRoute.jsx';
import { useAuth } from '../../../src/auth/AuthContext.jsx';

// Mock the useAuth hook to control user state and loading status in tests
vi.mock('../../../src/auth/AuthContext.jsx', () => ({
  useAuth: vi.fn(),
}));

describe('ProtectedRoute Component Integration Tests', () => {

  it('should render loading status element while authentication is loading', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: true });

    render(
      <MemoryRouter>
        <ProtectedRoute />
      </MemoryRouter>
    );

    const loadingElement = screen.getByRole('status');
    expect(loadingElement).toBeInTheDocument();
    expect(loadingElement).toHaveTextContent('Loading…');
  });

  it('should redirect to /login when user is not authenticated', () => {
    useAuth.mockReturnValue({ user: null, loadingAuth: false });

    render(
      <MemoryRouter initialEntries={['/protected-page']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected-page" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('should render outlet content for an authenticated user when staffOnly is false', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });

    render(
      <MemoryRouter initialEntries={['/protected-page']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/protected-page" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('should redirect to home (/) when a non-staff user tries to access a staff-only route', () => {
    useAuth.mockReturnValue({ user: { id: 1, role: 'hiker' }, loadingAuth: false });

    render(
      <MemoryRouter initialEntries={['/staff-page']}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route element={<ProtectedRoute staffOnly={true} />}>
            <Route path="/staff-page" element={<div>Staff Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Home Page')).toBeInTheDocument();
  });

  it('should allow an employee or warden to access a staff-only route', () => {
    useAuth.mockReturnValue({ user: { id: 2, role: 'employee' }, loadingAuth: false });

    render(
      <MemoryRouter initialEntries={['/staff-page']}>
        <Routes>
          <Route path="/" element={<div>Home Page</div>} />
          <Route element={<ProtectedRoute staffOnly={true} />}>
            <Route path="/staff-page" element={<div>Staff Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Staff Content')).toBeInTheDocument();
  });

  it('should redirect staff to /staff when they try to access a hiker-only route', () => {
    useAuth.mockReturnValue({ user: { id: 2, role: 'employee' }, loadingAuth: false });

    render(
      <MemoryRouter initialEntries={['/hiker-page']}>
        <Routes>
          <Route path="/staff" element={<div>Staff Dashboard</div>} />
          <Route element={<ProtectedRoute hikerOnly={true} />}>
            <Route path="/hiker-page" element={<div>Hiker Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Staff Dashboard')).toBeInTheDocument();
  });

});