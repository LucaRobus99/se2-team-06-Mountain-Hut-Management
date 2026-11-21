// Shared fixtures for specs that run against the isolated E2E backend
// (backend/scripts/start-e2e-server.mjs, started by `npm run e2e`). Each test creates its own slot on a
// free future date, so specs never depend on seed dates or on a reset step.

export const api = (path, options = {}) => cy.request({
  url: `/api${path}`,
  ...options,
  retryOnNetworkFailure: !options.method || options.method === 'GET',
});

/** Refuse to run against a real database. */
export function assertIsolatedServer() {
  api('/e2e').its('body').should('deep.equal', { isolated: true });
}

/** First date from `offset` days ahead that has no slots at all. */
export function findFreeDate(offset = 7) {
  if (offset > 60) throw new Error('No empty date for E2E fixtures.');
  const date = new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
  return api('/slots', { qs: { date } }).then(({ body }) => (body.slots.length ? findFreeDate(offset + 1) : date));
}

/**
 * The seed warden creates one slot on a free date, then logs out.
 * Yields `{ date, slotId }`. A table identifier must always keep the same
 * number of seats (MH-02 fixed catalog), so use one name per seat count.
 */
export function createSlotOnFreeDate({ meal = 'lunch', startTime = '12:00', endTime = '13:00', tables }) {
  api('/auth/login', { method: 'POST', body: { email: 'warden@hut.test', password: 'password' } });
  return findFreeDate().then(date =>
    api('/slots', { method: 'POST', body: { date, meal, startTime, endTime, tables } })
      .then(({ body }) => api('/auth/logout', { method: 'POST' }).then(() => ({ date, slotId: body.id }))));
}

/** Opens the Alpine date picker behind `trigger` and picks `date` (YYYY-MM-DD). */
export function pickCalendarDate(trigger, date) {
  const label = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
  cy.get(trigger).click();
  function pick(monthsLeft = 4) {
    cy.get('.ea-calendar-popover').then(calendar => {
      const day = calendar.find(`button[aria-label="${label}"]`);
      if (day.length) {
        cy.wrap(day).click();
      } else {
        if (!monthsLeft) throw new Error(`Date ${date} not present in calendar.`);
        cy.get('button[aria-label="Next month"]').click();
        pick(monthsLeft - 1);
      }
    });
  }
  pick();
}

/**
 * Signs in through the login form (seed accounts use the password "password").
 * Call it after createSlotOnFreeDate: the fixture's warden login/logout shares
 * the browser's cookie jar and would end this session.
 */
export function logInViaForm(email) {
  cy.visit('/login');
  cy.get('form.eh-login-form', { timeout: 10000 }).should('be.visible');
  cy.get('input#login-email').clear().type(email);
  cy.get('input#login-password').clear().type('password', { log: false });
  cy.get('button[type="submit"]').click();
  cy.url({ timeout: 10000 }).should('not.include', '/login');
}

/** Public availability search (MH-04) for a date, meal label and party size. */
export function searchAvailability(date, mealLabel, guests) {
  cy.visit('/availability');
  cy.get('form.eh-availability-search', { timeout: 10000 }).should('be.visible');
  pickCalendarDate('#availability-date', date);
  cy.get('#availability-meal').click();
  cy.contains('[role="option"]', mealLabel).click();
  cy.get('#availability-guests').clear().type(String(guests));
  cy.get('button.eh-availability-submit').click();
}
