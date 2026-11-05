describe('Mountain Hut - Availability Search & Slot Management (MH-04)', () => {

  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  it('should successfully search for available slots on a valid date and meal', () => {
    // 1. Visit availability search page
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

    // 5. Submit search and verify available slots
    cy.get('button.search-submit-btn, button:contains("Search")').click();
    cy.get('.eh-slot-tile', { timeout: 10000 }).should('be.visible');
  });

  it('should properly handle slots with zero capacity or unavailable status (MH-04)', () => {
    // 1. Visit availability search page
    cy.visit('http://localhost:5173/availability');
    cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');

    // 2. Select target date (Nov 16, 2026) where slot 8 has zero tables/capacity in seed data
    cy.get('#availability-date').click();
    cy.get('.react-datepicker__day, .calendar-day, td, button').contains('16').click();

    // 3. Select meal (breakfast)
    cy.get('#availability-meal', { timeout: 10000 }).should('be.visible').click();
    cy.contains('div, span, li, option', /^breakfast$/i).click();

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
        // Se compaiono tile, verifichiamo che siano contrassegnati come non disponibili o disabilitati
        cy.get('.eh-slot-tile').should('have.class', 'is-disabled').or('contain.text', 'unavailable');
      } else {
        // Se non ci sono slot disponibili per quella ricerca, l'assenza è corretta (gestione capienza zero)
        cy.get('.eh-availability-search').should('be.visible');
      }
    });
  });

});