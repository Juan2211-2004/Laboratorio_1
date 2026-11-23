// Doble de prueba del backend: sirve el frontend y simula la API con el MISMO contrato.
// Usa el módulo real de validación (backend/src/validation.js) y tokens JWT HS256 reales,
// así las pruebas de integración se pueden ejecutar sin Docker.
// Uso: node tests/mock-api.js <carpeta-frontend> [puerto]   (JWT_SECRET opcional)
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { validateActivity, isUuid } = require("../backend/src/validation");

const ROOT = path.resolve(process.argv[2] || "frontend");
const PORT = Number(process.argv[3] || 8099);
const SECRET = process.env.JWT_SECRET || "mock-secret";
const DEMO = { id: 1, email: "estudiante@academichub.com", password: "Academic123", name: "Estudiante" };
const MAX_BODY = 20 * 1024;

const subjects = [
  { id: 1, name: "Programación", color: "blue", icon: "💻", description: "Desarrollo de software y lógica de programación." },
  { id: 2, name: "Bases de datos", color: "purple", icon: "🗄️", description: "Modelado, consultas y gestión de datos." },
  { id: 3, name: "Redes", color: "green", icon: "🌐", description: "Infraestructura, conectividad y protocolos." },
  { id: 4, name: "Ingeniería de software", color: "orange", icon: "🧩", description: "Análisis, diseño y calidad de software." },
  { id: 5, name: "Matemáticas", color: "pink", icon: "📐", description: "Conceptos matemáticos aplicados." },
  { id: 6, name: "Otras", color: "blue", icon: "📚", description: "Actividades de otras asignaturas." }
];
let activities = []; // cada una con userId, como la columna user_id

// ---------- JWT HS256 mínimo ----------
const b64url = (buf) => Buffer.from(buf).toString("base64url");
function signToken(payload) {
  const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 8 * 3600, ...payload }));
  const sig = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function verifyToken(token) {
  const [head, body, sig] = String(token).split(".");
  if (!head || !body || !sig) return null;
  const expected = crypto.createHmac("sha256", SECRET).update(`${head}.${body}`).digest();
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

// ---------- utilidades ----------
function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
const publicActivity = ({ userId, ...a }) => ({ ...a, subject: subjects.find(s => s.id === a.subjectId).name });

function handleApi(req, res, url, raw) {
  if (raw.length > MAX_BODY) return send(res, 413, { error: "La petición es demasiado grande." });
  let body = {};
  if (raw) {
    try { body = JSON.parse(raw); } catch { return send(res, 400, { error: "El cuerpo de la petición no es JSON válido." }); }
  }

  if (url === "/api/health") return send(res, 200, { status: "ok", database: "ok" });

  if (url === "/api/auth/login" && req.method === "POST") {
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    if (!email || !password) return send(res, 400, { error: "Ingresa tu correo y tu contraseña." });
    if (email !== DEMO.email || password !== DEMO.password) return send(res, 401, { error: "Correo o contraseña incorrectos." });
    return send(res, 200, { token: signToken({ sub: DEMO.id, email: DEMO.email }), user: { id: DEMO.id, email: DEMO.email, name: DEMO.name } });
  }

  const known = url === "/api/auth/me" || url === "/api/subjects" || url.startsWith("/api/activities");
  if (!known) return send(res, 404, { error: "Ruta no encontrada." });

  const [scheme, token] = String(req.headers.authorization || "").split(" ");
  if (scheme !== "Bearer" || !token) return send(res, 401, { error: "Debes iniciar sesión." });
  const user = verifyToken(token);
  if (!user) return send(res, 401, { error: "Tu sesión expiró. Inicia sesión de nuevo." });

  if (url === "/api/auth/me") {
    return user.sub === DEMO.id ? send(res, 200, { id: DEMO.id, email: DEMO.email, name: DEMO.name }) : send(res, 401, { error: "El usuario ya no existe." });
  }
  if (url === "/api/subjects" && req.method === "GET") return send(res, 200, subjects);

  const mine = activities.filter(a => a.userId === user.sub);
  if (url === "/api/activities" && req.method === "GET") {
    return send(res, 200, mine.sort((a, b) => new Date(a.due) - new Date(b.due)).map(publicActivity));
  }

  const checkBody = () => {
    const { value, error } = validateActivity(body);
    if (error) return { error };
    if (!subjects.some(s => s.id === value.subjectId)) return { error: "La materia no existe." };
    return { value };
  };

  if (url === "/api/activities" && req.method === "POST") {
    const { value, error } = checkBody();
    if (error) return send(res, 400, { error });
    const now = new Date().toISOString();
    const a = { id: crypto.randomUUID(), userId: user.sub, ...value, completed: false, completedAt: null, createdAt: now };
    activities.push(a);
    return send(res, 201, publicActivity(a));
  }

  const m = url.match(/^\/api\/activities\/([^/]+)(\/complete)?$/);
  if (!m) return send(res, 404, { error: "Ruta no encontrada." });
  if (!isUuid(m[1])) return send(res, 404, { error: "Actividad no encontrada." });
  const a = mine.find(x => x.id === m[1]);

  if (m[2] && req.method === "PATCH") {
    if (typeof body?.completed !== "boolean") return send(res, 400, { error: "El campo 'completed' debe ser true o false." });
    if (!a) return send(res, 404, { error: "Actividad no encontrada." });
    a.completed = body.completed;
    a.completedAt = body.completed ? new Date().toISOString() : null;
    return send(res, 200, publicActivity(a));
  }
  if (!m[2] && req.method === "PUT") {
    const { value, error } = checkBody();
    if (error) return send(res, 400, { error });
    if (!a) return send(res, 404, { error: "Actividad no encontrada." });
    Object.assign(a, value);
    return send(res, 200, publicActivity(a));
  }
  if (!m[2] && req.method === "DELETE") {
    if (!a) return send(res, 404, { error: "Actividad no encontrada." });
    activities = activities.filter(x => x !== a);
    return send(res, 204);
  }
  return send(res, 404, { error: "Ruta no encontrada." });
}

http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => raw += c);
  req.on("end", () => {
    const url = req.url.split("?")[0];
    if (url.startsWith("/api/")) return handleApi(req, res, url, raw);
    const file = path.join(ROOT, url === "/" ? "login.html" : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log("mock listo en", PORT));
