import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StaffSelect from '../../../src/components/StaffSelect.jsx';

describe('StaffSelect Component Tests', () => {

  const mockOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  it('should render placeholder when no value matches options', () => {
    render(
      <StaffSelect
        id="status-select"
        value=""
        options={mockOptions}
        placeholder="Select status"
        onChange={() => {}}
      />
    );

    const triggerButton = screen.getByRole('button', { name: /select status/i });
    expect(triggerButton).toBeInTheDocument();
    expect(screen.getByText('Select status')).toBeInTheDocument();
  });

  it('should render selected option label when value is provided', () => {
    render(
      <StaffSelect
        id="status-select"
        value="confirmed"
        options={mockOptions}
        onChange={() => {}}
      />
    );

    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toBeInTheDocument();
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('should open options listbox on click and allow choosing an option', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();

    render(
      <StaffSelect
        id="status-select"
        value="all"
        options={mockOptions}
        onChange={handleChange}
      />
    );

    const triggerButton = screen.getByRole('button');
    await user.click(triggerButton);

    // Verify listbox is open
    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Click on 'Cancelled' option
    const cancelledOption = screen.getByRole('option', { name: /cancelled/i });
    await user.click(cancelledOption);

    expect(handleChange).toHaveBeenCalledWith('cancelled');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should handle keyboard navigation (ArrowDown, Enter, Escape)', async () => {
    const handleChange = vi.fn();

    render(
      <StaffSelect
        id="status-select"
        value="all"
        options={mockOptions}
        onChange={handleChange}
      />
    );

    const triggerButton = screen.getByRole('button');

    // Press ArrowDown to open listbox
    fireEvent.keyDown(triggerButton, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    // Press ArrowDown again to move active index to second option ('Confirmed')
    fireEvent.keyDown(triggerButton, { key: 'ArrowDown' });

    // Press Enter to select active option
    fireEvent.keyDown(triggerButton, { key: 'Enter' });
    expect(handleChange).toHaveBeenCalledWith('confirmed');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    // Open again and press Escape to close
    fireEvent.keyDown(triggerButton, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(triggerButton, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('should not open when disabled prop is true', async () => {
    render(
      <StaffSelect
        id="status-select"
        value="all"
        options={mockOptions}
        disabled={true}
        onChange={() => {}}
      />
    );

    const triggerButton = screen.getByRole('button');
    expect(triggerButton).toBeDisabled();

    fireEvent.click(triggerButton);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

});