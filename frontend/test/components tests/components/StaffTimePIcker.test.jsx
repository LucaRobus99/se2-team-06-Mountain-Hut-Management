import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffTimePicker from '../../../src/components/StaffTimePicker.jsx';

// Mock scrollIntoView for jsdom environment compatibility
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

describe('StaffTimePicker Component Tests', () => {

  it('should render trigger button with formatted time value correctly', () => {
    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={() => {}}
        label="Select time"
      />
    );

    const triggerButton = screen.getByRole('button', { name: /select time/i });
    expect(triggerButton).toBeInTheDocument();
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('should open the time picker dialog when clicked and show columns', async () => {
    const user = userEvent.setup();
    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={() => {}}
        label="Select time"
      />
    );

    const triggerButton = screen.getByRole('button', { name: /select time/i });
    await user.click(triggerButton);

    // Verify dialog popover is visible
    const dialog = screen.getByRole('dialog', { name: /select time picker/i });
    expect(dialog).toBeInTheDocument();

    // Verify hours and minutes listboxes are present
    expect(screen.getByRole('listbox', { name: /hours/i })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /minutes/i })).toBeInTheDocument();
  });

  it('should trigger onChange with updated hour when clicking an hour option', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={handleChange}
        label="Select time"
      />
    );

    await user.click(screen.getByRole('button', { name: /select time/i }));

    // Scope search within the Hours listbox to avoid duplicate matches
    const hoursListbox = screen.getByRole('listbox', { name: /hours/i });
    const hourOption = within(hoursListbox).getByRole('option', { name: /^16$/ });
    await user.click(hourOption);

    expect(handleChange).toHaveBeenCalledWith('16:30');
  });

  it('should trigger onChange with updated minute when clicking a minute option', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={handleChange}
        label="Select time"
      />
    );

    await user.click(screen.getByRole('button', { name: /select time/i }));

    // Scope search within the Minutes listbox to avoid duplicate matches
    const minutesListbox = screen.getByRole('listbox', { name: /minutes/i });
    const minuteOption = within(minutesListbox).getByRole('option', { name: /^45$/ });
    await user.click(minuteOption);

    expect(handleChange).toHaveBeenCalledWith('14:45');
  });

  it('should close the picker when clicking the "Done" button', async () => {
    const user = userEvent.setup();
    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={() => {}}
        label="Select time"
      />
    );

    await user.click(screen.getByRole('button', { name: /select time/i }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // Click 'Done'
    const doneButton = screen.getByRole('button', { name: /done/i });
    await user.click(doneButton);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should not open when disabled prop is true', async () => {
    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={() => {}}
        label="Select time"
        disabled={true}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /select time/i });
    expect(triggerButton).toBeDisabled();

    fireEvent.click(triggerButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should default to 12:00 when value is empty or invalid', () => {
    render(
      <StaffTimePicker
        id="time-picker"
        value=""
        onChange={() => {}}
        label="Select time"
      />
    );

    expect(screen.getByText('12:00')).toBeInTheDocument();
  });

  it('should close on Escape or outside pointerdown when open', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <span data-testid="outside">Outside</span>
        <StaffTimePicker
          id="time-picker"
          value="14:30"
          onChange={() => {}}
          label="Select time"
        />
      </div>
    );

    const triggerButton = screen.getByRole('button', { name: /select time/i });
    await user.click(triggerButton);
    expect(screen.getByRole('dialog', { name: /select time picker/i })).toBeInTheDocument();

    // Close via Escape
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    // Reopen and close via outside pointerdown
    await user.click(triggerButton);
    expect(screen.getByRole('dialog', { name: /select time picker/i })).toBeInTheDocument();

    await user.pointer({ target: screen.getByTestId('outside'), keys: '[MouseLeft]' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should open above when space below is smaller than desired height and smaller than space above', async () => {
    const user = userEvent.setup();

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

    render(
      <StaffTimePicker
        id="time-picker"
        value="14:30"
        onChange={() => {}}
        label="Select time"
      />
    );

    await user.click(screen.getByRole('button', { name: /select time/i }));
    expect(screen.getByRole('dialog', { name: /select time picker/i })).toHaveClass(
      'staff-time-panel--above'
    );

    vi.restoreAllMocks();
  });
  
});