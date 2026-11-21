import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AvailabilitySlotCard, { getTableAvailability, photoForSlot } from '../../../src/components/AvailabilitySlotCard.jsx';

describe('AvailabilitySlotCard Component and Utils Tests', () => {
  it.each([
    ['aperitivo', ['charcuterie_board.jpg', 'aperitivo-01-hugo.webp', 'aperitivo-03-beer.webp']],
    ['breakfast', ['cake_coffee_terrace.jpg', 'breakfast_alpine_sunrise.jpg', 'breakfast_cappuccino.jpg']],
    ['lunch', ['lunch-01-polenta.webp', 'lunch-04-salad.webp', 'soup_view.jpg']],
    ['dinner', ['dinner-01-risotto.webp', 'dinner-03-ravioli.webp', 'dinner-06-salmon.webp']],
  ])('uses the fixed first three photos for %s in order', (meal, filenames) => {
    const photos = filenames.map((_, index) => photoForSlot({ meal }, index));
    expect(photos.map(photo => photo.split('/').pop())).toEqual(filenames);
    expect(photos.every(photo => !photo.includes('/meal-gallery/'))).toBe(true);
  });

  it('cycles through the original and new meal-specific photos without repeats', () => {
    const allPhotos = [];
    for (const [meal, count] of Object.entries({ breakfast: 13, lunch: 8, aperitivo: 8, dinner: 8 })) {
      const photos = Array.from({ length: count }, (_, index) => photoForSlot({ meal }, index));
      expect(new Set(photos).size).toBe(count);
      expect(photos.every(photo => !/hero_|fireplace_lounge/.test(photo))).toBe(true);
      expect(photoForSlot({ meal }, count)).toBe(photos[0]);
      allPhotos.push(...photos);
    }
    expect(new Set(allPhotos).size).toBe(37);
  });

  describe('getTableAvailability', () => {
    it('should show availability without a color when the table count is unknown', () => {
      const slot = { tables: null };
      const result = getTableAvailability(slot, 4);
      expect(result).toEqual({ label: 'Available for your group', tone: null });
      expect(getTableAvailability(slot, 4, true)).toEqual({ label: 'Available for this group', tone: null });
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

    it('uses red rather than orange if even the combined seats are insufficient', () => {
      expect(getTableAvailability({ tables: [{ freeSeats: 1 }, { freeSeats: 2 }] }, 4))
        .toEqual({ label: 'No tables available', tone: 'red' });
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

    it('should render green status dot when 3 or more tables are available', () => {
      render(
        <AvailabilitySlotCard
          slot={{
            startTime: '13:30',
            tables: [{ freeSeats: 5 }, { freeSeats: 5 }, { freeSeats: 5 }]
          }}
          index={0}
          partySize={2}
          selected={false}
          disabled={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByText('3 tables available').querySelector('.eh-status-dot--green')).toBeInTheDocument();
    });

    it('should correctly resolve photos for different meals and fallback when meal is unknown', () => {
      const { rerender } = render(
        <AvailabilitySlotCard
          slot={{ startTime: '09:00', meal: 'breakfast', tables: null }}
          index={0}
          partySize={2}
          selected={false}
          disabled={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByRole('button').querySelector('img')).toBeInTheDocument();

      rerender(
        <AvailabilitySlotCard
          slot={{ startTime: '15:00', meal: 'brunch', tables: null }}
          index={0}
          partySize={2}
          selected={false}
          disabled={false}
          onClick={() => {}}
        />
      );
      expect(screen.getByRole('button').querySelector('img')).toBeInTheDocument();
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
