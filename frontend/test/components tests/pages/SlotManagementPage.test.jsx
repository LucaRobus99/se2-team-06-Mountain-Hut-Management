import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SlotManagementPage from '../../../src/pages/SlotManagementPage.jsx';
import { listStaffSlots, createStaffSlot } from '../../../src/api/slots.js';

// Mock the slots API functions
vi.mock('../../../src/api/slots.js', () => ({
  listStaffSlots: vi.fn(),
  createStaffSlot: vi.fn(),
  mealLabel: vi.fn((meal) => meal ? meal[0].toUpperCase() + meal.slice(1) : ''),
  todayInHut: vi.fn(() => '2026-11-15'),
}));

describe('SlotManagementPage Component Integration Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Default to safe resolved value to avoid undefined .then() errors on re-renders
    listStaffSlots.mockResolvedValue({ slots: [] });
  });

  it('should render page headings and load daily schedule slots', async () => {
    listStaffSlots.mockResolvedValueOnce({
      slots: [
        { id: 1, meal: 'lunch', status: 'available', startTime: '12:00', endTime: '13:00', tables: [{ tableId: 10, tableIdentifier: 'T1', seats: 4 }] }
      ]
    });

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    // Verify main page titles and form sections
    expect(screen.getByRole('heading', { level: 1, name: /slot management/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /daily schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create a slot/i })).toBeInTheDocument();

    // Verify fetched slot is rendered in the daily schedule grid
    expect(await screen.findByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('T1: 4')).toBeInTheDocument();
  });

  it('should show validation errors when creating a slot with invalid input', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    // Clear table identifier input fields to force validation error
    const tableInputs = await screen.findAllByPlaceholderText(/e.g. t1/i);
    for (const input of tableInputs) {
      await user.clear(input);
    }

    // Click create slot button
    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    // Verify error messages for table identifiers appear
    const errorMessages = await screen.findAllByText(/enter a table identifier/i);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('should successfully create a new manual slot', async () => {
    const newSlotMock = {
      id: 99,
      date: '2026-11-15',
      meal: 'lunch',
      startTime: '12:00',
      endTime: '13:00',
      tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }]
    };
    createStaffSlot.mockResolvedValueOnce(newSlotMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    // Fill in the first table identifier input
    const tableInputs = await screen.findAllByPlaceholderText(/e.g. t1/i);
    await user.clear(tableInputs[0]);
    await user.type(tableInputs[0], 'T1');

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    // Verify success confirmation message appears
    await waitFor(() => {
      expect(screen.getByText(/slot created successfully/i)).toBeInTheDocument();
    });

    expect(createStaffSlot).toHaveBeenCalledTimes(1);
  });

});