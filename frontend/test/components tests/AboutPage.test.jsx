import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import AboutPage from '../../src/pages/AboutPage.jsx';

describe('AboutPage Component Integration Tests', () => {

  it('should render main section headings and lead description', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify kicker and main heading
    expect(screen.getByText('About Edelweiss Hut')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'A simple alpine stop in the Dolomites.' })).toBeInTheDocument();

    // Verify lead paragraph text
    expect(screen.getByText(/Edelweiss Hut is an imagined mountain restaurant/i)).toBeInTheDocument();
  });

  it('should render all informational cards (story, seasonal access, plan your stop)', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify card headings
    expect(screen.getByRole('heading', { level: 2, name: 'Our story' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Seasonal access' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Plan your stop' })).toBeInTheDocument();

    // Verify card content descriptions
    expect(screen.getByText(/The hut concept combines local food/i)).toBeInTheDocument();
    expect(screen.getByText(/The area is imagined as reachable through lifts/i)).toBeInTheDocument();
    expect(screen.getByText(/Check the current availability online/i)).toBeInTheDocument();
  });

  it('should render navigation action buttons with correct links', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify "Check availability" button points to /availability
    const availabilityButton = screen.getByRole('button', { name: /check availability/i });
    expect(availabilityButton).toBeInTheDocument();
    expect(availabilityButton).toHaveAttribute('href', '/availability');

    // Verify "Explore the menu" button points to /menu
    const menuButton = screen.getByRole('button', { name: /explore the menu/i });
    expect(menuButton).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('href', '/menu');
  });
});