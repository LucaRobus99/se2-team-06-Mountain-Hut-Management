import { assertIsolatedServer, createSlotOnFreeDate, logInViaForm, searchAvailability } from '../support/hutFixtures.js';

describe('Mountain Hut - Authenticated Booking with Allergies & Vegan Diet (MH-01, MH-03, MH-05)', () => {
  it('should add a vegan diet with a peanut allergy on the review screen and complete the reservation', () => {
    assertIsolatedServer();
    createSlotOnFreeDate({ meal: 'lunch', tables: [{ tableIdentifier: 'E2E table 4', seats: 4 }] })
      .then(({ date }) => {
        logInViaForm('hiker@hut.test');
        searchAvailability(date, 'Lunch', 2);
        cy.contains('.eh-slot-tile', '12:00', { timeout: 10000 }).click();
        cy.contains('button', /continue to booking/i, { timeout: 10000 }).click();

        // MH-05: one requirement with its own allergy flag, added on the review screen.
        cy.get('.eh-party-add', { timeout: 10000 }).click();
        cy.get('#eh-diet-description-1').type('Vegan x1, Peanut allergy');
        cy.get('#eh-diet-allergy-1').check();
        cy.contains('.eh-booking-actions button', 'Confirm booking').click();

        // MH-03: the confirmation page shows the saved requirement.
        cy.location('pathname', { timeout: 10000 }).should('match', /^\/book\/confirmation\/\d+$/);
        cy.contains('Vegan x1, Peanut allergy').should('be.visible');
      });
  });
});
