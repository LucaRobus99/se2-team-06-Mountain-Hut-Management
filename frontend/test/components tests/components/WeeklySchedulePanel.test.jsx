import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeeklySchedulePanel from '../../../src/components/WeeklySchedulePanel.jsx';
import { listStaffSlots, listSlotCatalog, previewWeeklyCopy, copyWeeklySchedule } from '../../../src/api/slots.js';

vi.mock('../../../src/api/slots.js', async importOriginal => ({
  ...(await importOriginal()), listStaffSlots: vi.fn(), listSlotCatalog: vi.fn(),
  previewWeeklyCopy: vi.fn(), copyWeeklySchedule: vi.fn(),
}));
vi.mock('../../../src/components/StaffDatePicker.jsx', () => ({
  default: ({ ariaLabel, value, onChange, disabled }) => <input type="date" aria-label={ariaLabel} value={value} disabled={disabled} onChange={event => onChange(event.target.value)} />,
}));

const source = '2026-11-09';
const target = '2026-11-23';
const slot = { id: 1, meal: 'lunch', startTime: '12:00', endTime: '13:00', tables: [{ tableId: 1, tableIdentifier: 'T1', seats: 2 }] };
const preview = { sourceCount: 1, sourceDays: 1, targetCount: 0, sourceSlotIds: [1], targetSlotIds: [] };

async function selectWeeks(user) {
  render(<WeeklySchedulePanel active />);
  fireEvent.change(screen.getByLabelText('Choose source week'), { target: { value: source } });
  fireEvent.change(screen.getByLabelText('Choose destination week'), { target: { value: target } });
  const button = screen.getByRole('button', { name: /review weekly copy/i });
  await waitFor(() => expect(button).toBeEnabled());
  await user.click(button);
  return screen.findByRole('dialog', { name: /confirm weekly schedule copy/i });
}

describe('Weekly schedule confirmation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listSlotCatalog.mockResolvedValue({ tables: slot.tables });
    listStaffSlots.mockImplementation(async date => ({ slots: date === source ? [slot] : date === target ? [{ ...slot, id: 2 }] : [] }));
    previewWeeklyCopy.mockResolvedValue(preview);
    copyWeeklySchedule.mockResolvedValue({ targetWeekStart: target, copiedCount: 1 });
  });

  it('reviews an empty destination, copies only on confirmation and refreshes the destination', async () => {
    const user = userEvent.setup();
    const dialog = await selectWeeks(user);
    expect(await within(dialog).findByText('Destination week is empty')).toBeInTheDocument();
    expect(listSlotCatalog).not.toHaveBeenCalled();
    expect(copyWeeklySchedule).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Copy weekly schedule' }));
    expect(await screen.findByText(/1 slot copied successfully/)).toBeInTheDocument();
    expect(copyWeeklySchedule).toHaveBeenCalledTimes(1);
    expect(copyWeeklySchedule).toHaveBeenCalledWith({ sourceWeekStart: source, targetWeekStart: target, expectedSourceSlotIds: [1], expectedTargetSlotIds: [] });
    await waitFor(() => expect(listStaffSlots).toHaveBeenCalledWith(target));
    expect(screen.getByLabelText('Choose source week')).toHaveValue(target);
  });

  it('warns about replacement and does not copy when cancelled', async () => {
    const user = userEvent.setup();
    previewWeeklyCopy.mockResolvedValue({ ...preview, targetCount: 2, targetSlotIds: [2, 3] });
    const dialog = await selectWeeks(user);
    expect(await within(dialog).findByText('Existing schedule will be replaced')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Replace and copy' })).toBeEnabled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(copyWeeklySchedule).not.toHaveBeenCalled();
  });

  it('disables confirmation when destination reservations prevent copying', async () => {
    const user = userEvent.setup();
    previewWeeklyCopy.mockRejectedValue(new Error('The destination week contains reservations and cannot be overwritten.'));
    const dialog = await selectWeeks(user);
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/contains reservations/i);
    expect(within(dialog).getByRole('button', { name: 'Copy weekly schedule' })).toBeDisabled();
    expect(copyWeeklySchedule).not.toHaveBeenCalled();
  });
});
