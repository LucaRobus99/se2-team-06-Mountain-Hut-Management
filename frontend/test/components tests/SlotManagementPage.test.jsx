import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlotManagementPage from '../../src/pages/SlotManagementPage.jsx';
import { createStaffSlot, listStaffSlots, listSlotCatalog } from '../../src/api/slots.js';

vi.mock('../../src/api/slots.js', async (importOriginal) => ({
  ...(await importOriginal()),
  createStaffSlot: vi.fn(),
  listStaffSlots: vi.fn(),
  listSlotCatalog: vi.fn(),
}));

const createdSlot = {
  id: 1, date: '2026-11-15', meal: 'lunch', startTime: '12:00', endTime: '13:00',
  status: 'available', tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 4 }, { tableId: 2, tableIdentifier: 'T2', seats: 4 }],
};

async function openConfirmation(user) {
  render(<SlotManagementPage />);
  await screen.findByText('No slots for this date');
  for (const checkbox of await screen.findAllByRole('checkbox')) await user.click(checkbox);
  await user.click(screen.getByRole('button', { name: /create slot/i }));
  return screen.findByRole('dialog');
}

describe('SlotManagementPage confirmation popup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    listStaffSlots.mockResolvedValue({ slots: [] });
    listSlotCatalog.mockResolvedValue({ tables: createdSlot.tables, timePatterns: [] });
  });

  it('shows a summary of the slot without calling the API', async () => {
    const dialog = await openConfirmation(userEvent.setup());

    expect(within(dialog).getByText('Lunch')).toBeInTheDocument();
    expect(within(dialog).getByText('12:00–13:00')).toBeInTheDocument();
    expect(within(dialog).getByText('2 tables · 8 seats')).toBeInTheDocument();
    expect(within(dialog).getByText('T1: 4')).toBeInTheDocument();
    expect(within(dialog).getByText('T2: 4')).toBeInTheDocument();
    expect(createStaffSlot).not.toHaveBeenCalled();
  });

  it('does not silently select any tables', async () => {
    const user = userEvent.setup();
    render(<SlotManagementPage />);
    await screen.findByText('No slots for this date');

    for (const checkbox of await screen.findAllByRole('checkbox')) expect(checkbox).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /create slot/i }));

    expect(within(await screen.findByRole('dialog')).getByText('0 tables · 0 seats')).toBeInTheDocument();
    expect(createStaffSlot).not.toHaveBeenCalled();
  });

  it('never calls the API when cancelled', async () => {
    const user = userEvent.setup();
    const dialog = await openConfirmation(user);

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(createStaffSlot).not.toHaveBeenCalled();
  });

  it('creates the slot only once confirmed', async () => {
    const user = userEvent.setup();
    createStaffSlot.mockResolvedValue(createdSlot);
    const dialog = await openConfirmation(user);

    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(createStaffSlot).toHaveBeenCalledTimes(1));
    expect(createStaffSlot).toHaveBeenCalledWith(expect.objectContaining({
      startTime: '12:00', endTime: '13:00', meal: 'lunch',
      tables: [{ tableIdentifier: 'T1', seats: 4 }, { tableIdentifier: 'T2', seats: 4 }],
    }));
    expect(await screen.findByText('Slot created successfully')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes the popup and shows the error when creation fails', async () => {
    const user = userEvent.setup();
    createStaffSlot.mockRejectedValue(new Error('The slot overlaps an existing one.'));
    const dialog = await openConfirmation(user);

    await user.click(within(dialog).getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('The slot overlaps an existing one.')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
