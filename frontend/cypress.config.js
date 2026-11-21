import { defineConfig } from "cypress";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
// Importa PGlite dai node_modules del backend così funziona anche se Cypress è in /frontend
import { PGlite } from "../backend/node_modules/@electric-sql/pglite/dist/index.js";

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const pgliteDir = path.resolve(configDirectory, "../backend/database/pglite");

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on("task", {
        async resetDb() {
          if (!existsSync(pgliteDir)) {
            throw new Error(`Directory PGlite non trovata: ${pgliteDir}`);
          }

          const db = new PGlite(pgliteDir);
          try {
            // Rimuove SOLO le prenotazioni (e i relativi posti assegnati) create dai test.
            // Utenti, slot e tavoli del seed rimangono intatti.
            await db.exec(`
              BEGIN;
              DELETE FROM booking_seats;
              DELETE FROM bookings;
              COMMIT;
            `);

            console.log("Prenotazioni di test eliminate; slot e tavoli preservati.");
            return null;
          } catch (error) {
            await db.exec("ROLLBACK;").catch(() => {});
            console.error("Errore critico nel reset del database:", error);
            throw error;
          } finally {
            await db.close();
          }
        },
      });

      return config;
    },
  },
});