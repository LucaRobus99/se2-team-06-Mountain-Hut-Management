const API_URL = 'http://localhost:8080';

describe('Mountain Hut - Booking Flow (Guest to Login)', () => {

  beforeEach(() => {
    cy.request('POST', `${API_URL}/api/test/reset`);
  });

  afterEach(() => {
    cy.request('POST', `${API_URL}/api/test/reset`);
  });

  it('should allow a guest to search availability, select a slot, and redirect to login', () => {
    // 1. Visit the availability page
    cy.visit('http://localhost:5173/availability');

    // 2. Wait for the search form to be visible
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 3. Click the custom date picker using its ID to open the calendar popup
    cy.get('#availability-date').click();

    // 4. Advance 4 months (Nov 2026 -> Mar 2027) and pick day 15
    for (let i = 0; i < 4; i++) {
      cy.get('button[aria-label*="Next month"], button.ea-calendar-next, .react-datepicker__navigation--next')
        .first()
        .click();
    }
    cy.get('button.ea-calendar-day:not([disabled])').contains(/^15$/).click();

    // 5. Select the meal (lunch) - open the custom dropdown and click the option
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^lunch$/i).click();

    // 6. Select the number of guests (2) - handle native select or custom input box
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('2');
        } else {
          cy.wrap($el).click().type('{selectall}2');
        }
      });

    // 7. Click the search submit button
    cy.get('button.search-submit-btn, button:contains("Search")').click();

    // 8. Wait for the slot tiles to appear and select the first available one
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible').first().click();

    // 9. Verify that the selection summary panel appears
    cy.get('.eh-selection-summary', { timeout: 10000 }).should('be.visible');

    // 10. Click the "Continue to booking" button
    cy.contains('button', /continue to booking/i).click();

    // 11. Verify redirection to login page since user is unauthenticated
    cy.url().should('include', '/login');
    cy.get('form').should('be.visible');
  });

});