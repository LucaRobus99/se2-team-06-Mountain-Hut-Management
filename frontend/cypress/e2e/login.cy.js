describe('Mountain Hut - Login Flow', () => {
  
  it('should allow a user to log in with valid credentials and redirect to the dashboard', () => {
    // 1. Visit the login page
    cy.visit('http://localhost:5173/login');

    // 2. Fill in email and password using the real seed credentials
    cy.get('input[type="email"], input#email').type('hiker@hut.test');
    cy.get('input[type="password"], input#password').type('password');

    // 3. Click the submit/login button
    cy.get('button[type="submit"], button.login-submit-btn').click();

    // 4. Verify that the user is redirected away from the login page
    cy.url().should('not.include', '/login');

    // 5. Verify that a post-login element is visible (e.g., logout, dashboard, or user profile)
    cy.contains(/logout|dashboard|welcome|profilo|hiker/i).should('be.visible');
  });

});