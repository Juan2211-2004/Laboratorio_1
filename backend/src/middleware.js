const jwt = require("jsonwebtoken");
const { jwtSecret } = require("./config");

// Express 4 no captura errores de funciones async: este envoltorio los pasa a next().
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Exige un token válido en la cabecera "Authorization: Bearer <token>".
function requireAuth(req, res, next) {
  const header = req.get("Authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Debes iniciar sesión." });
  }
  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    res.status(401).json({ error: "Tu sesión expiró. Inicia sesión de nuevo." });
  }
}

function notFound(req, res) {
  res.status(404).json({ error: "Ruta no encontrada." });
}

// Manejador central de errores: no expone detalles internos al cliente.
function errorHandler(error, req, res, next) {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ error: "El cuerpo de la petición no es JSON válido." });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ error: "La petición es demasiado grande." });
  }
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor." });
}

module.exports = { asyncHandler, requireAuth, notFound, errorHandler };
