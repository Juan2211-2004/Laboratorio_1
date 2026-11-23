const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { jwtSecret, jwtExpiresIn } = require("../config");
const { verifyPassword } = require("../password");
const { asyncHandler, requireAuth } = require("../middleware");

const router = express.Router();

// POST /api/auth/login  { email, password }  ->  { token, user }
router.post("/login", asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({ error: "Ingresa tu correo y tu contraseña." });
  }

  const { rows } = await pool.query(
    "SELECT id, email, name, password_hash FROM users WHERE email = $1",
    [email]
  );
  const user = rows[0];

  // Mismo mensaje si el correo no existe o la contraseña falla (no revela qué correos existen).
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({ error: "Correo o contraseña incorrectos." });
  }

  const token = jwt.sign({ sub: user.id, email: user.email }, jwtSecret, { expiresIn: jwtExpiresIn });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
}));

// GET /api/auth/me  ->  datos del usuario de la sesión
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const { rows } = await pool.query("SELECT id, email, name FROM users WHERE id = $1", [req.user.id]);
  if (!rows[0]) return res.status(401).json({ error: "El usuario ya no existe." });
  res.json(rows[0]);
}));

module.exports = router;
