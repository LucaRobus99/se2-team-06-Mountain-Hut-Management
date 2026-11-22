const api = (path, options = {}) => cy.request({
  url: `/api${path}`,
  retryOnNetworkFailure: !options.method || options.method === 'GET',
  ...options,
});

function findFreeDate(days = 7) {
  if (days > 60) throw new Error('No empty date for MH-08 E2E fixtures.');
  const date = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return api('/slots', { qs: { date } }).then(({ body }) =>
    body.slots.length ? findFreeDate(days + 1) : date);
}

describe('MH-08 — cancel a booking', () => {
  it('confirms cancellation, preserves history and restores public availability', () => {
    api('/e2e').its('body').should('deep.equal', { isolated: true });
    cy.viewport(390, 844);
    const email = `mh08-${Date.now()}@hut.test`;
    api('/auth/login', { method: 'POST', body: { email: 'warden@hut.test', password: 'password' } });
    findFreeDate().then(date => {
      const search = () => api('/availability', { qs: { date, meal: 'lunch', partySize: 2 } });
      api('/slots', { method: 'POST', body: { date, meal: 'lunch', startTime: '12:00', endTime: '13:00',
        tables: [{ tableIdentifier: 'MH08 E2E table', seats: 2 }] } }).its('body.id').then(slotId => {
        api('/auth/logout', { method: 'POST' });
        api('/auth/register', { method: 'POST', body: {
          name: 'Cancellation Hiker', email, phone: '+39012345678', password: 'password',
        } });
        api('/bookings', { method: 'POST', body: { slotId, partySize: 2 } }).its('body.id').then(id => {
          search().its('body.slots').should('be.empty');
          cy.visit('/my-bookings');
          cy.get(`button[aria-label^="Open booking #${id}:"]`).click();
          cy.contains('button', 'Cancel booking').click();
          cy.get('[role="dialog"]').should('be.visible').and('have.attr', 'aria-modal', 'true');
          cy.get('.modal').click('topLeft');
          cy.get('[role="dialog"]').should('be.visible').contains('button', 'Keep booking').click();
          cy.get('[role="dialog"]').should('not.exist');
          api(`/bookings/${id}`).its('body.status').should('equal', 'confirmed');
          cy.contains('button', 'Cancel booking').click();
          cy.intercept('DELETE', `/api/bookings/${id}`).as('cancelBooking');
          cy.get('[role="dialog"]').contains('button', 'Confirm cancellation').click();
          cy.wait('@cancelBooking').its('response.statusCode').should('equal', 200);
          cy.contains('Booking cancelled successfully').should('be.visible');
          cy.contains('button', 'Cancelled').should('have.attr', 'aria-pressed', 'true');
          cy.contains('button', 'Cancel booking').should('not.exist');
          search().its('body.slots').should(slots => {
            expect(slots.find(slot => slot.id === slotId).availableSeats).to.equal(2);
          });
          cy.contains('a', 'View full details').click();
          cy.contains('Your booking was cancelled').should('be.visible');
          cy.contains('a', 'Back to My Bookings').click();
          cy.contains('button', 'Cancelled').should('have.attr', 'aria-pressed', 'true');
          cy.reload();
          cy.get(`button[aria-label^="Open booking #${id}:"]`).click();
          cy.contains('button', 'Cancel booking').should('not.exist');
          api(`/bookings/${id}`).its('body.status').should('equal', 'cancelled');
        });
      });
    });
  });
});
