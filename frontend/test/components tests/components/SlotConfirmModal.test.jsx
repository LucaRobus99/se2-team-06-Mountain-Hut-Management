import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SlotConfirmModal from '../../../src/components/SlotConfirmModal.jsx';

describe('SlotConfirmModal Component', () => {
  const mockSummary = {
    date: '15 Nov 2026',
    meal: 'Lunch',
    startTime: '12:00',
    endTime: '13:00',
    seats: 4,
    tables: [{ tableIdentifier: 'T1', seats: 4 }],
    copiedFrom: null,
  };

  it('should not render when show is false', () => {
    render(
      <SlotConfirmModal
        show={false}
        summary={mockSummary}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByText(/confirm new slot/i)).not.toBeInTheDocument();
  });

  it('should render modal content correctly when show is true', () => {
    render(
      <SlotConfirmModal
        show={true}
        summary={mockSummary}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/confirm new slot/i)).toBeInTheDocument();
    expect(screen.getByText('15 Nov 2026')).toBeInTheDocument();
    expect(screen.getByText('Lunch')).toBeInTheDocument();
    expect(screen.getByText('12:00–13:00')).toBeInTheDocument();
    expect(screen.getByText('T1: 4')).toBeInTheDocument();
  });

  it('should render copiedFrom details if provided', () => {
    const summaryWithCopy = {
      ...mockSummary,
      copiedFrom: '14 Nov 2026 · 19:00–21:00 · Dinner',
    };

    render(
      <SlotConfirmModal
        show={true}
        summary={summaryWithCopy}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Tables copied from')).toBeInTheDocument();
    expect(screen.getByText('14 Nov 2026 · 19:00–21:00 · Dinner')).toBeInTheDocument();
  });

  it('should render fallback text when tables list is empty', () => {
    const summaryEmptyTables = {
      ...mockSummary,
      tables: [],
      seats: 0,
    };

    render(
      <SlotConfirmModal
        show={true}
        summary={summaryEmptyTables}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText(/no tables assigned · 0 seats available/i)).toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', async () => {
    const onCancelMock = vi.fn();
    const user = userEvent.setup();

    render(
      <SlotConfirmModal
        show={true}
        summary={mockSummary}
        onCancel={onCancelMock}
        onConfirm={vi.fn()}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it('should call onConfirm when confirm button is clicked', async () => {
    const onConfirmMock = vi.fn();
    const user = userEvent.setup();

    render(
      <SlotConfirmModal
        show={true}
        summary={mockSummary}
        onCancel={vi.fn()}
        onConfirm={onConfirmMock}
      />
    );

    const confirmButton = screen.getByRole('button', { name: /^confirm$/i });
    await user.click(confirmButton);

    expect(onConfirmMock).toHaveBeenCalledTimes(1);
  });

  it('should disable buttons and show loading text when busy is true', () => {
    render(
      <SlotConfirmModal
        show={true}
        summary={mockSummary}
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
        busy={true}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    const confirmButton = screen.getByRole('button', { name: /creating slot…/i });

    expect(cancelButton).toBeDisabled();
    expect(confirmButton).toBeDisabled();
  });
});