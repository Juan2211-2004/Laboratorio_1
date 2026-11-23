// Servidor de prueba: sirve el frontend y simula la API con el mismo contrato que el backend real.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.argv[2];
const PORT = Number(process.argv[3] || 8099);
const TOKEN = "token-prueba";
const subjects = [
  { id: 1, name: "Programación", color: "blue", icon: "💻", description: "Desarrollo de software y lógica de programación." },
  { id: 2, name: "Bases de datos", color: "purple", icon: "🗄️", description: "Modelado, consultas y gestión de datos." },
  { id: 3, name: "Redes", color: "green", icon: "🌐", description: "Infraestructura, conectividad y protocolos." },
  { id: 4, name: "Ingeniería de software", color: "orange", icon: "🧩", description: "Análisis, diseño y calidad de software." },
  { id: 5, name: "Matemáticas", color: "pink", icon: "📐", description: "Conceptos matemáticos aplicados." },
  { id: 6, name: "Otras", color: "blue", icon: "📚", description: "Actividades de otras asignaturas." }
];
let activities = [];
const TYPES = ["Tarea", "Evaluación", "Exposición", "Proyecto"];

function send(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
}
function withSubject(a) { return { ...a, subject: subjects.find(s => s.id === a.subjectId).name }; }

http.createServer((req, res) => {
  let raw = "";
  req.on("data", c => raw += c);
  req.on("end", () => {
    const url = req.url.split("?")[0];
    if (url.startsWith("/api/")) {
      const body = raw ? JSON.parse(raw) : {};
      if (url === "/api/auth/login" && req.method === "POST") {
        if (body.email === "estudiante@academichub.com" && body.password === "Academic123")
          return send(res, 200, { token: TOKEN, user: { id: 1, email: body.email, name: "Estudiante" } });
        return send(res, 401, { error: "Correo o contraseña incorrectos." });
      }
      if (req.headers.authorization !== `Bearer ${TOKEN}`) return send(res, 401, { error: "Debes iniciar sesión." });
      if (url === "/api/subjects") return send(res, 200, subjects);
      if (url === "/api/activities" && req.method === "GET") return send(res, 200, activities.map(withSubject));
      const validate = () => {
        if (!body.title || !TYPES.includes(body.type) || !subjects.some(s => s.id === body.subjectId) || isNaN(new Date(body.due))) return false;
        return true;
      };
      if (url === "/api/activities" && req.method === "POST") {
        if (!validate()) return send(res, 400, { error: "Datos inválidos" });
        const a = { id: crypto.randomUUID(), title: body.title, type: body.type, description: body.description || "", due: new Date(body.due).toISOString(), completed: false, completedAt: null, subjectId: body.subjectId };
        activities.push(a);
        return send(res, 201, withSubject(a));
      }
      const m = url.match(/^\/api\/activities\/([^/]+)(\/complete)?$/);
      const a = m && activities.find(x => x.id === m[1]);
      if (!a) return send(res, 404, { error: "Actividad no encontrada." });
      if (m[2] && req.method === "PATCH") { a.completed = body.completed; return send(res, 200, withSubject(a)); }
      if (req.method === "PUT") {
        if (!validate()) return send(res, 400, { error: "Datos inválidos" });
        Object.assign(a, { title: body.title, type: body.type, description: body.description, subjectId: body.subjectId, due: new Date(body.due).toISOString() });
        return send(res, 200, withSubject(a));
      }
      if (req.method === "DELETE") { activities = activities.filter(x => x !== a); return send(res, 204); }
      return send(res, 404, { error: "Ruta no encontrada." });
    }
    const file = path.join(ROOT, url === "/" ? "login.html" : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
    const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript" };
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "text/plain" });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log("mock listo en", PORT));
