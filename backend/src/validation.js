// Reglas de validación de AcademicHub.
// Módulo puro (sin Express ni base de datos) para poder probarlo de forma aislada.

const TYPES = ["Tarea", "Evaluación", "Exposición", "Proyecto"];
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value) => typeof value === "string" && UUID_REGEX.test(value);

// Valida y normaliza los datos que llegan del formulario.
// Devuelve { value } si todo es correcto o { error } con el primer problema encontrado.
function validateActivity(body) {
  const title = String(body?.title || "").trim();
  const type = String(body?.type || "");
  const description = String(body?.description || "").trim();
  const subjectId = Number(body?.subjectId);
  // Solo se acepta texto: new Date(null) o new Date(0) darían 1970-01-01 como fecha "válida".
  const due = typeof body?.due === "string" && body.due.trim() ? new Date(body.due) : new Date(NaN);

  if (!title) return { error: "El nombre de la actividad es obligatorio." };
  if (title.length > 100) return { error: "El nombre no puede superar 100 caracteres." };
  if (!TYPES.includes(type)) return { error: "El tipo de actividad no es válido." };
  if (!Number.isInteger(subjectId) || subjectId <= 0) return { error: "Selecciona una materia válida." };
  if (Number.isNaN(due.getTime())) return { error: "La fecha y hora no son válidas." };
  if (description.length > 500) return { error: "La descripción no puede superar 500 caracteres." };

  return { value: { title, type, description, subjectId, due: due.toISOString() } };
}

module.exports = { TYPES, isUuid, validateActivity };
