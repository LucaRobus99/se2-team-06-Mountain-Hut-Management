describe('Mountain Hut - Authenticated Booking & Confirmation Flow (MH-01, MH-03)', () => {

  before(() => {
    cy.task('resetDb');
  });

  beforeEach(() => {
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

  it('should complete a table reservation and show the confirmation screen', () => {
    // 1. Navigate to availability search page
    cy.visit('http://localhost:5173/availability');
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Select target date (Nov 15, 2026)
    cy.get('#availability-date').click();
    cy.get('.react-datepicker__day, .calendar-day, td, button').contains('15').click();

    // 3. Select meal (lunch)
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^lunch$/i).click();

    // 4. Select party size (4 guests)
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('4');
        } else {
          cy.wrap($el).click().type('{selectall}4');
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

  it('should allow booking a large party that spans multiple tables', () => {
    // 1. Navigate to availability search page
    cy.visit('http://localhost:5173/availability');
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Select target date (Nov 15, 2026)
    cy.get('#availability-date').click();
    cy.get('.react-datepicker__day, .calendar-day, td, button').contains('15').click();

    // 3. Select meal as dinner to avoid overlapping with the lunch reservation
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^dinner$/i).click();

    // 4. Large party size (10 guests)
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('10');
        } else {
          cy.wrap($el).click().type('{selectall}10');
        }
      });

    // 5. Search and select slot
    cy.get('button.search-submit-btn, button:contains("Search")').click();
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible').first().click();

    // 6. Handle split seating modal confirmation using the specific modal footer button
    cy.get('.modal-footer > .eh-button--green', { timeout: 10000 }).should('be.visible').click();

    // 7. Click "Continue to booking" on the summary section
    cy.contains('button', /continue to booking/i, { timeout: 10000 }).should('be.visible').click();

    // 8. Click "Confirm booking" on the final review screen
    cy.get('.eh-booking-actions > .eh-button--green', { timeout: 10000 }).should('be.visible').click();

    // 9. Assert successful confirmation screen for split booking
    cy.contains(/reservation confirmed|booking successful|confirmed|success/i, { timeout: 10000 }).should('be.visible');
  });

});