// Pruebas de integración de la API REST de AcademicHub (caja negra, por HTTP).
// Sin dependencias: usa el runner y fetch que trae Node 22.
//
//   API_URL       URL base (por defecto http://localhost:8080, es decir, Nginx de docker compose)
//   DEMO_EMAIL    usuario de prueba (por defecto el de .env.example)
//   DEMO_PASSWORD contraseña de prueba
//   JWT_SECRET    opcional: habilita las pruebas de tokens vencidos y de aislamiento entre usuarios
//
// Ejecutar:  node --test tests/api.test.js
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const API = (process.env.API_URL || "http://localhost:8080").replace(/\/$/, "") + "/api";
const EMAIL = process.env.DEMO_EMAIL || "estudiante@academichub.com";
const PASSWORD = process.env.DEMO_PASSWORD || "Academic123";
const SECRET = process.env.JWT_SECRET;

let token;
const created = [];

async function call(path, { method = "GET", body, auth = token, raw, headers = {} } = {}) {
  const h = { ...headers };
  if (auth) h.Authorization = `Bearer ${auth}`;
  if (body !== undefined || raw !== undefined) h["Content-Type"] = "application/json";
  const res = await fetch(API + path, { method, headers: h, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* respuesta no JSON */ }
  return { status: res.status, body: json };
}

// Firma un JWT HS256 (igual que jsonwebtoken) para probar tokens vencidos y otros usuarios.
function signToken(payload, secret = SECRET) {
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const head = enc({ alg: "HS256", typ: "JWT" });
  const body = enc({ iat: Math.floor(Date.now() / 1000), ...payload });
  const sig = crypto.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

const inDays = (d) => new Date(Date.now() + d * 86400000).toISOString();
const newActivity = (over = {}) => ({ title: "Prueba API", type: "Tarea", subjectId: 1, due: inDays(2), description: "creada por api.test.js", ...over });

async function createActivity(over) {
  const r = await call("/activities", { method: "POST", body: newActivity(over) });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  created.push(r.body.id);
  return r.body;
}

before(async () => {
  const r = await call("/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD }, auth: null });
  assert.equal(r.status, 200, `No se pudo iniciar sesión en ${API}: ${JSON.stringify(r.body)}`);
  token = r.body.token;
});

after(async () => {
  for (const id of created) await call(`/activities/${id}`, { method: "DELETE" });
});

describe("Salud del servicio", () => {
  test("GET /health responde ok con la base de datos conectada", async () => {
    const r = await call("/health", { auth: null });
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { status: "ok", database: "ok" });
  });

  test("una ruta inexistente responde 404 en JSON", async () => {
    const r = await call("/no-existe", { auth: null });
    assert.equal(r.status, 404);
    assert.ok(r.body.error);
  });
});

describe("Autenticación", () => {
  test("login correcto devuelve token y usuario, nunca el hash", async () => {
    const r = await call("/auth/login", { method: "POST", body: { email: EMAIL, password: PASSWORD }, auth: null });
    assert.equal(r.status, 200);
    assert.match(r.body.token, /^[\w-]+\.[\w-]+\.[\w-]+$/);
    assert.equal(r.body.user.email, EMAIL);
    assert.equal("password_hash" in r.body.user, false);
  });

  test("el correo no distingue mayúsculas ni espacios", async () => {
    const r = await call("/auth/login", { method: "POST", body: { email: `  ${EMAIL.toUpperCase()} `, password: PASSWORD }, auth: null });
    assert.equal(r.status, 200);
  });

  test("contraseña incorrecta y correo inexistente dan el mismo 401", async () => {
    const wrongPass = await call("/auth/login", { method: "POST", body: { email: EMAIL, password: "mala" }, auth: null });
    const noUser = await call("/auth/login", { method: "POST", body: { email: "nadie@ejemplo.com", password: "mala" }, auth: null });
    assert.equal(wrongPass.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPass.body.error, noUser.body.error, "el mensaje no debe revelar qué correos existen");
  });

  test("campos vacíos responden 400", async () => {
    const r = await call("/auth/login", { method: "POST", body: { email: "", password: "" }, auth: null });
    assert.equal(r.status, 400);
  });

  test("GET /auth/me devuelve el usuario del token", async () => {
    const r = await call("/auth/me");
    assert.equal(r.status, 200);
    assert.equal(r.body.email, EMAIL);
  });

  for (const [name, auth] of [["sin token", null], ["token mal formado", "abc"], ["firma alterada", () => token.slice(0, -2) + (token.endsWith("AA") ? "BB" : "AA")]]) {
    test(`rutas protegidas rechazan ${name} con 401`, async () => {
      const r = await call("/activities", { auth: typeof auth === "function" ? auth() : auth });
      assert.equal(r.status, 401);
    });
  }

  test("un token vencido responde 401", { skip: !SECRET && "requiere JWT_SECRET" }, async () => {
    const expired = signToken({ sub: 1, email: EMAIL, exp: Math.floor(Date.now() / 1000) - 60 });
    const r = await call("/activities", { auth: expired });
    assert.equal(r.status, 401);
  });

  test("un token firmado con otro secreto responde 401", async () => {
    const forged = signToken({ sub: 1, email: EMAIL, exp: Math.floor(Date.now() / 1000) + 600 }, "secreto-falso");
    const r = await call("/activities", { auth: forged });
    assert.equal(r.status, 401);
  });
});

describe("Materias", () => {
  test("GET /subjects devuelve las 6 materias iniciales con su apariencia", async () => {
    const r = await call("/subjects");
    assert.equal(r.status, 200);
    assert.equal(r.body.length, 6);
    for (const s of r.body) {
      assert.deepEqual(Object.keys(s).sort(), ["color", "description", "icon", "id", "name"]);
    }
    assert.ok(r.body.some(s => s.name === "Bases de datos"));
  });
});

describe("Actividades: ciclo de vida completo", () => {
  test("crear → listar → editar → completar → reabrir → eliminar", async () => {
    const a = await createActivity({ title: "Ciclo de vida", subjectId: 2 });
    assert.match(a.id, /^[0-9a-f-]{36}$/);
    assert.equal(a.subject, "Bases de datos");
    assert.equal(a.completed, false);
    assert.equal(a.completedAt, null);

    const list = await call("/activities");
    assert.equal(list.status, 200);
    assert.ok(list.body.some(x => x.id === a.id));
    const dues = list.body.map(x => new Date(x.due).getTime());
    assert.deepEqual(dues, [...dues].sort((x, y) => x - y), "la lista debe venir ordenada por fecha");

    const edited = await call(`/activities/${a.id}`, { method: "PUT", body: newActivity({ title: "Ciclo editado", type: "Proyecto", subjectId: 3 }) });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.title, "Ciclo editado");
    assert.equal(edited.body.subject, "Redes");

    const done = await call(`/activities/${a.id}/complete`, { method: "PATCH", body: { completed: true } });
    assert.equal(done.status, 200);
    assert.equal(done.body.completed, true);
    assert.ok(done.body.completedAt, "completedAt debe registrarse");

    const reopened = await call(`/activities/${a.id}/complete`, { method: "PATCH", body: { completed: false } });
    assert.equal(reopened.body.completed, false);
    assert.equal(reopened.body.completedAt, null);

    const del = await call(`/activities/${a.id}`, { method: "DELETE" });
    assert.equal(del.status, 204);
    created.splice(created.indexOf(a.id), 1);

    assert.equal((await call(`/activities/${a.id}`, { method: "DELETE" })).status, 404);
    assert.equal((await call(`/activities/${a.id}`, { method: "PUT", body: newActivity() })).status, 404);
  });

  test("la fecha se guarda en UTC sin perder la hora local", async () => {
    const a = await createActivity({ due: "2026-12-01T09:30:00-05:00" });
    assert.equal(new Date(a.due).toISOString(), "2026-12-01T14:30:00.000Z");
  });

  test("texto con SQL o HTML se guarda literalmente (sin inyección)", async () => {
    const title = "'); DROP TABLE activities; -- <b>x</b>";
    const a = await createActivity({ title });
    assert.equal(a.title, title);
    assert.equal((await call("/activities")).status, 200, "la tabla debe seguir existiendo");
  });
});

describe("Actividades: validación (400)", () => {
  const invalid = [
    ["sin título", { title: "" }],
    ["título de 101 caracteres", { title: "a".repeat(101) }],
    ["tipo no permitido", { type: "Examen" }],
    ["materia inexistente", { subjectId: 999 }],
    ["materia no numérica", { subjectId: "abc" }],
    ["fecha inválida", { due: "mañana" }],
    ["fecha nula", { due: null }],
    ["descripción de 501 caracteres", { description: "a".repeat(501) }]
  ];
  for (const [name, change] of invalid) {
    test(`POST rechaza ${name}`, async () => {
      const r = await call("/activities", { method: "POST", body: newActivity(change) });
      assert.equal(r.status, 400, JSON.stringify(r.body));
      assert.ok(r.body.error);
    });
  }

  test("JSON mal formado responde 400", async () => {
    const r = await call("/activities", { method: "POST", raw: "{titulo: sin comillas" });
    assert.equal(r.status, 400);
  });

  test("un cuerpo de más de 20 KB responde 413", async () => {
    const r = await call("/activities", { method: "POST", body: newActivity({ description: "a".repeat(25000) }) });
    assert.equal(r.status, 413);
  });

  test("PATCH exige completed booleano", async () => {
    const a = await createActivity();
    const r = await call(`/activities/${a.id}/complete`, { method: "PATCH", body: { completed: "si" } });
    assert.equal(r.status, 400);
  });

  test("un id que no es UUID responde 404 sin llegar a la base de datos", async () => {
    for (const id of ["123", "abc", "1%20OR%201%3D1"]) {
      const r = await call(`/activities/${id}`, { method: "DELETE" });
      assert.equal(r.status, 404, id);
    }
  });
});

describe("Aislamiento entre usuarios", { skip: !SECRET && "requiere JWT_SECRET" }, () => {
  test("otro usuario no ve, edita, completa ni borra actividades ajenas", async () => {
    const mine = await createActivity({ title: "Privada" });
    const other = signToken({ sub: 999999, email: "otro@ejemplo.com", exp: Math.floor(Date.now() / 1000) + 600 });

    const list = await call("/activities", { auth: other });
    assert.equal(list.status, 200);
    assert.equal(list.body.some(x => x.id === mine.id), false);

    assert.equal((await call(`/activities/${mine.id}`, { method: "PUT", auth: other, body: newActivity({ title: "Hackeada" }) })).status, 404);
    assert.equal((await call(`/activities/${mine.id}/complete`, { method: "PATCH", auth: other, body: { completed: true } })).status, 404);
    assert.equal((await call(`/activities/${mine.id}`, { method: "DELETE", auth: other })).status, 404);

    const still = (await call("/activities")).body.find(x => x.id === mine.id);
    assert.equal(still.title, "Privada");
    assert.equal(still.completed, false);
  });
});
