import { api, assertIsolatedServer, findFreeDate } from '../support/hutFixtures.js';

// Staff date picker buttons are labelled like "14 Mar 2027".
const dayLabel = date => new Intl.DateTimeFormat('en-GB', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
}).format(new Date(`${date}T00:00:00Z`));

function pickStaffDate(trigger, date) {
  cy.get(trigger).click();
  function pick(monthsLeft = 4) {
    cy.get('.staff-calendar').then(calendar => {
      const day = calendar.find(`button[aria-label="${dayLabel(date)}"]`);
      if (day.length) {
        cy.wrap(day).click();
      } else {
        if (!monthsLeft) throw new Error(`Date ${date} not present in staff calendar.`);
        cy.get('.staff-calendar button[aria-label="Next month"]').click();
        pick(monthsLeft - 1);
      }
    });
  }
  pick();
}

function pickTime(trigger, label, hour, minute) {
  cy.get(trigger).click();
  cy.get(`[role="dialog"][aria-label="${label} picker"]`).within(() => {
    cy.get('[aria-label="Hours"]').contains('[role="option"]', hour).click();
    cy.get('[aria-label="Minutes"]').contains('[role="option"]', minute).click();
    cy.contains('button', 'Done').click();
  });
}

describe('Mountain Hut - Employee Slot Creation Flow (MH-02)', () => {
  it('should allow an employee to create a new slot with a newly defined table', () => {
    assertIsolatedServer();
    const tableName = `E2E terrace ${Date.now()}`;
    api('/auth/login', { method: 'POST', body: { email: 'employee@hut.test', password: 'password' } });

    findFreeDate().then(date => {
      cy.visit('/staff/slots');
      cy.contains('button', 'Create a new slot').click();
      pickStaffDate('#slot-date', date);
      pickTime('#slot-start', 'Start time', '13', '00');
      pickTime('#slot-end', 'End time', '14', '00');

      // Fixed table catalog: define a new 6-seat table; it is selected for the slot.
      cy.contains('button', '+ Define a new table').click();
      cy.get('#new-table-name').type(tableName);
      cy.get('#new-table-seats').clear().type('6');
      cy.contains('.staff-new-table button', 'Create table').click();
      cy.get(`input[aria-label="${tableName} 6 seats"]`, { timeout: 10000 }).should('be.checked');

      cy.get('button[type="submit"].staff-primary-button').click();
      cy.get('.modal-footer').contains('button', 'Confirm').click();

      cy.get('.staff-created', { timeout: 10000 }).should('be.visible').and('contain.text', '13:00');
      api('/slots', { qs: { date } }).its('body.slots').should(slots => {
        expect(slots).to.have.length(1);
        expect(slots[0]).to.include({ startTime: '13:00', endTime: '14:00' });
      });
    });
  });
});
