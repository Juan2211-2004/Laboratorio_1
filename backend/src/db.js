const { Pool } = require("pg");
const { databaseUrl } = require("./config");

// Un único pool de conexiones para toda la aplicación.
const pool = new Pool({ connectionString: databaseUrl });

pool.on("error", (error) => {
  console.error("Error inesperado en la conexión con PostgreSQL:", error);
});

// Reintenta la conexión mientras la base de datos termina de arrancar.
async function waitForDatabase(retries = 10, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await pool.query("SELECT 1");
      console.log("Conectado a PostgreSQL");
      return;
    } catch (error) {
      console.log(`Esperando a PostgreSQL (intento ${attempt}/${retries}): ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error("No se pudo conectar a PostgreSQL");
}

module.exports = { pool, waitForDatabase };
