import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import DietaryRequirementsSummary from '../../../src/components/DietaryRequirementsSummary.jsx';

describe('Shared dietary recap', () => {
  it('shows clear labels for regular requirements and allergies, in the original order', () => {
    render(<DietaryRequirementsSummary requirements={[
      { description: '2 vegetarian guests', allergies: false },
      { description: '1 guest allergic to peanuts', allergies: true },
    ]} />);
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Dietary preference')).toBeInTheDocument();
    expect(within(items[0]).getByText('2 vegetarian guests')).toBeInTheDocument();
    expect(items[0]).not.toHaveClass('is-allergy');
    expect(within(items[1]).getByText('Allergy — special care required')).toBeInTheDocument();
    expect(within(items[1]).getByText('1 guest allergic to peanuts')).toBeInTheDocument();
    expect(items[1]).toHaveClass('is-allergy');
  });

  it('shows a clear empty state rather than a blank list', () => {
    render(<DietaryRequirementsSummary requirements={[]} />);
    expect(screen.getByText('No dietary requirements added.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
