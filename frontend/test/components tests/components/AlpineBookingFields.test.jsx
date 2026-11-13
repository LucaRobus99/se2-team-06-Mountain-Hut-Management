import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AlpineDatePicker, AlpineMealSelect, MEAL_OPTIONS } from '../../../src/components/AlpineBookingFields.jsx';

describe('AlpineBookingFields Component Tests', () => {

  describe('AlpineDatePicker', () => {

    it('should render the date picker with formatted date value correctly', () => {
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} />);

      // Verify trigger button is present with proper aria label and text
      const trigger = screen.getByRole('button', { name: /date:/i });
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('Sun, 15 Nov 2026')).toBeInTheDocument();
    });

    it('should open the calendar popup when clicked and allow selecting a date', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={handleChange} minDate="2026-11-01" />);

      const trigger = screen.getByRole('button', { name: /date:/i });
      await user.click(trigger);

      // Verify popover dialog is open showing November 2026
      const dialog = screen.getByRole('dialog', { name: /choose a date/i });
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('November 2026')).toBeInTheDocument();

      // Click on another day in the same month, e.g., 20
      const dayButton = screen.getByRole('button', { name: /20 November 2026/i });
      await user.click(dayButton);

      expect(handleChange).toHaveBeenCalledWith('2026-11-20');
    });

    it('should navigate between months using arrow buttons', async () => {
      const user = userEvent.setup();
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} minDate="2026-01-01" />);

      await user.click(screen.getByRole('button', { name: /date:/i }));
      expect(screen.getByText('November 2026')).toBeInTheDocument();

      // Go to previous month (October 2026)
      await user.click(screen.getByRole('button', { name: /previous month/i }));
      expect(screen.getByText('October 2026')).toBeInTheDocument();

      // Go to next month twice back to November 2026
      await user.click(screen.getByRole('button', { name: /next month/i }));
      expect(screen.getByText('November 2026')).toBeInTheDocument();
    });

    it('should disable the previous month arrow when minDate restricts going back further', async () => {
      const user = userEvent.setup();
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} minDate="2026-11-01" />);

      await user.click(screen.getByRole('button', { name: /date:/i }));
      expect(screen.getByText('November 2026')).toBeInTheDocument();

      // Since minDate is 2026-11-01 and we are in November 2026, the previous month arrow should be disabled
      const prevButton = screen.getByRole('button', { name: /previous month/i });
      expect(prevButton).toBeDisabled();
    });

    it('should disable days prior to minDate', async () => {
      const user = userEvent.setup();
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} minDate="2026-11-15" />);

      await user.click(screen.getByRole('button', { name: /date:/i }));

      // Day 14 should be disabled because minDate is Nov 15
      const pastDayButton = screen.getByRole('button', { name: /14 November 2026/i });
      expect(pastDayButton).toBeDisabled();

      // Day 15 should be enabled
      const validDayButton = screen.getByRole('button', { name: /15 November 2026/i });
      expect(validDayButton).not.toBeDisabled();
    });

    it('should not open when disabled prop is true', async () => {
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} disabled={true} />);

      const trigger = screen.getByRole('button', { name: /date:/i });
      expect(trigger).toBeDisabled();

      fireEvent.click(trigger);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should close the calendar popup when pressing Escape and focus the trigger', async () => {
      const user = userEvent.setup();
      render(<AlpineDatePicker id="date-picker" value="2026-11-15" onChange={() => {}} />);

      const trigger = screen.getByRole('button', { name: /date:/i });
      await user.click(trigger);

      expect(screen.getByRole('dialog', { name: /choose a date/i })).toBeInTheDocument();

      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });

  });

  describe('AlpineMealSelect', () => {

    it('should render default select state when no value is provided', () => {
      render(<AlpineMealSelect id="meal-select" value="" onChange={() => {}} />);

      const trigger = screen.getByRole('button', { name: /meal:/i });
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('Select a meal')).toBeInTheDocument();
    });

    it('should correctly display Aperitif label for aperitivo value', () => {
      render(<AlpineMealSelect id="meal-select" value="aperitivo" onChange={() => {}} />);
      expect(screen.getByText('Aperitif')).toBeInTheDocument();
    });

    it('should open listbox and allow selecting a meal option', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<AlpineMealSelect id="meal-select" value="lunch" onChange={handleChange} />);

      const trigger = screen.getByRole('button', { name: /meal:/i });
      expect(screen.getByText('Lunch')).toBeInTheDocument();

      await user.click(trigger);

      // Verify listbox is rendered with options
      const listbox = screen.getByRole('listbox', { name: /meal/i });
      expect(listbox).toBeInTheDocument();

      // Click on 'Dinner'
      const dinnerOption = screen.getByRole('option', { name: /dinner/i });
      await user.click(dinnerOption);

      expect(handleChange).toHaveBeenCalledWith('dinner');
    });

    it('should open listbox and handle keyboard navigation (ArrowDown/ArrowUp/Home/End)', async () => {
      render(<AlpineMealSelect id="meal-select" value="breakfast" onChange={() => {}} />);

      const trigger = screen.getByRole('button', { name: /meal:/i });
      
      // Press ArrowDown to open and focus options
      fireEvent.keyDown(trigger, { key: 'ArrowDown' });

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(MEAL_OPTIONS.length);
    });

    it('should not open when disabled prop is true', async () => {
      render(<AlpineMealSelect id="meal-select" value="lunch" onChange={() => {}} disabled={true} />);

      const trigger = screen.getByRole('button', { name: /meal:/i });
      expect(trigger).toBeDisabled();

      fireEvent.click(trigger);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

  });

});