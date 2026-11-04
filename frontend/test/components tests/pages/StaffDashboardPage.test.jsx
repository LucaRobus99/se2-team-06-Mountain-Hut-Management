import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StaffDashboardPage from '../../../src/pages/StaffDashboardPage.jsx';
import { listStaffSlots } from '../../../src/api/slots.js';

// Mock the slots API functions
vi.mock('../../../src/api/slots.js', () => ({
  listStaffSlots: vi.fn(),
  mealLabel: vi.fn((meal) => meal ? meal[0].toUpperCase() + meal.slice(1) : ''),
  todayInHut: vi.fn(() => '2026-11-15'),
}));

describe('StaffDashboardPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page headings, stats overview, and slots schedule list', async () => {
    listStaffSlots.mockResolvedValueOnce({
      slots: [
        { id: 1, meal: 'lunch', status: 'available', startTime: '12:00', endTime: '13:00', tables: [{ tableId: 10, tableIdentifier: 'T1', seats: 4 }] }
      ]
    });

    render(
      <MemoryRouter>
        <StaffDashboardPage />
      </MemoryRouter>
    );

    // Verify header and navigation link
    expect(screen.getByRole('heading', { level: 1, name: /overview/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /manage slots/i })).toHaveAttribute('href', '/staff/slots');

    // Verify stats labels appear
    expect(screen.getByText(/scheduled slots/i)).toBeInTheDocument();
    expect(screen.getByText(/available slots/i)).toBeInTheDocument();
    expect(screen.getByText(/configured seats/i)).toBeInTheDocument();

    // Verify slot details are rendered successfully after loading
    expect(await screen.findByText('12:00 – 13:00')).toBeInTheDocument();
    expect(screen.getByText(/lunch/i)).toBeInTheDocument();
    
    // Target the specific status badge element to avoid matching "Available slots" text
    const statusBadge = screen.getByText('Available', { selector: '.staff-status' });
    expect(statusBadge).toBeInTheDocument();
  });

  it('should display empty schedule message when no slots are configured', async () => {
    listStaffSlots.mockResolvedValueOnce({ slots: [] });

    render(
      <MemoryRouter>
        <StaffDashboardPage />
      </MemoryRouter>
    );

    // Verify empty state message and action link
    expect(await screen.findByText(/no slots configured/i)).toBeInTheDocument();
    const createSlotLink = screen.getByRole('link', { name: /create a slot/i });
    expect(createSlotLink).toBeInTheDocument();
    expect(createSlotLink).toHaveAttribute('href', '/staff/slots');
  });

  it('should display error message when fetching slots fails', async () => {
    listStaffSlots.mockRejectedValueOnce(new Error('Failed to load slots database'));

    render(
      <MemoryRouter>
        <StaffDashboardPage />
      </MemoryRouter>
    );

    // Verify alert role and error message content
    const errorAlert = await screen.findByRole('alert');
    expect(errorAlert).toHaveTextContent(/failed to load slots database/i);
  });

});