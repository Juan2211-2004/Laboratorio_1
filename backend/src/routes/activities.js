const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../middleware");
const { isUuid, validateActivity } = require("../validation");

const router = express.Router();

// Columnas que se devuelven al frontend (con el nombre de la materia incluido).
const SELECT_ACTIVITY = `
  SELECT a.id, a.title, a.type, a.description, a.due, a.completed,
         a.completed_at AS "completedAt", a.created_at AS "createdAt",
         a.subject_id AS "subjectId", s.name AS subject
  FROM activities a
  JOIN subjects s ON s.id = a.subject_id`;

async function subjectExists(subjectId) {
  const { rowCount } = await pool.query("SELECT 1 FROM subjects WHERE id = $1", [subjectId]);
  return rowCount > 0;
}

async function findActivity(id, userId) {
  const { rows } = await pool.query(`${SELECT_ACTIVITY} WHERE a.id = $1 AND a.user_id = $2`, [id, userId]);
  return rows[0] || null;
}

// Rechaza ids mal formados antes de llegar a la base de datos.
router.param("id", (req, res, next, id) => {
  if (!isUuid(id)) return res.status(404).json({ error: "Actividad no encontrada." });
  next();
});

// GET /api/activities  ->  actividades del usuario, ordenadas por fecha de entrega
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `${SELECT_ACTIVITY} WHERE a.user_id = $1 ORDER BY a.due ASC`,
    [req.user.id]
  );
  res.json(rows);
}));

// POST /api/activities  ->  crea una actividad
router.post("/", asyncHandler(async (req, res) => {
  const { value, error } = validateActivity(req.body);
  if (error) return res.status(400).json({ error });
  if (!(await subjectExists(value.subjectId))) {
    return res.status(400).json({ error: "La materia no existe." });
  }

  const { rows } = await pool.query(
    `INSERT INTO activities (user_id, subject_id, title, type, description, due)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [req.user.id, value.subjectId, value.title, value.type, value.description, value.due]
  );
  res.status(201).json(await findActivity(rows[0].id, req.user.id));
}));

// PUT /api/activities/:id  ->  edita una actividad
router.put("/:id", asyncHandler(async (req, res) => {
  const { value, error } = validateActivity(req.body);
  if (error) return res.status(400).json({ error });
  if (!(await subjectExists(value.subjectId))) {
    return res.status(400).json({ error: "La materia no existe." });
  }

  const { rowCount } = await pool.query(
    `UPDATE activities
     SET subject_id = $1, title = $2, type = $3, description = $4, due = $5, updated_at = NOW()
     WHERE id = $6 AND user_id = $7`,
    [value.subjectId, value.title, value.type, value.description, value.due, req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Actividad no encontrada." });
  res.json(await findActivity(req.params.id, req.user.id));
}));

// PATCH /api/activities/:id/complete  { completed: true|false }  ->  marca o reabre
router.patch("/:id/complete", asyncHandler(async (req, res) => {
  if (typeof req.body?.completed !== "boolean") {
    return res.status(400).json({ error: "El campo 'completed' debe ser true o false." });
  }
  const { rowCount } = await pool.query(
    `UPDATE activities
     SET completed = $1,
         completed_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
         updated_at = NOW()
     WHERE id = $2 AND user_id = $3`,
    [req.body.completed, req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Actividad no encontrada." });
  res.json(await findActivity(req.params.id, req.user.id));
}));

// DELETE /api/activities/:id
router.delete("/:id", asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    "DELETE FROM activities WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.id]
  );
  if (!rowCount) return res.status(404).json({ error: "Actividad no encontrada." });
  res.status(204).end();
}));

module.exports = router;
