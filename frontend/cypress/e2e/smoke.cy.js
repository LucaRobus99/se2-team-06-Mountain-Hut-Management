describe('Mountain Hut - Basic Navigation & Smoke Tests', () => {
  
  it('should load the availability page successfully', () => {
    // 1. Visit the availability page
    cy.visit('http://localhost:5173/availability');

    // 2. Verify that the page header or main container is visible
    cy.get('h1, .eh-navbar').should('be.visible');
  });

  it('should navigate between public pages using the navbar links', () => {
    // 1. Start from the availability page
    cy.visit('http://localhost:5173/availability');

    // 2. Click on the login link using its specific class or text
    cy.get('.eh-login-link').click();

    // 3. Verify successful redirection to the login page
    cy.url().should('include', '/login');
    cy.get('form').should('be.visible');

    // 4. Click on the Availability link in the navbar to return back
    cy.contains('nav a', /availability/i).click();
    cy.url().should('include', '/availability');
  });

});