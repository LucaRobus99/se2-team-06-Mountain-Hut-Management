import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StaffReservationsPage from '../../../src/pages/StaffReservationsPage.jsx';

describe('StaffReservationsPage Component Tests', () => {
  it('renders the reservations heading and coming soon section', () => {
    render(<StaffReservationsPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: /reservations/i })
    ).toBeInTheDocument();

    const section = screen.getByRole('region', { name: /reservations coming soon/i });
    expect(section).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: /coming soon/i })
    ).toBeInTheDocument();
  });
});