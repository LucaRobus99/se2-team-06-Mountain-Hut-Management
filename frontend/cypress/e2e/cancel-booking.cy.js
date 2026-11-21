const API_URL = 'http://localhost:8080'; // sostituisci con la porta del tuo backend se diversa
const APP_URL = 'http://localhost:5173';

describe('MH-08 — Cancel a Booking', () => {
  beforeEach(() => {
    // Pulisce le prenotazioni di test tramite l'endpoint del backend già attivo
    cy.request('POST', `${API_URL}/api/test/reset`);

    // 1. Visit login page and ensure form is visible
    cy.visit(`${APP_URL}/login`);
    cy.get('form.eh-login-form', { timeout: 10000 }).should('be.visible');

    // 2. Fill in valid test credentials using the seed data
    cy.get('input#login-email').should('be.visible').clear().type('hiker@hut.test');
    cy.get('input#login-password').should('be.visible').clear().type('password');

    // 3. Submit login form
    cy.get('button[type="submit"]').click();

    // 4. Assert successful authentication by checking URL change
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  });

  afterEach(() => {
    // Pulisce anche al termine del test per lasciare il DB pronto al giro successivo
    cy.request('POST', `${API_URL}/api/test/reset`);
  });

  it('creates a booking on 15 March 2027 and cancels it from My Bookings', () => {
    // 1. Navigate to availability search page
    cy.visit(`${APP_URL}/availability`);
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Select target date (15 March 2027 -> +4 months from Nov 2026)
    cy.get('#availability-date').click();
    for (let i = 0; i < 4; i++) {
      cy.get('button[aria-label*="Next month"], button.ea-calendar-next, .react-datepicker__navigation--next')
        .first()
        .click();
    }
    cy.get('button.ea-calendar-day:not([disabled])').contains(/^15$/).click();

    // 3. Select meal (lunch)
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^lunch$/i).click();

    // 4. Select party size (2 guests -> single table)
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('2');
        } else {
          cy.wrap($el).click().type('{selectall}2');
        }
      });

    // 5. Submit search and pick slot
    cy.get('button.search-submit-btn, button:contains("Search")').click();
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible').first().click();
    cy.get('.eh-selection-summary', { timeout: 10000 }).should('be.visible');

    // 6. Click "Continue to booking" button from the summary panel
    cy.contains('button', /continue to booking/i, { timeout: 10000 }).should('be.visible').click();

    // 7. Click "Confirm booking" using the exact green action button
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 8. Assert successful booking confirmation screen (MH-03)
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');

    // 9. Return to My Bookings via the green action button
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 })
      .should('be.visible')
      .click();
    cy.url({ timeout: 10000 }).should('include', '/my-bookings');

    // 10. Expand the booking card, open cancellation dialog, and confirm cancellation
    cy.get('.eh-manage-arrow-button', { timeout: 10000 })
      .first()
      .should('be.visible')
      .click();

    cy.get('.eh-cancel-booking-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    cy.intercept('DELETE', '**/api/bookings/*').as('cancelBooking');

    cy.get('.eh-cancel-confirm', { timeout: 10000 })
      .should('be.visible')
      .click();

    cy.wait('@cancelBooking').its('response.statusCode').should('equal', 200);

    // 11. Verify the booking status in .eh-edit-status is cancelled
    cy.get('.eh-edit-status', { timeout: 10000 })
      .should('be.visible')
      .and(($el) => {
        expect($el.text().trim().toLowerCase()).to.include('cancelled');
      });
  });
});