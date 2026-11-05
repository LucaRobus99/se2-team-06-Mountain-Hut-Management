import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilitySlotCard, { getTableAvailability } from '../../../src/components/AvailabilitySlotCard.jsx';

describe('AvailabilitySlotCard Component and Utils Tests', () => {

  describe('getTableAvailability', () => {
    it('should return default green availability when tables is not an array', () => {
      const slot = { tables: null };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: 'Available for your group', tone: 'green' });
    });

    it('should return red tone with 1 table when exactly one table fits', () => {
      const slot = { tables: [{ freeSeats: 5 }, { freeSeats: 2 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: '1 table available', tone: 'red' });
    });

    it('should return green tone with multiple tables when more than one table fits', () => {
      const slot = { tables: [{ freeSeats: 6 }, { freeSeats: 5 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: '2 tables available', tone: 'green' });
    });

    it('should return amber tone for multiple-table seating when no single table fits', () => {
      const slot = { tables: [{ freeSeats: 2 }, { freeSeats: 2 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: 'Multiple-table seating available', tone: 'amber' });
    });
  });

  describe('AvailabilitySlotCard Component', () => {
    const mockSlot = {
      startTime: '12:30',
      tables: [{ freeSeats: 6 }]
    };

    it('should render slot start time and availability correctly', () => {
      render(
        <AvailabilitySlotCard
          slot={mockSlot}
          index={0}
          partySize={2}
          selected={false}
          disabled={false}
          onClick={() => {}}
        />
      );

      expect(screen.getByText('12:30')).toBeInTheDocument();
      expect(screen.getByText('1 table available')).toBeInTheDocument();
    });

    it('should apply selected class and aria-pressed when selected is true', () => {
      render(
        <AvailabilitySlotCard
          slot={mockSlot}
          index={0}
          partySize={2}
          selected={true}
          disabled={false}
          onClick={() => {}}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('eh-slot-tile--selected');
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('should be disabled when disabled prop is true', () => {
      render(
        <AvailabilitySlotCard
          slot={mockSlot}
          index={0}
          partySize={2}
          selected={false}
          disabled={true}
          onClick={() => {}}
        />
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('should trigger onClick handler when clicked', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <AvailabilitySlotCard
          slot={mockSlot}
          index={0}
          partySize={2}
          selected={false}
          disabled={false}
          onClick={handleClick}
        />
      );

      await user.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

});