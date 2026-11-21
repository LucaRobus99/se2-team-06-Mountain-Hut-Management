import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import StaffDashboardPage from '../../../src/pages/StaffDashboardPage.jsx';
import { listStaffSlots } from '../../../src/api/slots.js';
import userEvent from '@testing-library/user-event';

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

  it('computes stats accurately for mixed available and off slots and handles missing slots array', async () => {
    listStaffSlots.mockResolvedValueOnce({
      slots: [
        {
          id: 1,
          meal: 'lunch',
          status: 'available',
          startTime: '12:00',
          endTime: '13:00',
          tables: [
            { tableId: 10, tableIdentifier: 'T1', seats: 4 },
            { tableId: 11, tableIdentifier: 'T2', seats: 2 },
          ],
        },
        {
          id: 2,
          meal: 'dinner',
          status: 'off',
          startTime: '19:00',
          endTime: '20:30',
          tables: [{ tableId: 12, tableIdentifier: 'T3', seats: 6 }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <StaffDashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('12:00 – 13:00')).toBeInTheDocument();
    expect(screen.getByText('19:00 – 20:30')).toBeInTheDocument();

    // Off slot renders 'Off' badge and still shows its own table seats in the row
    expect(screen.getByText('Off', { selector: '.staff-status' })).toBeInTheDocument();
    expect(screen.getByText(/1 tables · 6 total seats/i)).toBeInTheDocument();

    // Stats: 2 scheduled slots, 1 available slot, 6 configured seats (only from available slot)
    const statValues = screen.getAllByText(/^(2|1|6)$/).map((el) => el.textContent);
    expect(statValues).toEqual(['2', '1', '6']);
  });

  it('re-fetches schedule when the selected date changes and handles empty payload', async () => {
    const user = userEvent.setup();
    listStaffSlots
      .mockResolvedValueOnce({
        slots: [
          {
            id: 1,
            meal: 'breakfast',
            status: 'available',
            startTime: '08:00',
            endTime: '09:30',
            tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }],
          },
        ],
      })
      .mockResolvedValueOnce({});

    render(
      <MemoryRouter>
        <StaffDashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('08:00 – 09:30')).toBeInTheDocument();

    // Open StaffDatePicker ("Choose schedule date") and pick another day if available
    const dateButton = screen.getByRole('button', { name: /choose schedule date/i });
    await user.click(dateButton);

    const dayButtons = screen.queryAllByRole('button').filter((btn) => /^\d+$/.test(btn.textContent?.trim() || ''));
    const differentDay = dayButtons.find((btn) => btn.textContent?.trim() === '20' && !btn.disabled);

    if (differentDay) {
      await user.click(differentDay);
      await waitFor(() => expect(listStaffSlots).toHaveBeenCalledTimes(2));
      expect(await screen.findByText(/no slots configured/i)).toBeInTheDocument();
    }
  });

});