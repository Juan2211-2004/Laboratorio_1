const { chromium } = require("playwright");

const BASE = (process.env.E2E_URL || "http://localhost:8099").replace(/\/$/, "");
const results = [];
const check = (name, ok) => { results.push(`${ok ? "✅" : "❌"} ${name}`); };
// Valor para <input type="datetime-local">, calculado EN EL NAVEGADOR: su zona horaria
// (America/Bogota) puede ser distinta de la de Node (UTC en GitHub Actions).
const local = (page, date) => page.evaluate(ms => {
  const d = new Date(ms);
  return new Date(ms - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}, date.getTime());

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, timezoneId: "America/Bogota" });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error" && !m.text().includes("401")) errors.push(m.text()); });
  page.on("dialog", d => d.accept());

  const start = new Date("2026-11-23T10:00:00-05:00");
  await page.clock.install({ time: start });

  // Sin sesión -> redirige al login
  await page.goto(`${BASE}/index.html`);
  await page.waitForURL(/login\.html/);
  check("Sin token redirige a login", true);

  // Login incorrecto
  await page.fill("#email", "estudiante@academichub.com");
  await page.fill("#password", "mala");
  await page.click("button[type=submit]");
  await page.waitForSelector("#loginError:not(:empty)");
  check("Login incorrecto muestra error", (await page.textContent("#loginError")).includes("incorrectos"));

  // Login correcto
  await page.fill("#password", "Academic123");
  await page.click("button[type=submit]");
  await page.waitForURL(/index\.html/);
  await page.waitForSelector("#activitySubject option", { state: "attached" });
  check("Login correcto abre el panel y carga materias", (await page.locator("#activitySubject option").count()) === 6);

  // Actividad que vence en 2 minutos
  await page.fill("#activityTitle", "Quiz rápido");
  await page.selectOption("#activityType", "Evaluación");
  await page.selectOption("#activitySubject", "2");
  await page.fill("#activityDue", await local(page, new Date(start.getTime() + 2 * 60000)));
  await page.click("#submitActivity");
  await page.waitForSelector("#pendingList .activity-item");
  // Actividad a 3 días
  await page.fill("#activityTitle", "Proyecto final");
  await page.fill("#activityDue", await local(page, new Date(start.getTime() + 3 * 86400000)));
  await page.fill("#activityDescription", "<b>no debe ser HTML</b>");
  await page.click("#submitActivity");
  await page.waitForFunction(() => document.querySelectorAll("#pendingList .activity-item").length === 2);
  check("Crear actividades", true);
  check("Texto con HTML se muestra escapado", (await page.locator("#pendingList b").count()) === 0);
  check("Próximas entregas = 2", (await page.textContent("#upcomingCount")) === "2");
  await page.screenshot({ path: require("path").join(__dirname, "panel.png"), fullPage: true });

  // Corrección 2: pasan 3 minutos sin recargar -> "Vencida" aparece sola
  await page.clock.fastForward("03:00");
  await page.waitForTimeout(300);
  const overdueTags = await page.locator("#pendingList .overdue-tag").count();
  const upcomingItems = await page.locator("#upcomingList .activity-item").count();
  check("Sin recargar: la actividad pasa a 'Vencida'", overdueTags === 1);
  check("Sin recargar: sale de 'Próximas entregas'", upcomingItems === 1);

  // Editar
  await page.locator("#pendingList [data-edit]").nth(1).click();
  check("Editar carga el formulario", (await page.inputValue("#activityTitle")) === "Proyecto final" && (await page.textContent("#formTitle")) === "Editar actividad");
  await page.fill("#activityTitle", "Proyecto final (v2)");
  await page.click("#submitActivity");
  await page.waitForSelector("text=Proyecto final (v2)");
  check("Editar guarda cambios y vuelve a modo agregar", (await page.textContent("#formTitle")) === "Agregar actividad" && (await page.locator("#cancelEdit").isHidden()));

  // Completar
  await page.locator("#pendingList [data-complete]").first().click();
  await page.waitForFunction(() => document.getElementById("completedCount").textContent === "1");
  check("Completar actividad", true);

  // Materias y detalle
  await page.click(".nav-link[data-view=subjects]");
  await page.click("[data-subject='2']");
  check("Detalle de materia", (await page.textContent("#pageTitle")) === "Bases de datos" && (await page.locator("#subjectDetail .activity-item").count()) === 1);
  check("En el detalle sigue resaltado 'Materias'", await page.locator(".nav-link[data-view=subjects].active").count() === 1);

  // Eliminar
  await page.locator("#subjectDetail [data-delete]").first().click();
  await page.waitForFunction(() => document.querySelectorAll("#subjectDetail .activity-item").length === 0);
  check("Eliminar actividad", true);

  // Persistencia: tras recargar, lo que se ve debe venir igual del servidor.
  const snapshot = () => page.evaluate(() => ({
    titles: [...document.querySelectorAll("#allActivitiesList .activity-item h3")].map(h => h.textContent).sort(),
    pending: document.getElementById("pendingCount").textContent,
    completed: document.getElementById("completedCount").textContent
  }));
  const beforeReload = await snapshot();
  await page.reload();
  await page.waitForSelector("#pendingList .activity-item, #pendingList .empty-state");
  const afterReload = await snapshot();
  check("Datos persisten tras recargar", JSON.stringify(beforeReload) === JSON.stringify(afterReload) && beforeReload.titles.length > 0);

  // Cerrar sesión
  await page.click("#logoutButton");
  await page.waitForURL(/login\.html/);
  check("Cerrar sesión", await page.evaluate(() => !sessionStorage.getItem("tokenAcademicHub")));

  // Móvil
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(`${BASE}/login.html`);
  await mobile.screenshot({ path: require("path").join(__dirname, "login-movil.png") });

  check(`Sin errores en consola (${errors.join(" | ")})`, errors.length === 0);
  console.log(results.join("\n"));
  const failed = results.filter(r => r.startsWith("❌")).length;
  console.log(`\n${results.length - failed}/${results.length} pruebas superadas`);
  await browser.close();
  if (failed) process.exitCode = 1; // el CI marca la ejecución como fallida
})().catch(e => { console.log(results.join("\n")); console.error("FALLO:", e.message); process.exit(1); });
