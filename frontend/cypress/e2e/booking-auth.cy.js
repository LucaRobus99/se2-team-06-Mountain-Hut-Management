import { assertIsolatedServer, createSlotOnFreeDate, searchAvailability } from '../support/hutFixtures.js';

describe('Mountain Hut - Authenticated Booking & Confirmation Flow (MH-01, MH-03)', () => {
  beforeEach(() => {
    assertIsolatedServer();
  });

  // Sign in as the seed hiker through the login form. Call it after
  // createSlotOnFreeDate: the fixture's warden login/logout shares the
  // browser's cookie jar and would end the hiker's session.
  function logInAsHiker() {
    cy.visit('/login');
    cy.get('form.eh-login-form', { timeout: 10000 }).should('be.visible');
    cy.get('input#login-email').clear().type('hiker@hut.test');
    cy.get('input#login-password').clear().type('password', { log: false });
    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  }

  function confirmBooking() {
    cy.contains('button', /continue to booking/i, { timeout: 10000 }).click();
    cy.contains('.eh-booking-actions button', 'Confirm booking', { timeout: 10000 }).click();
    // MH-03: the confirmation page for the new booking.
    cy.location('pathname', { timeout: 10000 }).should('match', /^\/book\/confirmation\/\d+$/);
  }

  it('should complete a table reservation and show the confirmation screen', () => {
    // Each test gets its own slot, so the one-booking-per-slot rule never interferes.
    createSlotOnFreeDate({ meal: 'lunch', tables: [{ tableIdentifier: 'E2E table 6', seats: 6 }] })
      .then(({ date }) => {
        logInAsHiker();
        searchAvailability(date, 'Lunch', 4);
        cy.contains('.eh-slot-tile', '12:00', { timeout: 10000 }).click();
        cy.get('.eh-selection-summary', { timeout: 10000 }).should('contain.text', 'Together at one table');
        confirmBooking();
      });
  });

  it('should allow booking a large party that spans multiple tables', () => {
    createSlotOnFreeDate({
      meal: 'dinner', startTime: '19:00', endTime: '20:00',
      tables: [{ tableIdentifier: 'E2E table 6', seats: 6 }, { tableIdentifier: 'E2E table 6 B', seats: 6 }],
    }).then(({ date }) => {
      logInAsHiker();
      searchAvailability(date, 'Dinner', 10);
      cy.contains('.eh-slot-tile', '19:00', { timeout: 10000 }).click();
      cy.contains('button', 'Continue with split seating', { timeout: 10000 }).click();
      cy.get('.eh-selection-summary', { timeout: 10000 }).should('contain.text', 'Seated across multiple tables');
      confirmBooking();
    });
  });
});
