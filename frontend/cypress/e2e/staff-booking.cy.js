const api = (path, options = {}) => cy.request({ url: `/api${path}`, ...options, retryOnNetworkFailure: !options.method || options.method === 'GET' });
function freeDate(offset = 7) {
  if (offset > 60) throw new Error('No empty date for staff booking fixtures.');
  const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  return api('/slots', { qs: { date } }).then(({ body }) => body.slots.length ? freeDate(offset + 1) : date);
}

describe('MH-07 — staff-assisted reservations', () => {
  it('books for all three guest types and enforces a password change at first login', () => {
    api('/e2e').its('body').should('deep.equal', { isolated: true });
    const unique = Date.now();
    const existingEmail = `mh07-existing-${unique}@hut.test`;
    const newEmail = `mh07-new-${unique}@hut.test`;
    let date, temporaryPassword;
    api('/auth/register', { method: 'POST', body: { name: 'Existing E2E Hiker', email: existingEmail, phone: '+39012345678', password: 'password' } });
    api('/auth/logout', { method: 'POST' });
    api('/auth/login', { method: 'POST', body: { email: 'employee@hut.test', password: 'password' } });
    freeDate().then(day => {
      date = day;
      return api('/slots', { method: 'POST', body: { date, meal: 'lunch', startTime: '12:00', endTime: '13:00', tables: [{ tableIdentifier: 'E2E staff table', seats: 12 }] } });
    });
    cy.visit('/staff/reservations');
    function chooseSlot() {
      cy.get('#sr-date').click();
      cy.then(() => {
        const label = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
        function pick(maxMonths = 4) {
          cy.get('.ea-calendar-popover').then(calendar => {
            const candidate = calendar.find(`button[aria-label="${label}"]`);
            if (candidate.length) cy.wrap(candidate).click();
            else {
              if (!maxMonths) throw new Error('Fixture date not present in calendar.');
              cy.get('button[aria-label="Next month"]').click();
              pick(maxMonths - 1);
            }
          });
        }
        pick();
      });
      cy.contains('button', 'Find availability').click();
      cy.contains('button.eh-slot-tile', '12:00').should('have.attr', 'aria-pressed', 'false').click();
      cy.contains('button', 'Confirm reservation').should('be.enabled').click();
    }
    cy.get('#sr-hiker-search').type(existingEmail);
    cy.contains('button', /^Search$/).click();
    cy.contains('button.sr-hiker', existingEmail).click();
    chooseSlot();
    cy.contains('Reservation created successfully.').should('be.visible');
    cy.contains('button', 'Create another reservation').click();
    cy.contains('button', 'Temporary guest').click();
    cy.get('#sr-name').type('E2E Walk-in');
    chooseSlot();
    cy.contains('No confirmation email was sent').should('be.visible');
    cy.contains('button', 'Create another reservation').click();
    cy.contains('button', 'New hiker').click();
    cy.get('#sr-name').type('New E2E Hiker');
    cy.get('#sr-phone').type('+39012345678');
    cy.get('#sr-email').type(newEmail);
    chooseSlot();
    cy.contains('New hiker account').should('be.visible');
    cy.contains('button', 'Show password').click();
    cy.get('.sr-password-row code').invoke('text').then(value => { temporaryPassword = value; });
    api('/auth/logout', { method: 'POST' });
    cy.visit('/login');
    cy.get('#login-email').type(newEmail);
    cy.then(() => cy.get('#login-password').type(temporaryPassword, { log: false }));
    cy.contains('button', /^Log in$/).click();
    cy.location('pathname').should('equal', '/change-password');
    cy.then(() => cy.get('#temporary-password').type(temporaryPassword, { log: false }));
    cy.get('#recovery-new').type('NewPassword-123', { log: false });
    cy.get('#recovery-confirm').type('NewPassword-123', { log: false });
    cy.contains('button', 'Set new password').click();
    cy.location('pathname').should('equal', '/my-bookings');
    api('/bookings').its('body.bookings').should('have.length', 1);
  });
});
