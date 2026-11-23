const express = require("express");
const config = require("./config");
const { pool, waitForDatabase } = require("./db");
const { hashPassword } = require("./password");
const { requireAuth, notFound, errorHandler } = require("./middleware");

const authRoutes = require("./routes/auth");
const subjectRoutes = require("./routes/subjects");
const activityRoutes = require("./routes/activities");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));

// Comprobación de salud (la usa Docker para saber si el backend está listo).
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "ok" });
  } catch {
    res.status(503).json({ status: "error", database: "sin conexión" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/subjects", requireAuth, subjectRoutes);
app.use("/api/activities", requireAuth, activityRoutes);

app.use(notFound);
app.use(errorHandler);

// Crea el usuario de demostración si se definió en .env y aún no existe.
async function ensureDemoUser() {
  const { email, password, name } = config.demoUser;
  if (!email || !password) return;
  const passwordHash = await hashPassword(password);
  const { rowCount } = await pool.query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
     ON CONFLICT (email) DO NOTHING`,
    [email, name, passwordHash]
  );
  if (rowCount) console.log(`Usuario de demostración creado: ${email}`);
}

async function start() {
  await waitForDatabase();
  await ensureDemoUser();
  const server = app.listen(config.port, () => {
    console.log(`API de AcademicHub escuchando en el puerto ${config.port}`);
  });

  // Cierre ordenado cuando Docker detiene el contenedor.
  const shutdown = () => {
    server.close(() => pool.end().then(() => process.exit(0)));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

start().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
