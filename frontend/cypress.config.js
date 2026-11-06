import { defineConfig } from "cypress";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Percorso assoluto calcolato a partire da questo file (non dalla directory
// dalla quale si lancia Cypress).
const configDirectory = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(configDirectory, "../backend/database/database.sqlite");

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      on("task", {
        resetDb() {
          let db;

          try {
            // Evita che SQLite crei silenziosamente un database vuoto
            // se il percorso è sbagliato o il backend non è stato inizializzato.
            if (!existsSync(dbPath)) {
              throw new Error(`Database non trovato: ${dbPath}`);
            }

            db = new DatabaseSync(dbPath);
            db.exec("PRAGMA foreign_keys = ON;");

            // Pulizia atomica: rimuove SOLO le prenotazioni create dai test.
            // Gli slot e i relativi tavoli del seed devono rimanere disponibili
            // per i successivi test di prenotazione e disponibilità.
            db.exec("BEGIN IMMEDIATE;");
            try {
              db.exec("DELETE FROM booking_seats;");
              db.exec("DELETE FROM bookings;");
              db.exec("COMMIT;");
            } catch (error) {
              db.exec("ROLLBACK;");
              throw error;
            }

            console.log("Prenotazioni di test eliminate; slot e tavoli preservati.");
            return null;
          } catch (error) {
            // Cypress deve fallire se il reset non è riuscito.
            console.error("Errore critico nel reset del database:", error);
            throw error;
          } finally {
            db?.close();
          }
        },
      });

      return config;
    },
  },
});
