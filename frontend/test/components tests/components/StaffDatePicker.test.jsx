import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the API dependency used inside StaffDatePicker
vi.mock('../../../src/api/slots.js', () => ({
  todayInHut: vi.fn(() => '2026-11-15'),
}));

import StaffDatePicker from '../../../src/components/StaffDatePicker.jsx';

describe('StaffDatePicker Component Tests', () => {

  it('should render trigger button with formatted date value correctly', () => {
    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        ariaLabel="Filter date"
      />
    );

    const triggerButton = screen.getByRole('button', { name: /filter date: 15\/11\/2026/i });
    expect(triggerButton).toBeInTheDocument();
  });

  it('should open the calendar dialog when clicked and show month title', async () => {
    const user = userEvent.setup();
    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /choose a date/i });
    await user.click(triggerButton);

    // Verify dialog popover is visible showing November 2026
    const dialog = screen.getByRole('dialog', { name: /select a date/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('November 2026')).toBeInTheDocument();
  });

  it('should allow navigating months using previous and next arrow buttons', async () => {
    const user = userEvent.setup();
    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));
    expect(screen.getByText('November 2026')).toBeInTheDocument();

    // Go to previous month (October 2026)
    await user.click(screen.getByRole('button', { name: /previous month/i }));
    expect(screen.getByText('October 2026')).toBeInTheDocument();

    // Go to next month (back to November 2026)
    await user.click(screen.getByRole('button', { name: /next month/i }));
    expect(screen.getByText('November 2026')).toBeInTheDocument();
  });

  it('should trigger onChange with selected date and close calendar when clicking a day', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={handleChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));

    // Click on a day button, e.g. 20 Nov 2026
    const dayButton = screen.getByRole('button', { name: /20 Nov 2026/i });
    await user.click(dayButton);

    expect(handleChange).toHaveBeenCalledWith('2026-11-20');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should trigger onChange with today date when clicking the "Today" footer button', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-10"
        onChange={handleChange}
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));

    const todayButton = screen.getByRole('button', { name: /^today$/i });
    await user.click(todayButton);

    // Mocked todayInHut returns '2026-11-15'
    expect(handleChange).toHaveBeenCalledWith('2026-11-15');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should disable days prior to the min date restriction', async () => {
    const user = userEvent.setup();
    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        min="2026-11-15"
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));

    // Day 14 should be disabled because min is Nov 15 (format: 14 Nov 2026)
    const pastDayButton = screen.getByRole('button', { name: /14 Nov 2026/i });
    expect(pastDayButton).toBeDisabled();

    // Day 15 should be enabled
    const validDayButton = screen.getByRole('button', { name: /15 Nov 2026/i });
    expect(validDayButton).not.toBeDisabled();
  });

  it('should not open when disabled prop is true', async () => {
    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        disabled={true}
      />
    );

    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toBeDisabled();

    await userEvent.click(triggerButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

});