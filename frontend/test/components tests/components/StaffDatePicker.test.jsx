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

  it('should show placeholder when value is empty and close on Escape or outside pointerdown', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <span data-testid="outside">Outside element</span>
        <StaffDatePicker id="date-picker" value="" onChange={() => {}} />
      </div>
    );

    const triggerButton = screen.getByRole('button', { name: /choose a date: choose a date/i });
    await user.click(triggerButton);
    expect(screen.getByRole('dialog', { name: /select a date/i })).toBeInTheDocument();

    // Close with Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen and close with outside pointerdown
    await user.click(triggerButton);
    expect(screen.getByRole('dialog', { name: /select a date/i })).toBeInTheDocument();

    await user.pointer({ target: screen.getByTestId('outside'), keys: '[MouseLeft]' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should apply above placement when preferredPlacement is "above" or space below is tight', async () => {
    const user = userEvent.setup();

    const { rerender } = render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        preferredPlacement="above"
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));
    expect(screen.getByRole('dialog')).toHaveClass('staff-calendar--above');

    // Close first
    await user.keyboard('{Escape}');

    // Simulate tight space below trigger and plenty of space above
    Object.defineProperty(window, 'innerHeight', { value: 200, configurable: true });
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 180,
      bottom: 195,
      left: 0,
      right: 100,
      width: 100,
      height: 15,
      x: 0,
      y: 180,
      toJSON: () => {},
    });

    rerender(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        preferredPlacement="auto"
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));
    expect(screen.getByRole('dialog')).toHaveClass('staff-calendar--above');

    vi.restoreAllMocks();
  });

  it('should disable the Today button when today is before min and mark outside-month days', async () => {
    const user = userEvent.setup();

    render(
      <StaffDatePicker
        id="date-picker"
        value="2026-11-15"
        onChange={() => {}}
        min="2026-11-20"
      />
    );

    await user.click(screen.getByRole('button', { name: /choose a date/i }));

    // todayInHut is mocked as '2026-11-15', which is < '2026-11-20'
    expect(screen.getByRole('button', { name: /^today$/i })).toBeDisabled();

    // November 1, 2026 is a Sunday, so Oct 26–31 2026 are outside November
    const outsideDay = screen.getByRole('button', { name: /31 Oct 2026/i });
    expect(outsideDay).toHaveClass('outside');
  });
  
});