import { assertIsolatedServer, createSlotOnFreeDate, searchAvailability } from '../support/hutFixtures.js';

describe('Mountain Hut - Booking Flow (Guest to Login)', () => {
  it('should allow a guest to search availability, select a slot, and redirect to login', () => {
    assertIsolatedServer();
    createSlotOnFreeDate({ meal: 'lunch', tables: [{ tableIdentifier: 'E2E table 6', seats: 6 }] })
      .then(({ date }) => {
        searchAvailability(date, 'Lunch', 2);
        cy.contains('.eh-slot-tile', '12:00', { timeout: 10000 }).click();
        cy.get('.eh-selection-summary', { timeout: 10000 }).should('be.visible');
        cy.contains('button', /continue to booking/i).click();

        // Not signed in: the booking flow asks the visitor to log in first.
        cy.url().should('include', '/login');
        cy.get('form').should('be.visible');
      });
  });
});
