import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import SlotManagementPage from '../../../src/pages/SlotManagementPage.jsx';
import {
  listStaffSlots,
  createStaffSlot,
  listSlotCatalog,
  createCatalogTable,
  deleteCatalogTable,
} from '../../../src/api/slots.js';

vi.mock('../../../src/api/slots.js', () => ({
  listStaffSlots: vi.fn(),
  createStaffSlot: vi.fn(),
  listSlotCatalog: vi.fn(),
  createCatalogTable: vi.fn(),
  deleteCatalogTable: vi.fn(),
  mealLabel: vi.fn((meal) => (meal ? meal[0].toUpperCase() + meal.slice(1) : '')),
  todayInHut: vi.fn(() => '2026-11-15'),
}));

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
    listSlotCatalog.mockResolvedValue({
      tables: [
        { tableId: 1, tableIdentifier: 'T1', seats: 2 },
        { tableId: 2, tableIdentifier: 'T2', seats: 4 },
      ],
      timePatterns: [{ meal: 'dinner', startTime: '19:00', endTime: '21:00' }],
    });
  });

  it('opens only the selected operation and normalizes a selected date to its week', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);

    const daily = screen.getByRole('button', { name: /create a new slot/i });
    const weekly = screen.getByRole('button', { name: /repeat weekly schedule/i });
    expect(daily).toHaveAttribute('aria-expanded', 'false');
    expect(weekly).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: /daily schedule/i })).not.toBeInTheDocument();

    await user.click(weekly);
    await user.click(screen.getByRole('button', { name: /choose source week/i }));
    await user.click(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByRole('button', { name: /choose source week: 9 Nov 2026.*15 Nov 2026/i })).toBeInTheDocument();

    await waitFor(() => expect(listStaffSlots).toHaveBeenCalledTimes(7));
    expect(listStaffSlots).toHaveBeenCalledWith('2026-11-09');
    expect(listStaffSlots).toHaveBeenCalledWith('2026-11-15');

    await user.click(screen.getByRole('button', { name: /choose destination week/i }));
    await user.click(screen.getByRole('button', { name: 'This week' }));
    expect(screen.getByText(/choose a different destination week/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /review weekly copy/i })).toBeDisabled();

    await user.click(daily);
    expect(weekly).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('heading', { name: /daily schedule/i })).toBeInTheDocument();

    await user.click(daily);
    expect(daily).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('heading', { name: /daily schedule/i })).not.toBeInTheDocument();
  });

  it('shows only the selected weekday and table configuration independent of reservations', async () => {
    const user = userEvent.setup();
    listSlotCatalog.mockResolvedValue({
      tables: [
        { tableId: 1, tableIdentifier: 'T1', seats: 4 },
        { tableId: 2, tableIdentifier: 'T2', seats: 4 },
        { tableId: 3, tableIdentifier: 'T3', seats: 4 },
        { tableId: 4, tableIdentifier: 'Terrace 1', seats: 4 },
      ],
      timePatterns: [],
    });
    listStaffSlots.mockImplementation(async (date) => ({
      slots: date === '2026-11-09' ? [{
        id: 91,
        meal: 'breakfast',
        status: 'available',
        startTime: '09:00',
        endTime: '10:00',
        tables: [
          { tableId: 1, tableIdentifier: 'T1', seats: 4, freeSeats: 4 },
          { tableId: 2, tableIdentifier: 'T2', seats: 4, freeSeats: 2 },
          { tableId: 3, tableIdentifier: 'T3', seats: 4, freeSeats: 0 },
        ],
      }] : [],
    }));

    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /repeat weekly schedule/i }));
    await user.click(screen.getByRole('button', { name: /choose source week/i }));
    await user.click(screen.getByRole('button', { name: 'This week' }));

    expect(await screen.findByText('3 tables included')).toBeInTheDocument();
    expect(screen.getByTitle('T1: Included')).toHaveClass('is-included');
    expect(screen.getByTitle('T2: Included')).toHaveClass('is-included');
    expect(screen.getByTitle('T3: Included')).toHaveClass('is-included');
    expect(screen.queryByText('Terrace 1')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Tuesday, 10 Nov, 0 slots/i }));
    expect(screen.getByText('No slots scheduled')).toBeInTheDocument();
    expect(screen.queryByText('3 tables included')).not.toBeInTheDocument();
  });

  it('should render page headings and load daily schedule slots including off status', async () => {
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
        {
          id: 2,
          meal: 'dinner',
          status: 'off',
          startTime: '19:00',
          endTime: '20:00',
          tables: [],
        },
      ],
    });

    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await userEvent.setup().click(screen.getByRole('button', { name: /create a new slot/i }));

    expect(screen.getByRole('heading', { level: 1, name: /slot management/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /daily schedule/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /create a slot/i })).toBeInTheDocument();

    expect(await screen.findByText('12:00')).toBeInTheDocument();
    expect(screen.getByText('T1: 4')).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
    expect(screen.getByText(/No tables assigned/i)).toBeInTheDocument();
  });

 it('should show validation errors when creating a table with empty identifier or a slot in the past', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(await screen.findByRole('button', { name: /define a new table/i }));
    await user.click(screen.getByRole('button', { name: /^create table$/i }));
    expect(await screen.findByText(/enter a table identifier/i)).toBeInTheDocument();
    expect(createCatalogTable).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /close new table form/i }));

    // Simulate today advancing to 2026-11-20 so current form date (2026-11-15) is in the past
    const { todayInHut } = await import('../../../src/api/slots.js');
    vi.mocked(todayInHut).mockReturnValue('2026-11-20');

    await user.click(screen.getByRole('button', { name: /create slot/i }));
    expect(await screen.findByText(/choose today or a future date/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: /confirm slot creation/i })).not.toBeInTheDocument();
  });

  it('should successfully create and toggle a manual slot through confirmation modal flow', async () => {
    const newSlotMock = {
      id: 99,
      date: '2026-11-15',
      meal: 'lunch',
      startTime: '12:00',
      endTime: '13:00',
      tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 2 }],
    };
    createStaffSlot.mockResolvedValueOnce(newSlotMock);

    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    const checkbox = await screen.findByRole('checkbox', { name: /T1 2 seats/i });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    await user.click(screen.getByRole('button', { name: /create slot/i }));
    await user.click(await screen.findByRole('button', { name: /confirm slot/i }));

    await waitFor(() => {
      expect(screen.getByText(/slot created successfully/i)).toBeInTheDocument();
    });

    expect(createStaffSlot).toHaveBeenCalledTimes(1);
    expect(createStaffSlot).toHaveBeenCalledWith(
      expect.objectContaining({ tables: [{ tableIdentifier: 'T1', seats: 2 }] })
    );
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
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(screen.getByRole('radio', { name: /copy tables from another slot/i }));

    const sourceSlotSelect = await screen.findByRole('button', { name: /existing slot/i });
    await user.click(sourceSlotSelect);

    const option = await screen.findByText(/19:00–21:00/i);
    await user.click(option);

    expect(await screen.findByText(/tables to copy/i)).toBeInTheDocument();
    expect(screen.getAllByText('A1: 2').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /create slot/i }));
    await user.click(await screen.findByRole('button', { name: /confirm slot/i }));

    await waitFor(() => {
      expect(createStaffSlot).toHaveBeenCalledWith(
        expect.objectContaining({ copyTablesFromSlotId: 50 })
      );
    });
  });

  it('reuses an existing service time, creates a table, and removes an unused table', async () => {
    const user = userEvent.setup();
    createCatalogTable.mockResolvedValueOnce({ tableId: 9, tableIdentifier: 'Terrace', seats: 6 });
    deleteCatalogTable.mockResolvedValueOnce();

    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(await screen.findByRole('button', { name: /service time/i }));
    await user.click(screen.getByRole('option', { name: /Dinner · 19:00–21:00/i }));

    await user.click(screen.getByRole('button', { name: /define a new table/i }));
    await user.type(screen.getByLabelText('Table identifier'), 'Terrace');
    await user.type(screen.getByLabelText('Fixed seats'), '6');
    await user.click(screen.getByRole('button', { name: /^create table$/i }));
    expect(await screen.findByRole('checkbox', { name: /Terrace 6 seats/i })).toBeChecked();
    expect(createCatalogTable).toHaveBeenCalledWith('Terrace', 6);

    await user.click(screen.getByRole('button', { name: /remove a table/i }));
    await user.click(screen.getByRole('button', { name: /remove Terrace/i }));

    const removeModal = await screen.findByRole('dialog', { name: /remove table\?/i });
    await user.click(within(removeModal).getByRole('button', { name: /remove table/i }));

    await waitFor(() => {
      expect(deleteCatalogTable).toHaveBeenCalledWith(9);
      expect(screen.getByText(/Terrace removed from the table catalog/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /finish removing tables/i }));
  });

  it('should handle API creation errors gracefully', async () => {
    createStaffSlot.mockRejectedValueOnce(new Error('Server error during slot creation'));

    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(await screen.findByRole('checkbox', { name: /T1 2 seats/i }));
    await user.click(screen.getByRole('button', { name: /create slot/i }));
    await user.click(await screen.findByRole('button', { name: /confirm slot/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error during slot creation/i)).toBeInTheDocument();
    });
  });

  it('handles schedule load errors and catalog load errors', async () => {
    listStaffSlots.mockRejectedValueOnce(new Error('Failed to load slots'));
    listSlotCatalog.mockRejectedValueOnce(new Error('Catalog unavailable'));

    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    expect(await screen.findByText('Failed to load slots')).toBeInTheDocument();
    expect(await screen.findByText('Catalog unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create slot/i })).toBeDisabled();
  });

  it('opens and cancels the confirmation modal cleanly', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await screen.findByRole('checkbox', { name: /T1 2 seats/i });
    await user.click(screen.getByRole('button', { name: /create slot/i }));
    expect(await screen.findByRole('dialog', { name: /confirm slot creation/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('validates the new-table form and shows API field error details', async () => {
    const apiFieldErr = new Error('Validation failed');
    apiFieldErr.details = [{ field: 'startTime', message: 'Overlapping slot time' }];
    createStaffSlot.mockRejectedValueOnce(apiFieldErr);

    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(await screen.findByRole('checkbox', { name: /T1 2 seats/i }));

    await user.click(screen.getByRole('button', { name: /define a new table/i }));
    await user.type(screen.getByLabelText('Table identifier'), 'Terrace');
    await user.type(screen.getByLabelText('Fixed seats'), '0');
    await user.click(screen.getByRole('button', { name: /^create table$/i }));
    expect(await screen.findByText(/positive whole number of seats/i)).toBeInTheDocument();
    expect(createCatalogTable).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /close new table form/i }));

    await user.click(screen.getByRole('button', { name: /create slot/i }));
    await user.click(await screen.findByRole('button', { name: /confirm slot/i }));

    expect(await screen.findByText('Overlapping slot time')).toBeInTheDocument();
  });

  it('supports created slot confirmation banner actions and copy source errors', async () => {
    createStaffSlot.mockResolvedValueOnce({
      id: 77,
      date: '2026-11-15',
      meal: 'lunch',
      startTime: '12:00',
      endTime: '13:00',
      tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 2 }],
    });

    const user = userEvent.setup();
    render(<MemoryRouter><SlotManagementPage /></MemoryRouter>);
    await user.click(screen.getByRole('button', { name: /create a new slot/i }));

    await user.click(await screen.findByRole('checkbox', { name: /T1 2 seats/i }));
    await user.click(screen.getByRole('button', { name: /create slot/i }));
    await user.click(await screen.findByRole('button', { name: /confirm slot/i }));

    expect(await screen.findByText(/slot created successfully/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /view in schedule/i }));
    await user.click(screen.getByRole('button', { name: /create another/i }));
    expect(screen.queryByText(/slot created successfully/i)).not.toBeInTheDocument();

    listStaffSlots.mockRejectedValueOnce(new Error('Source slots unavailable'));
    await user.click(screen.getByRole('radio', { name: /copy tables from another slot/i }));
    expect(await screen.findByText('Source slots unavailable')).toBeInTheDocument();
  });
});