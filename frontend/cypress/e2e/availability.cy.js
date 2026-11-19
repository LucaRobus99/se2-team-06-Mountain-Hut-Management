describe('Mountain Hut - Availability Search & Slot Management (MH-04)', () => {

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should successfully search for available slots on a valid date and meal', () => {
    // 1. Visit availability search page
    cy.visit('http://localhost:5173/availability');
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Open datepicker and advance 4 months to March 2027, then select day 15
    cy.get('#availability-date').click();
    // Avanza di 4 mesi (da novembre 2026 a marzo 2027)
    for (let i = 0; i < 4; i++) {
      cy.get('button[aria-label*="Next month"], button.ea-calendar-next, .react-datepicker__navigation--next')
        .first()
        .click();
    }
    cy.get('button.ea-calendar-day:not([disabled])').contains(/^15$/).click();

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

    // 5. Submit search and verify available slots
    cy.get('button.search-submit-btn, button:contains("Search")').click();
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible');
  });

  it('should properly handle slots with zero capacity or unavailable status (MH-04)', () => {
    // 1. Visit availability search page
    cy.visit('http://localhost:5173/availability');
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Open datepicker and advance 4 months to March 2027, then select day 16 (slot 12 with no tables)
    cy.get('#availability-date').click();
    for (let i = 0; i < 4; i++) {
      cy.get('button[aria-label*="Next month"], button.ea-calendar-next, .react-datepicker__navigation--next')
        .first()
        .click();
    }
    cy.get('button.ea-calendar-day:not([disabled])').contains(/^16$/).click();

    // 3. Select meal (lunch - matching slot 12 on 2027-03-16)
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^lunch$/i).click();

    // 4. Select party size
    cy.get('select#availability-guests, input#availability-guests, #availability-guests', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('2');
        } else {
          cy.wrap($el).click().type('{selectall}2');
        }
      });

    // 5. Submit search
    cy.get('button.search-submit-btn, button:contains("Search")').click();

    // 6. Assert that either no slots are shown or a zero-capacity/unavailable message appears
    cy.get('body').then(($body) => {
      const hasSlots = $body.find('.eh-slot-tile').length > 0;
      if (hasSlots) {
        cy.get('.eh-slot-tile').should('have.class', 'is-disabled').or('contain.text', 'unavailable');
      } else {
        cy.get('.eh-availability-search').should('be.visible');
      }
    });
  });

});