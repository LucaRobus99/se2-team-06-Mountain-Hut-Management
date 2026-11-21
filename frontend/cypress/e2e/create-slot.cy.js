const API_URL = 'http://localhost:8080';

describe('Mountain Hut - Employee Slot Creation Flow', () => {

  beforeEach(() => {
    // Pulisce prenotazioni di test e lo slot di test creato (senza toccare il seed)
    cy.request('POST', `${API_URL}/api/test/reset`);

    // 1. Apri la pagina di login e verifica che il form sia visibile
    cy.visit('http://localhost:5173/login');
    cy.get('form.eh-login-form', { timeout: 10000 }).should('be.visible');

    // 2. Inserisci le credenziali di employee dal seed
    cy.get('input#login-email').should('be.visible').clear().type('employee@hut.test');
    cy.get('input#login-password').should('be.visible').clear().type('password');

    // 3. Invia il form di login
    cy.get('button[type="submit"]').click();

    // 4. Verifica che l'autenticazione sia andata a buon fine uscendo da /login
    cy.url({ timeout: 10000 }).should('not.include', '/login');
  });

  afterEach(() => {
    // Ripulisce anche a fine test per lasciare il DB pronto al giro successivo
    cy.request('POST', `${API_URL}/api/test/reset`);
  });

  it('should allow an employee to create a new slot on 14 March 2027', () => {
    // 1. Apri il form iniziale di creazione slot
    cy.get('.staff-empty > .staff-primary-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 2. Seleziona la data 14 marzo 2027 tramite #slot-date e conferma con [aria-label="14 Mar 2027"]
    cy.get('#slot-date', { timeout: 10000 })
      .should('be.visible')
      .click();
    for (let i = 0; i < 4; i++) {
      cy.get('button[aria-label*="Next month"], button.ea-calendar-next, .react-datepicker__navigation--next')
        .first()
        .click();
    }
    cy.get('[aria-label="14 Mar 2027"]', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 3. Apri l'orario di inizio e seleziona 13:00
    cy.get('#slot-start', { timeout: 10000 })
      .should('be.visible')
      .click();
    cy.get(':nth-child(1) > .staff-time-list > :nth-child(14)', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 4. Apri l'orario di fine e seleziona 14:00
    cy.get('#slot-end', { timeout: 10000 })
      .should('be.visible')
      .click();
    cy.get(':nth-child(1) > .staff-time-list > :nth-child(15)', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 5. Aggiungi un altro tavolo
    cy.get('.staff-outline-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 6. Imposta i posti del tavolo #table-seats-3 da 4 a 6
    cy.get('#table-seats-3', { timeout: 10000 })
      .should('be.visible')
      .then(($el) => {
        if ($el.is('select')) {
          cy.wrap($el).select('6');
        } else {
          cy.wrap($el).click().clear().type('6');
        }
      });

    // 7. Premi il pulsante per creare lo slot (.staff-primary-button)
    cy.get('.staff-primary-button', { timeout: 10000 })
      .filter(':visible')
      .last()
      .click();

    // 8. Conferma nella modale (.modal-footer > .staff-primary-button)
    cy.get('.modal-footer > .staff-primary-button', { timeout: 10000 })
      .should('be.visible')
      .click();

    // 9. Verifica che appaia l'elemento .staff-created e l'orario 13:00
    cy.get('.staff-created', { timeout: 10000 }).should('be.visible');
    cy.contains(/13:00/, { timeout: 10000 }).should('be.visible');
  });

});