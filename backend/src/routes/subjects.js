const express = require("express");
const { pool } = require("../db");
const { asyncHandler } = require("../middleware");

const router = express.Router();

// GET /api/subjects  ->  lista de materias
router.get("/", asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, name, color, icon, description FROM subjects ORDER BY id"
  );
  res.json(rows);
}));

module.exports = router;
