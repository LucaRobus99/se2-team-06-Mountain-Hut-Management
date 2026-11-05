import { defineConfig } from "cypress";
import { DatabaseSync } from "node:sqlite";
import path from "path";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on('task', {
        resetDb() {
          try {
            // Sale di un livello (fuori da frontend) ed entra in backend/database/database.sqlite
            const dbPath = path.resolve('../backend/database/database.sqlite');
            console.log("Tentativo di apertura DB in:", dbPath);
            
            const db = new DatabaseSync(dbPath);
            
            // Pulizia delle prenotazioni e relativi posti
            db.exec('DELETE FROM booking_seats;');
            db.exec('DELETE FROM bookings;');
            
            // Pulizia delle tabelle relative agli slot (prima le dipendenze, poi gli slot)
            db.exec('DELETE FROM slot_tables;');
            db.exec('DELETE FROM slots;');
            
            db.close();
            console.log("Database pulito con successo!");
          } catch (error) {
            console.error("Errore critico sul DB:", error);
          }
          return null;
        },
      });
      return config;
    },
  },
});