import { assertIsolatedServer, createSlotOnFreeDate, searchAvailability } from '../support/hutFixtures.js';

describe('Mountain Hut - Availability Search & Slot Management (MH-04)', () => {
  beforeEach(() => {
    assertIsolatedServer();
  });

  it('should successfully search for available slots on a valid date and meal', () => {
    createSlotOnFreeDate({ meal: 'lunch', tables: [{ tableIdentifier: 'E2E table 6', seats: 6 }] })
      .then(({ date }) => {
        searchAvailability(date, 'Lunch', 4);
        cy.contains('.eh-slot-tile', '12:00', { timeout: 10000 }).should('be.visible');
      });
  });

  it('should show no tables when the party is larger than the free seats (MH-04)', () => {
    createSlotOnFreeDate({
      meal: 'breakfast', startTime: '08:00', endTime: '09:00',
      tables: [{ tableIdentifier: 'E2E table 2', seats: 2 }],
    }).then(({ date }) => {
      searchAvailability(date, 'Breakfast', 4);
      cy.contains('No tables available for this search.', { timeout: 10000 }).should('be.visible');
      cy.get('.eh-slot-tile').should('not.exist');
    });
  });
});
