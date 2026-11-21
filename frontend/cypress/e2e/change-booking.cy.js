const API_URL = 'http://localhost:8080'; // sostituisci con la porta del tuo backend se diversa
const APP_URL = 'http://localhost:5173';

describe('Change a Booking', () => {
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

  it('creates a booking for 1 guest on 15 March 2027, updates guests to 2, and verifies notice', () => {
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

    // 4. Select party size (1 guest initially)
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('1');
        } else {
          cy.wrap($el).click().type('{selectall}1');
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

    // 8. Assert successful booking confirmation screen
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');

    // 9. Return to My Bookings via the green action button
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 })
      .should('be.visible')
      .click();
    cy.url({ timeout: 10000 }).should('include', '/my-bookings');

    // 10. Expand the booking card and click "Change booking"
    cy.get('.eh-manage-arrow-button', { timeout: 10000 })
      .first()
      .should('be.visible')
      .click();

    cy.get('.eh-edit-actions > .eh-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 11. Change guests from 1 to 2 in #edit-guests and click "Save changes"
    cy.get('select#edit-guests, input#edit-guests, #edit-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('2');
        } else {
          cy.wrap($el).click().type('{selectall}2');
        }
      });

    cy.get('.eh-edit-actions > .eh-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 12. Verify confirmation notice in .eh-manage-notice
    cy.get('.eh-manage-notice', { timeout: 10000 })
      .should('be.visible')
      .and(($el) => {
        const normalizedText = $el.text().replace(/\s+/g, ' ').trim();
        expect(normalizedText).to.include('Booking updated successfully. Email delivery was not confirmed.');
      });
  });
});