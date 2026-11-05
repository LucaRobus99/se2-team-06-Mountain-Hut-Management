describe('Mountain Hut - Booking Flow (Guest to Login)', () => {
  
  it('should allow a guest to search availability, select a slot, and redirect to login', () => {
    // 1. Visit the availability page
    cy.visit('http://localhost:5173/availability');

    // 2. Wait for the search form to be visible
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 3. Click the custom date picker using its ID to open the calendar popup
    cy.get('#availability-date').click();

    // 4. Click on the target day in the open calendar popup (day 15)
    cy.get('.react-datepicker__day, .calendar-day, td, button').contains('15').click();

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