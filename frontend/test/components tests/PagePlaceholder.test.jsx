import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PagePlaceholder from '../../src/components/PagePlaceholder.jsx';

describe('PagePlaceholder Component Tests', () => {
  
  const mockProps = {
    story: 'US-01',
    title: 'Manage Bookings',
    description: 'This page will allow staff to manage and review incoming bookings.',
    nextStep: 'Implement table view and filter controls.'
  };

  it('should render all passed props and placeholder text correctly', () => {
    render(<PagePlaceholder {...mockProps} />);

    // Verify story badge is rendered
    expect(screen.getByText('US-01')).toBeInTheDocument();

    // Verify title heading is rendered correctly
    expect(screen.getByRole('heading', { level: 1, name: 'Manage Bookings' })).toBeInTheDocument();

    // Verify description text is present
    expect(screen.getByText('This page will allow staff to manage and review incoming bookings.')).toBeInTheDocument();

    // Verify "Not implemented yet." label and the custom nextStep message are shown
    expect(screen.getByText(/Not implemented yet\./i)).toBeInTheDocument();
    expect(screen.getByText(/Implement table view and filter controls\./i)).toBeInTheDocument();
  });

});