const API_URL = 'http://localhost:8080';

describe('Mountain Hut - Authenticated Booking with Allergies & Vegan Diet (MH-01, MH-03)', () => {

  beforeEach(() => {
    cy.request('POST', `${API_URL}/api/test/reset`);

    cy.visit('http://localhost:5173/login');
    cy.get('form.eh-login-form', { timeout: 10000 }).should('be.visible');

    cy.get('input#login-email').should('be.visible').clear().type('hiker@hut.test');
    cy.get('input#login-password').should('be.visible').clear().type('password');

    cy.get('button[type="submit"]').click();
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  });

  afterEach(() => {
    cy.request('POST', `${API_URL}/api/test/reset`);
  });

  it('should add vegan diet and peanut allergy on review screen and complete reservation on 15 March 2027', () => {
    // 1. Navigate to availability search page
    cy.visit('http://localhost:5173/availability');
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

    // 7. In "Review your booking", click .eh-party-add to add dietary/allergy info
    cy.get('.eh-party-add', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 8. Type "Vegan x1, Peanut allergy" in the visible text input
    cy.get('input[type="text"]:visible, textarea:visible', { timeout: 10000 })
      .last()
      .clear()
      .type('Vegan x1, Peanut allergy');

    // 9. Check the allergy checkbox #eh-diet-allergy-1
    cy.get('#eh-diet-allergy-1', { timeout: 10000 })
      .should('exist')
      .check({ force: true });

    // 10. Click "Confirm booking"
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 11. Assert successful booking confirmation screen (MH-03)
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');
  });

});