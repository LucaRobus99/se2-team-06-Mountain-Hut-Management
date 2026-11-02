describe('Mountain Hut - Booking Flow (Guest to Login)', () => {
  
  it('should allow a guest to search availability, select a slot, and redirect to login', () => {
    // 1. Visit the availability page
    cy.visit('http://localhost:5173/availability');

    // 2. Fill in the search form (date, meal, party size)
    // Select a safe future date (e.g., 2026-11-20)
    cy.get('input[type="date"]').type('2026-11-20');
    
    // Select the meal (e.g., lunch)
    cy.get('select#availability-meal').select('lunch');
    
    // Select the number of guests (e.g., 2)
    cy.get('select#availability-guests').select('2');

    // Click the search submit button
    cy.get('button.search-submit-btn').click();

    // 3. Wait for the slots to appear and select the first available one
    cy.get('.slot-card', { timeout: 10000 }).should('be.visible').first().click();

    // 4. Verify that the seating details panel appears
    cy.get('.seating-panel').should('be.visible');

    // 5. Click the "Continue to booking" button
    cy.contains('button', /continue to booking/i).click();

    // 6. Since the user is not logged in, the app should redirect them to the login page
    cy.url().should('include', '/login');
    
    // Final check that we are actually on the login page
    cy.get('form').should('be.visible');
  });

});