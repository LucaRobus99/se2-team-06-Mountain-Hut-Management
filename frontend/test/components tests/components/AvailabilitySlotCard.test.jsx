import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilitySlotCard, { getTableAvailability } from '../../../src/components/AvailabilitySlotCard.jsx';

describe('AvailabilitySlotCard Component and Utils Tests', () => {

  describe('getTableAvailability', () => {
    it('should show availability without a color when the table count is unknown', () => {
      const slot = { tables: null };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: 'Available for your group', tone: null });
    });

    it('should return yellow tone with 1 table when exactly one table fits', () => {
      const slot = { tables: [{ freeSeats: 5 }, { freeSeats: 2 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: '1 table available', tone: 'yellow' });
    });

    it('should return yellow tone when exactly 2 tables fit', () => {
      const slot = { tables: [{ freeSeats: 6 }, { freeSeats: 5 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: '2 tables available', tone: 'yellow' });
    });

    it('should return green tone with 3 or more suitable tables', () => {
      const slot = { tables: [{ freeSeats: 6 }, { freeSeats: 5 }, { freeSeats: 4 }, { freeSeats: 1 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: '3 tables available', tone: 'green' });
    });

    it('should return orange tone for split seating when no single table fits', () => {
      const slot = { tables: [{ freeSeats: 2 }, { freeSeats: 2 }] };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: 'Multiple-table seating available', tone: 'orange' });
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
      expect(screen.getByText('1 table available').querySelector('.eh-status-dot--yellow')).toBeInTheDocument();
    });

    it('should render orange status for split seating', () => {
      render(
        <AvailabilitySlotCard
          slot={{ startTime: '13:00', tables: [{ freeSeats: 2 }, { freeSeats: 2 }] }}
          index={1}
          partySize={4}
          selected={false}
          disabled={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByText('Multiple-table seating available').querySelector('.eh-status-dot--orange')).toBeInTheDocument();
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