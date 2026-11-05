import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SlotManagementPage from '../../../src/pages/SlotManagementPage.jsx';
import { listStaffSlots, createStaffSlot } from '../../../src/api/slots.js';

// Mock the slots API functions and utilities
vi.mock('../../../src/api/slots.js', () => ({
  listStaffSlots: vi.fn(),
  createStaffSlot: vi.fn(),
  mealLabel: vi.fn((meal) => (meal ? meal[0].toUpperCase() + meal.slice(1) : '')),
  todayInHut: vi.fn(() => '2026-11-15'),
}));

// Mock SlotConfirmModal to cleanly isolate page integration testing
vi.mock('../../../src/components/SlotConfirmModal.jsx', () => ({
  default: ({ show, onConfirm, onCancel }) =>
    show ? (
      <div role="dialog" aria-label="Confirm slot creation">
        <button type="button" onClick={onConfirm}>Confirm Slot</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

describe('SlotManagementPage Component Integration Tests', () => {

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    listStaffSlots.mockResolvedValue({ slots: [] });
  });

  it('should render page headings and load daily schedule slots', async () => {
    listStaffSlots.mockResolvedValueOnce({
      slots: [
        {
          id: 1,
          meal: 'lunch',
          status: 'available',
          startTime: '12:00',
          endTime: '13:00',
          tables: [{ tableId: 10, tableIdentifier: 'T1', seats: 4 }],
        },
      ],
    });

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { level: 1, name: /slot management/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /daily schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create a slot/i })).toBeInTheDocument();

    expect(await screen.findByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('T1: 4')).toBeInTheDocument();
  });

  it('should show validation errors when creating a slot with empty table identifiers', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    const tableInputs = await screen.findAllByPlaceholderText(/e.g. t1/i);
    for (const input of tableInputs) {
      await user.clear(input);
    }

    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    const errorMessages = await screen.findAllByText(/enter a table identifier/i);
    expect(errorMessages.length).toBeGreaterThan(0);
  });

  it('should successfully create a new manual slot through confirmation modal flow', async () => {
    const newSlotMock = {
      id: 99,
      date: '2026-11-15',
      meal: 'lunch',
      startTime: '12:00',
      endTime: '13:00',
      tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }],
    };
    createStaffSlot.mockResolvedValueOnce(newSlotMock);

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    const tableInputs = await screen.findAllByPlaceholderText(/e.g. t1/i);
    await user.clear(tableInputs[0]);
    await user.type(tableInputs[0], 'T1');

    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    const confirmModalButton = await screen.findByRole('button', { name: /confirm slot/i });
    await user.click(confirmModalButton);

    await waitFor(() => {
      expect(screen.getByText(/slot created successfully/i)).toBeInTheDocument();
    });

    expect(createStaffSlot).toHaveBeenCalledTimes(1);
  });

  it('should support copy tables mode from an existing slot', async () => {
    const sourceSlotsMock = {
      slots: [
        {
          id: 50,
          meal: 'dinner',
          startTime: '19:00',
          endTime: '21:00',
          tables: [{ tableId: 5, tableIdentifier: 'A1', seats: 2 }],
        },
      ],
    };
    listStaffSlots.mockResolvedValue(sourceSlotsMock);
    createStaffSlot.mockResolvedValueOnce({
      id: 100,
      date: '2026-11-15',
      meal: 'lunch',
      startTime: '12:00',
      endTime: '13:00',
      tables: [{ tableId: 5, tableIdentifier: 'A1', seats: 2 }],
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    const copyRadio = screen.getByRole('radio', { name: /copy tables from another slot/i });
    await user.click(copyRadio);

    const sourceSlotSelect = await screen.findByRole('button', { name: /existing slot/i });
    await user.click(sourceSlotSelect);

    const option = await screen.findByText(/19:00–21:00/i);
    await user.click(option);

    // Usa getAllByText e prendi l'ultimo (o verifica che esista nella preview)
    expect(await screen.findByText(/tables to copy/i)).toBeInTheDocument();
    const tableElements = screen.getAllByText('A1: 2');
    expect(tableElements.length).toBeGreaterThan(0);

    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: /confirm slot/i });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(createStaffSlot).toHaveBeenCalledWith(
        expect.objectContaining({
          copyTablesFromSlotId: 50,
        })
      );
    });
  });

  it('should handle API creation errors gracefully', async () => {
    createStaffSlot.mockRejectedValueOnce(new Error('Server error during slot creation'));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <SlotManagementPage />
      </MemoryRouter>
    );

    const tableInputs = await screen.findAllByPlaceholderText(/e.g. t1/i);
    await user.clear(tableInputs[0]);
    await user.type(tableInputs[0], 'T1');

    const submitButton = screen.getByRole('button', { name: /create slot/i });
    await user.click(submitButton);

    const confirmButton = await screen.findByRole('button', { name: /confirm slot/i });
    await user.click(confirmButton);

    // Avvolgiamo in un waitFor per dare tempo alla promise rifiutata di aggiornare lo stato di errore
    await waitFor(() => {
      const errorMessage = screen.getByText(/server error during slot creation/i);
      expect(errorMessage).toBeInTheDocument();
    });
  });

});