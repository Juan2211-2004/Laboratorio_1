// Configuración leída de variables de entorno (las define docker-compose a partir de .env).
function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env`);
  }
  return value;
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  demoUser: {
    email: (process.env.DEMO_EMAIL || "").trim().toLowerCase(),
    password: process.env.DEMO_PASSWORD || "",
    name: process.env.DEMO_NAME || "Estudiante"
  }
};
