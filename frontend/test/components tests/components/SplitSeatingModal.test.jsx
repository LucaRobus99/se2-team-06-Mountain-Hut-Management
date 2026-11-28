import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SplitSeatingModal from '../../../src/components/SplitSeatingModal.jsx';

describe('SplitSeatingModal Component Tests', () => {

  const defaultProps = {
    show: true,
    seating: {
      seatAssignments: [
        { seats: 3 },
        { seats: 2 }
      ]
    },
    onCancel: vi.fn(),
    onContinue: vi.fn(),
    busy: false
  };

  it('should render modal title, message, and split seating arrangement correctly', () => {
    render(<SplitSeatingModal {...defaultProps} />);

    // Verify dialog and title are rendered
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Seating Details')).toBeInTheDocument();

    // Verify explanatory message
    expect(screen.getByText(/You'll be seated across multiple tables/i)).toBeInTheDocument();

    // Verify dynamic table split arrangement text
    expect(screen.getByText('Table split: 3 guests + 2 guests')).toBeInTheDocument();
  });

  it('should handle singular guest text correctly in seat assignments', () => {
    const customSeating = {
      seatAssignments: [
        { seats: 1 },
        { seats: 2 }
      ]
    };

    render(<SplitSeatingModal {...defaultProps} seating={customSeating} />);

    expect(screen.getByText('Table split: 1 guest + 2 guests')).toBeInTheDocument();
  });

  it('addresses the employee and reminds them to inform the guest', async () => {
    const onContinue = vi.fn();
    const user = userEvent.setup();
    render(<SplitSeatingModal {...defaultProps} staff onContinue={onContinue} />);
    expect(screen.queryByText('Your reservation')).not.toBeInTheDocument();
    expect(screen.getByText('Staff-assisted booking')).toBeInTheDocument();
    expect(screen.getByText(/The guests will be seated across multiple tables/)).toBeInTheDocument();
    expect(screen.getByText(/Inform the guest about the table split/)).toBeInTheDocument();
    expect(screen.getByText('Table split: 3 guests + 2 guests')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /continue with split seating/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('should not render split arrangement text if seatAssignments has 1 or fewer items', () => {
    const singleSeating = {
      seatAssignments: [{ seats: 4 }]
    };

    render(<SplitSeatingModal {...defaultProps} seating={singleSeating} />);

    expect(screen.queryByText(/Table split:/i)).not.toBeInTheDocument();
  });

  it('should trigger onCancel when clicking "Choose another time" button', async () => {
    const handleCancel = vi.fn();
    const user = userEvent.setup();

    render(<SplitSeatingModal {...defaultProps} onCancel={handleCancel} />);

    const cancelButton = screen.getByRole('button', { name: /choose another time/i });
    await user.click(cancelButton);

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('should trigger onContinue when clicking "Continue with split seating" button', async () => {
    const handleContinue = vi.fn();
    const user = userEvent.setup();

    render(<SplitSeatingModal {...defaultProps} onContinue={handleContinue} />);

    const continueButton = screen.getByRole('button', { name: /continue with split seating/i });
    await user.click(continueButton);

    expect(handleContinue).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons when busy prop is true', () => {
    render(<SplitSeatingModal {...defaultProps} busy={true} />);

    expect(screen.getByRole('button', { name: /choose another time/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /continue with split seating/i })).toBeDisabled();
  });

  it('should trigger onCancel when pressing Escape if not busy', async () => {
    const handleCancel = vi.fn();
    const user = userEvent.setup();

    render(<SplitSeatingModal {...defaultProps} busy={false} onCancel={handleCancel} />);

    await user.keyboard('{Escape}');

    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it('should not trigger onCancel when pressing Escape if busy', async () => {
    const handleCancel = vi.fn();
    const user = userEvent.setup();

    render(<SplitSeatingModal {...defaultProps} busy={true} onCancel={handleCancel} />);

    await user.keyboard('{Escape}');

    expect(handleCancel).not.toHaveBeenCalled();
  });
  
});
