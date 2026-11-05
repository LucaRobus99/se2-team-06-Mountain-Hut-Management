import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

// Mock the image asset to prevent file resolution errors during testing
vi.mock('../../src/assets/edelweiss-route-illustration.png', () => ({ default: 'route-illustration.png' }));

import AboutPage from '../../../src/pages/AboutPage.jsx';

describe('AboutPage Component Integration Tests', () => {

  beforeAll(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render main section heading and lead description', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify main heading
    expect(screen.getByRole('heading', { level: 1, name: 'Find us' })).toBeInTheDocument();

    // Verify lead description text
    expect(screen.getByText(/In the heart of the Dolomites, just a short walk from the top of Seceda/i)).toBeInTheDocument();
  });

  it('should render all informational cards (Our location, How to reach us, Before your visit)', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify card headings
    expect(screen.getByRole('heading', { level: 2, name: 'Our location' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'How to reach us' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Before your visit' })).toBeInTheDocument();

    // Verify specific content restricting search to paragraph nodes
    expect(screen.getByText(/Streda Mastlè 64/i)).toBeInTheDocument();
    expect(screen.getByText((content, node) => node?.tagName === 'P' && node.textContent?.includes('Start in Ortisei') && node.textContent?.includes('Seceda valley station'))).toBeInTheDocument();
    expect(screen.getByText(/The mountain lifts operate seasonally/i)).toBeInTheDocument();
  });

  it('should render all journey step sections (By car, By cable car, On foot)', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify journey step headings
    expect(screen.getByRole('heading', { level: 3, name: 'By car' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'By cable car' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'On foot' })).toBeInTheDocument();

    // Scope the search within the "Ways to reach the hut" container to avoid duplicate matches
    const journeyContainer = screen.getByLabelText('Ways to reach the hut');
    
    expect(within(journeyContainer).getByText((content, node) => node?.tagName === 'P' && node.textContent?.includes('Park at') && node.textContent?.includes('Parkgarage Seceda'))).toBeInTheDocument();
    expect(within(journeyContainer).getByText((content, node) => node?.tagName === 'P' && node.textContent?.includes('gondola to Furnes'))).toBeInTheDocument();
    expect(within(journeyContainer).getByText((content, node) => node?.tagName === 'P' && node.textContent?.includes('demanding ascent'))).toBeInTheDocument();
  });

  it('should render external navigation links with correct attributes and hrefs', () => {
    render(
      <MemoryRouter>
        <AboutPage />
      </MemoryRouter>
    );

    // Verify Google Maps location link
    const mapLink = screen.getByRole('link', { name: /open in google maps/i });
    expect(mapLink).toBeInTheDocument();
    expect(mapLink).toHaveAttribute('target', '_blank');
    expect(mapLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Verify official lift timetable link
    const timetableLink = screen.getByRole('link', { name: /official lift timetable/i });
    expect(timetableLink).toBeInTheDocument();
    expect(timetableLink).toHaveAttribute('href', 'https://www.seceda.it/en/summer');

    // Verify parking map link
    const parkingLink = screen.getByRole('link', { name: /parking on google maps/i });
    expect(parkingLink).toBeInTheDocument();
    expect(parkingLink).toHaveAttribute('href', expect.stringContaining('Parking'));
  });

  it('should scroll into view when hash is #getting-here', async () => {
    const scrollIntoViewMock = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoViewMock;

    render(
      <MemoryRouter initialEntries={['/about#getting-here']}>
        <AboutPage />
      </MemoryRouter>
    );

    // Wait for requestAnimationFrame and smooth scroll execution
    await waitFor(() => {
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });
  });

});
