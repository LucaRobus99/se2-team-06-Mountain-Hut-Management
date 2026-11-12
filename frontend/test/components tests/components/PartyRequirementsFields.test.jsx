import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import PartyRequirementsFields from '../../../src/components/PartyRequirementsFields.jsx';

function Example() {
  const [requirements, setRequirements] = useState([]);
  return <PartyRequirementsFields requirements={requirements} onChange={setRequirements} showErrors />;
}

describe('PartyRequirementsFields', () => {
  it('is optional and starts with no entries', () => {
    render(<Example />);
    expect(screen.getByText(/no dietary requirements added/i)).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('adds independent entries, checks allergies per entry, and removes entries', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(2);
    await user.type(screen.getAllByRole('textbox')[0], '1 guest with a peanut allergy');
    await user.type(screen.getAllByRole('textbox')[1], '2 vegetarian guests');
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getAllByRole('checkbox')[0]).toBeChecked();
    expect(screen.getAllByRole('checkbox')[1]).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /remove requirement 1/i }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('textbox')).toHaveValue('2 vegetarian guests');
  });

  it('shows an accessible validation message on a blank added entry', async () => {
    const user = userEvent.setup();
    render(<Example />);
    await user.click(screen.getByRole('button', { name: /add dietary requirement/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/enter a description/i);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables all inputs and buttons when disabled prop is true', () => {
    const initialRequirements = [{ id: 1, description: 'Test requirement', allergies: true }];
    render(
      <PartyRequirementsFields 
        requirements={initialRequirements} 
        onChange={() => {}} 
        disabled={true} 
      />
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    expect(screen.getByRole('button', { name: /remove requirement 1/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /add dietary requirement/i })).toBeDisabled();
  });

  it('does not show validation errors when showErrors is false', () => {
    const initialRequirements = [{ id: 1, description: '', allergies: false }];
    render(
      <PartyRequirementsFields 
        requirements={initialRequirements} 
        onChange={() => {}} 
        showErrors={false} 
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'false');
  });
});