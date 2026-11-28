import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WeeklyCopyModal from '../../../src/components/WeeklyCopyModal.jsx';

const baseReview = {
  sourceWeekStart: '2026-11-09',
  targetWeekStart: '2026-11-23',
  preview: {
    sourceCount: 5,
    sourceDays: 3,
    targetCount: 0,
    sourceSlotIds: [1, 2, 3, 4, 5],
    targetSlotIds: [],
  },
};

describe('WeeklyCopyModal Component Tests', () => {
  it('does not render dialog when review is null', () => {
    render(
      <WeeklyCopyModal
        review={null}
        loading={false}
        busy={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows loading state and disables confirm while preview is loading', () => {
    render(
      <WeeklyCopyModal
        review={{ sourceWeekStart: '2026-11-09', targetWeekStart: '2026-11-23', preview: null }}
        loading={true}
        busy={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /confirm weekly schedule copy/i });
    expect(within(dialog).getByRole('status')).toHaveTextContent(/checking the destination week/i);
    expect(within(dialog).getByRole('button', { name: /copy weekly schedule/i })).toBeDisabled();
  });

  it('renders empty destination summary, confirms copy, and supports cancel', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <WeeklyCopyModal
        review={baseReview}
        loading={false}
        busy={false}
        error=""
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /confirm weekly schedule copy/i });
    expect(within(dialog).getByText('9 Nov 2026 – 15 Nov 2026')).toBeInTheDocument();
    expect(within(dialog).getByText('23 Nov 2026 – 29 Nov 2026')).toBeInTheDocument();
    expect(within(dialog).getByText('Destination week is empty')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    await user.click(within(dialog).getByRole('button', { name: 'Copy weekly schedule' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('warns when destination has existing slots and shows "Replace and copy"', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const occupiedReview = {
      ...baseReview,
      preview: { ...baseReview.preview, targetCount: 4 },
    };

    render(
      <WeeklyCopyModal
        review={occupiedReview}
        loading={false}
        busy={false}
        error=""
        onCancel={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /confirm weekly schedule copy/i });
    expect(within(dialog).getByText('Existing schedule will be replaced')).toBeInTheDocument();
    expect(within(dialog).getByText(/all 4 existing destination slots will be removed/i)).toBeInTheDocument();

    const replaceBtn = within(dialog).getByRole('button', { name: 'Replace and copy' });
    expect(replaceBtn).toBeEnabled();
    await user.click(replaceBtn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('displays error alert, switches cancel label to Close, and disables confirm', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    render(
      <WeeklyCopyModal
        review={baseReview}
        loading={false}
        busy={false}
        error="Destination week has existing reservations."
        onCancel={onCancel}
        onConfirm={vi.fn()}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /confirm weekly schedule copy/i });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      'Destination week has existing reservations.'
    );
    expect(within(dialog).queryByText('Destination week is empty')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Copy weekly schedule' })).toBeDisabled();

    const footerCloseBtn = dialog.querySelector('.modal-footer .staff-outline-button');
    expect(footerCloseBtn).toHaveTextContent('Close');
    await user.click(footerCloseBtn);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('disables actions and ignores Escape while busy copying', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();

    render(
      <WeeklyCopyModal
        review={baseReview}
        loading={false}
        busy={true}
        error=""
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    const dialog = screen.getByRole('dialog', { name: /confirm weekly schedule copy/i });
    expect(within(dialog).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: /copying schedule…/i })).toBeDisabled();

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});