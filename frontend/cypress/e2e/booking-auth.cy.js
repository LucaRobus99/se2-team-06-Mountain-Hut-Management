const API_URL = 'http://localhost:8080'; // sostituisci con la porta del tuo backend se diversa

describe('Mountain Hut - Authenticated Booking & Confirmation Flow (MH-01, MH-03)', () => {

  beforeEach(() => {
    // Pulisce le prenotazioni di test tramite l'endpoint del backend già attivo
    cy.request('POST', `${API_URL}/api/test/reset`);

    // 1. Visit login page and ensure form is visible
    cy.visit('http://localhost:5173/login');
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

  it('should complete a single-table reservation for 2 guests on 15 March 2027', () => {
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

    // 7. Click "Confirm booking" using the exact green action button
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 8. Assert successful booking confirmation screen (MH-03)
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');
  });

  it('should allow booking 6 guests split across two tables on 15 March 2027', () => {
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

    // 3. Select meal (lunch - matching slot 11 on 2027-03-15)
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^lunch$/i).click();

    // 4. Party size (6 guests -> split across 2 tables if no single 6-seat table is free)
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('6');
        } else {
          cy.wrap($el).click().type('{selectall}6');
        }
      });

    // 5. Search and select slot
    cy.get('button.search-submit-btn, button:contains("Search")').click();
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible').first().click();

    // 6. Handle split seating modal confirmation if it appears for 6 guests
    cy.get('body').then(($body) => {
      if ($body.find('.modal-footer > .eh-button--green').length > 0) {
        cy.get('.modal-footer > .eh-button--green', { timeout: 10000 }).should('be.visible').click();
      }
    });

    // 7. Click "Continue to booking" on the summary section
    cy.contains('button', /continue to booking/i, { timeout: 10000 }).should('be.visible').click();

    // 8. Click "Confirm booking" on the final review screen
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 }).should('be.visible').click();

    // 9. Assert successful confirmation screen for split booking
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');
  });

});