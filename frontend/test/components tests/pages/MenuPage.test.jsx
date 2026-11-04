import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import MenuPage from '../../../src/pages/MenuPage.jsx';

describe('MenuPage Component Tests', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page banner headings and introductory text', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    // Verify the presence of the eyebrow, main heading, and subtitle in the banner
    expect(screen.getByText(/food & drinks/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /our menu/i })).toBeInTheDocument();
    expect(screen.getByText(/mountain flavours, served with a view/i)).toBeInTheDocument();
  });

  it('should render the "coming soon" message and availability link', () => {
    render(
      <MemoryRouter>
        <MenuPage />
      </MemoryRouter>
    );

    // Verify the coming soon block and the link to check availability
    expect(screen.getByRole('heading', { level: 2, name: /something good is coming/i })).toBeInTheDocument();
    expect(screen.getByText(/our menu will be available here soon/i)).toBeInTheDocument();

    const availabilityLink = screen.getByRole('link', { name: /check availability/i });
    expect(availabilityLink).toBeInTheDocument();
    expect(availabilityLink).toHaveAttribute('href', '/availability');
  });

});