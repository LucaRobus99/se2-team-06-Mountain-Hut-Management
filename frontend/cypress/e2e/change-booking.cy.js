const host = 'http://localhost:5173';
const api = (path, options = {}) => cy.request({
  url: `${host}/api${path}`,
  // Do not repeat a write if its HTTP response is interrupted.
  retryOnNetworkFailure: !options.method || options.method === 'GET',
  ...options,
});

// Each run needs a date without any slots, including disabled ones.
// Check as staff, so existing test or seed slots cannot overlap our fixtures.
function findFreeDate(daysAhead = 7) {
  if (daysAhead > 60) throw new Error('No empty date found for MH-06 E2E fixtures.');
  const date = new Date(Date.now() + daysAhead * 86400000).toISOString().slice(0, 10);
  return api('/slots', { qs: { date } }).then(({ body }) => {
    expect(body.slots).to.be.an('array');
    return body.slots.length === 0 ? date : findFreeDate(daysAhead + 1);
  });
}

describe('MH-06 — change a booking', () => {
  it('updates a booking, rechecks available times and preserves it when capacity is insufficient', () => {
    // Refuse to run against anyone's regular database.
    api('/mh06-e2e').its('body').should('deep.equal', { isolated: true });
    cy.viewport(390, 844);
    let date;
    const tables = [{ tableIdentifier: 'E2E table', seats: 2 }];
    const unique = Date.now();
    const email = `mh06-${unique}@hut.test`;
    api('/auth/login', { method: 'POST', body: { email: 'warden@hut.test', password: 'password' } });
    // Keep fixtures separate even if the isolated server has not been restarted.
    findFreeDate().then(freeDate => {
      date = freeDate;
      return api('/slots', { method: 'POST', body: { date, meal: 'lunch', startTime: '12:00', endTime: '13:00', tables } });
    })
      .its('body.id').then(original => {
        api('/slots', { method: 'POST', body: { date, meal: 'lunch', startTime: '13:00', endTime: '14:00',
          tables: [{ tableIdentifier: 'E2E table four seats', seats: 4 }] } }).its('body.id').then(target => {
          api('/auth/logout', { method: 'POST' });
          api('/auth/register', { method: 'POST', body: {
            name: 'E2E Hiker', email, phone: '+39012345678', password: 'password',
          } });
          api('/bookings', { method: 'POST', body: { slotId: original, partySize: 2 } })
            .its('body.id').then(id => {
              cy.visit(`${host}/my-bookings`);
              cy.get('[aria-label="Reservation details"]').should('not.exist');
              cy.get(`button[aria-label^="Open booking #${id}:"]`).click();
              cy.contains('button', 'Change booking').click();
              cy.get('.eh-edit-panel').should('be.visible');
              cy.get('.eh-slot-tile').contains('Current time').should('be.visible');
              cy.get('#edit-guests').clear().type('3');
              cy.contains('Your current time is no longer available').should('be.visible');
              cy.contains('button.eh-slot-tile', '12:00').should('not.exist');
              cy.contains('button', 'Save changes').should('be.disabled');
              cy.contains('button.eh-slot-tile', '13:00').click();
              cy.contains('button', 'Save changes').click();
              cy.contains('Booking updated successfully').should('be.visible');
              cy.reload();
              cy.get(`button[aria-label^="Open booking #${id}:"]`).click();
              cy.contains('Your reservation').should('be.visible');
              cy.contains('3 people').should('be.visible');
              cy.contains('button', 'Change booking').click();
              cy.get('#edit-guests').clear().type('4');
              cy.contains('button.eh-slot-tile', '13:00').should('be.visible').click();
              cy.contains('button', 'Save changes').should('be.enabled');
              // Another hiker books the last free seat after the preview.
              api('/auth/logout', { method: 'POST' });
              api('/auth/register', { method: 'POST', body: {
                name: 'Competing hiker', email: `mh06-other-${unique}@hut.test`, phone: '+39012345678', password: 'password',
              } });
              api('/bookings', { method: 'POST', body: { slotId: target, partySize: 1 } });
              api('/auth/logout', { method: 'POST' });
              api('/auth/login', { method: 'POST', body: { email, password: 'password' } });
              cy.intercept('PATCH', `/api/bookings/${id}`).as('updateBooking');
              cy.contains('button', 'Save changes').click();
              cy.wait('@updateBooking').its('response.statusCode').should('equal', 409);
              cy.contains('Your original booking has not changed').should('be.visible');
              cy.get('#edit-guests').should('have.value', '4');
              cy.contains('button', 'Save changes').should('be.disabled');
              api(`/bookings/${id}`).its('body').should('include', { id, partySize: 3 });
              api(`/bookings/${id}`).its('body.slot.id').should('equal', target);
            });
        });
      });
  });
});
