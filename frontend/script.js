// ============================================
// ACADEMICHUB - ACTIVIDADES, MATERIAS Y CONTADOR
// Los datos se guardan en el backend (API REST + PostgreSQL).
// ============================================

const TOKEN_KEY = "tokenAcademicHub";
const USER_KEY = "usuarioAcademicHub";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Sin token no se puede usar el panel: volver al inicio de sesión.
if (!sessionStorage.getItem(TOKEN_KEY)) {
  window.location.replace("login.html");
} else {
  document.addEventListener("DOMContentLoaded", initializeApp);
}

let subjects = [];
let activities = [];
let countdownInterval = null;
let selectedSubjectId = null;
let editingId = null;
let lastTimeSignature = "";

// ---------- Comunicación con la API ----------

async function api(path, options = {}) {
  const headers = { Authorization: `Bearer ${sessionStorage.getItem(TOKEN_KEY)}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined
    });
  } catch {
    throw new Error("No hay conexión con el servidor. Revisa que el backend esté encendido.");
  }

  // Token vencido o inválido: cerrar sesión.
  if (response.status === 401) {
    logout();
    throw new Error("Tu sesión expiró.");
  }
  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Error del servidor (${response.status}).`);
  }
  return data;
}

function showAppError(message) {
  const box = document.getElementById("appError");
  if (!box) return;
  box.textContent = message;
  box.hidden = !message;
}

// ---------- Inicio ----------

async function initializeApp() {
  setText("userEmail", sessionStorage.getItem(USER_KEY) || "Estudiante");
  bindEvents();

  try {
    [subjects, activities] = await Promise.all([api("/subjects"), api("/activities")]);
    // Protección extra: si la respuesta no es una lista, trabajar con lista vacía.
    if (!Array.isArray(subjects)) subjects = [];
    if (!Array.isArray(activities)) activities = [];
  } catch (error) {
    showAppError(`No se pudieron cargar tus datos. ${error.message}`);
  }

  populateSubjectSelect();
  setDefaultDueDate();
  renderAll();
  startCountdown();
}

function populateSubjectSelect() {
  const select = document.getElementById("activitySubject");
  if (!select) return;
  const current = select.value;
  select.innerHTML = subjects.map(subject =>
    `<option value="${subject.id}">${escapeHTML(subject.name)}</option>`
  ).join("");
  if (current) select.value = current;
}

function setDefaultDueDate() {
  const input = document.getElementById("activityDue");
  if (!input) return;

  // Sugiere una fecha futura (mañana a las 9:00 a. m.).
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  input.value = toLocalDateTimeValue(tomorrow);
  input.min = toLocalDateTimeValue(new Date());
}

function toLocalDateTimeValue(date) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function bindEvents() {
  document.getElementById("activityForm")?.addEventListener("submit", submitActivity);
  document.getElementById("cancelEdit")?.addEventListener("click", cancelEdit);
  document.getElementById("activityFilter")?.addEventListener("change", renderAllActivities);
  document.getElementById("logoutButton")?.addEventListener("click", logout);
  document.getElementById("backToSubjects")?.addEventListener("click", () => showView("subjects"));

  // Delegación de eventos para botones que se crean dinámicamente.
  document.addEventListener("click", (event) => {
    const navButton = event.target.closest("[data-view]");
    if (navButton) return showView(navButton.dataset.view);

    const subjectButton = event.target.closest("[data-subject]");
    if (subjectButton) return openSubject(Number(subjectButton.dataset.subject));

    const completeButton = event.target.closest("[data-complete]");
    if (completeButton) return toggleComplete(completeButton.dataset.complete);

    const editButton = event.target.closest("[data-edit]");
    if (editButton) return startEdit(editButton.dataset.edit);

    const deleteButton = event.target.closest("[data-delete]");
    if (deleteButton) return deleteActivity(deleteButton.dataset.delete);
  });
}

// ---------- Crear / editar ----------

async function submitActivity(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const title = String(formData.get("title") || "").trim();
  const type = String(formData.get("type") || "Tarea");
  const subjectId = Number(formData.get("subject"));
  const due = String(formData.get("due") || "");
  const description = String(formData.get("description") || "").trim();

  if (!title || !subjectId || !due) {
    showFormMessage("Completa los campos obligatorios.", "error");
    return;
  }

  // El input datetime-local está en hora local; se envía en ISO (UTC) al servidor.
  const dueDate = new Date(due);
  if (Number.isNaN(dueDate.getTime())) {
    showFormMessage("La fecha y hora no son válidas.", "error");
    return;
  }

  const payload = { title, type, subjectId, due: dueDate.toISOString(), description };
  const submitButton = document.getElementById("submitActivity");
  submitButton.disabled = true;

  try {
    if (editingId) {
      const updated = await api(`/activities/${editingId}`, { method: "PUT", body: payload });
      activities = activities.map(item => item.id === updated.id ? updated : item);
      showFormMessage("Cambios guardados correctamente.", "success");
    } else {
      const created = await api("/activities", { method: "POST", body: payload });
      activities.push(created);
      showFormMessage("Actividad guardada correctamente.", "success");
    }
    resetForm();
    renderAll();
  } catch (error) {
    showFormMessage(error.message, "error");
  } finally {
    submitButton.disabled = false;
  }
}

function startEdit(id) {
  const activity = activities.find(item => item.id === id);
  if (!activity) return;

  editingId = id;
  showView("dashboard");

  document.getElementById("activityTitle").value = activity.title;
  document.getElementById("activityType").value = activity.type;
  document.getElementById("activitySubject").value = String(activity.subjectId);
  document.getElementById("activityDescription").value = activity.description || "";
  const dueInput = document.getElementById("activityDue");
  dueInput.min = ""; // Permite conservar una fecha ya pasada al editar.
  dueInput.value = toLocalDateTimeValue(new Date(activity.due));

  setText("formTitle", "Editar actividad");
  setText("submitActivity", "Guardar cambios");
  document.getElementById("cancelEdit").hidden = false;
  showFormMessage("", "");
  renderAll();

  const form = document.getElementById("activityForm");
  form?.scrollIntoView({ behavior: "smooth", block: "center" });
  document.getElementById("activityTitle")?.focus({ preventScroll: true });
}

function cancelEdit() {
  resetForm();
  showFormMessage("", "");
  renderAll();
}

function resetForm() {
  editingId = null;
  document.getElementById("activityForm")?.reset();
  setDefaultDueDate();
  populateSubjectSelect();
  setText("formTitle", "Agregar actividad");
  setText("submitActivity", "＋ Guardar actividad");
  const cancel = document.getElementById("cancelEdit");
  if (cancel) cancel.hidden = true;
}

function showFormMessage(text, type) {
  const message = document.getElementById("formMessage");
  if (!message) return;
  message.textContent = text;
  message.className = `form-message ${type}`;
}

// ---------- Completar / eliminar ----------

async function toggleComplete(id) {
  const activity = activities.find(item => item.id === id);
  if (!activity) return;
  try {
    const updated = await api(`/activities/${id}/complete`, {
      method: "PATCH",
      body: { completed: !activity.completed }
    });
    activities = activities.map(item => item.id === id ? updated : item);
    showAppError("");
    renderAll();
  } catch (error) {
    showAppError(error.message);
  }
}

async function deleteActivity(id) {
  const activity = activities.find(item => item.id === id);
  if (!activity) return;
  if (!window.confirm(`¿Deseas eliminar "${activity.title}"?`)) return;
  try {
    await api(`/activities/${id}`, { method: "DELETE" });
    activities = activities.filter(item => item.id !== id);
    if (editingId === id) resetForm();
    showAppError("");
    renderAll();
  } catch (error) {
    showAppError(error.message);
  }
}

// ---------- Renderizado ----------

function renderAll() {
  renderStats();
  renderCountdown();
  renderSubjects();
  renderLists();
}

// Listas que dependen de la hora actual (pendientes, próximas, vencidas).
function renderLists() {
  renderPendingList();
  renderUpcomingList();
  renderAllActivities();
  if (selectedSubjectId) renderSubjectDetail(selectedSubjectId);
  lastTimeSignature = getTimeSignature();
}

function getPendingActivities() {
  return activities
    .filter(item => !item.completed)
    .sort((a, b) => new Date(a.due) - new Date(b.due));
}

function isUpcoming(item, now = Date.now()) {
  const due = new Date(item.due).getTime();
  return due >= now && due <= now + ONE_WEEK_MS;
}

// Resume qué actividades están vencidas o próximas. Si cambia, hay que redibujar las listas.
function getTimeSignature() {
  const now = Date.now();
  return getPendingActivities()
    .map(item => {
      const due = new Date(item.due).getTime();
      return `${item.id}:${due < now ? "v" : isUpcoming(item, now) ? "p" : "f"}`;
    })
    .join("|");
}

function renderStats() {
  const pending = activities.filter(item => !item.completed);
  const completed = activities.filter(item => item.completed);
  const now = Date.now();

  setText("pendingCount", pending.length);
  setText("upcomingCount", pending.filter(item => isUpcoming(item, now)).length);
  setText("completedCount", completed.length);
  setText("subjectCount", subjects.length);
}

function renderCountdown() {
  const container = document.getElementById("countdownContent");
  if (!container) return;

  const pending = getPendingActivities();
  const next = pending.find(item => new Date(item.due).getTime() > Date.now());

  if (!next) {
    const overdue = pending[0];
    container.innerHTML = overdue
      ? `<div class="countdown-activity">
          <span class="activity-type">${escapeHTML(overdue.type)}</span>
          <h3>${escapeHTML(overdue.title)}</h3>
          <p>${escapeHTML(overdue.subject)} · ${formatDate(overdue.due)}</p>
          <div class="expired-countdown">Esta actividad ya venció</div>
        </div>`
      : `<p class="empty-state">No tienes actividades pendientes. ¡Disfruta el avance!</p>`;
    return;
  }

  const parts = getTimeParts(new Date(next.due).getTime() - Date.now());
  container.innerHTML = `
    <div class="countdown-activity">
      <span class="activity-type">${escapeHTML(next.type)}</span>
      <h3>${escapeHTML(next.title)}</h3>
      <p>${escapeHTML(next.subject)} · Entrega: ${formatDate(next.due)}</p>
      <div class="countdown-clock" aria-label="Tiempo restante">
        <div><strong>${parts.days}</strong><span>Días</span></div>
        <div><strong>${parts.hours}</strong><span>Horas</span></div>
        <div><strong>${parts.minutes}</strong><span>Minutos</span></div>
        <div><strong>${parts.seconds}</strong><span>Segundos</span></div>
      </div>
    </div>`;
}

function startCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    renderCountdown();
    renderStats();
    // Corrección: si alguna actividad venció o entró en los próximos 7 días, actualizar las listas.
    if (getTimeSignature() !== lastTimeSignature) renderLists();
  }, 1000);
}

function getTimeParts(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60
  };
}

function renderPendingList() {
  const container = document.getElementById("pendingList");
  if (!container) return;
  const list = getPendingActivities().slice(0, 5);
  container.innerHTML = list.length
    ? list.map(activity => activityCard(activity, true)).join("")
    : `<p class="empty-state">No tienes tareas pendientes.</p>`;
}

function renderUpcomingList() {
  const container = document.getElementById("upcomingList");
  if (!container) return;
  const now = Date.now();
  const list = getPendingActivities().filter(item => isUpcoming(item, now)).slice(0, 5);
  container.innerHTML = list.length
    ? list.map(activity => activityCard(activity, false)).join("")
    : `<p class="empty-state">No hay entregas próximas en los siguientes 7 días.</p>`;
}

function renderAllActivities() {
  const container = document.getElementById("allActivitiesList");
  if (!container) return;
  const filter = document.getElementById("activityFilter")?.value || "all";
  let list = [...activities].sort((a, b) => new Date(a.due) - new Date(b.due));

  if (filter === "pending") list = list.filter(item => !item.completed);
  if (filter === "completed") list = list.filter(item => item.completed);

  container.innerHTML = list.length
    ? list.map(activity => activityCard(activity, true)).join("")
    : `<p class="empty-state">No hay actividades para mostrar.</p>`;
}

function activityCard(activity, showActions) {
  const overdue = !activity.completed && new Date(activity.due).getTime() < Date.now();
  const id = escapeHTML(activity.id);
  const classes = ["activity-item", activity.completed ? "completed" : "", activity.id === editingId ? "editing" : ""].join(" ");
  return `
    <article class="${classes}">
      <div class="activity-main">
        <div class="activity-meta">
          <span class="activity-type">${escapeHTML(activity.type)}</span>
          <span class="activity-subject">${escapeHTML(activity.subject)}</span>
          ${activity.completed ? '<span class="status-tag completed-tag">Completada</span>' : overdue ? '<span class="status-tag overdue-tag">Vencida</span>' : ""}
        </div>
        <h3>${escapeHTML(activity.title)}</h3>
        ${activity.description ? `<p>${escapeHTML(activity.description)}</p>` : ""}
        <p class="activity-date">📅 ${formatDate(activity.due)}</p>
      </div>
      ${showActions ? `
        <div class="activity-actions">
          <button class="small-button ${activity.completed ? "muted-button" : ""}" data-complete="${id}">
            ${activity.completed ? "Reabrir" : "Completar"}
          </button>
          <button class="small-button edit-button" data-edit="${id}">Editar</button>
          <button class="small-button delete-button" data-delete="${id}">Eliminar</button>
        </div>` : ""}
    </article>`;
}

function renderSubjects() {
  const container = document.getElementById("subjectsGrid");
  if (!container) return;
  container.innerHTML = subjects.map(subject => {
    const subjectActivities = activities.filter(item => item.subjectId === subject.id);
    const pending = subjectActivities.filter(item => !item.completed).length;
    return `
      <button class="subject-card ${escapeHTML(subject.color)}" data-subject="${subject.id}">
        <span class="subject-icon">${escapeHTML(subject.icon)}</span>
        <span class="subject-card-title">${escapeHTML(subject.name)}</span>
        <span class="subject-description">${escapeHTML(subject.description)}</span>
        <span class="subject-count">${subjectActivities.length} actividades · ${pending} pendientes</span>
        <span class="subject-open">Ver actividades →</span>
      </button>`;
  }).join("");
}

function openSubject(subjectId) {
  selectedSubjectId = subjectId;
  renderSubjectDetail(subjectId);
  showView("subjectDetail");
}

function renderSubjectDetail(subjectId) {
  const container = document.getElementById("subjectDetail");
  const subject = subjects.find(item => item.id === subjectId);
  if (!container || !subject) return;

  const related = activities
    .filter(item => item.subjectId === subjectId)
    .sort((a, b) => new Date(a.due) - new Date(b.due));

  container.innerHTML = `
    <div class="subject-detail-header ${escapeHTML(subject.color)}">
      <span class="subject-icon large">${escapeHTML(subject.icon)}</span>
      <div><p class="eyebrow">DETALLE DE LA MATERIA</p><h2>${escapeHTML(subject.name)}</h2>
      <p>${escapeHTML(subject.description)}</p></div>
    </div>
    <div class="section-toolbar subject-toolbar">
      <div><h2>Actividades asociadas</h2><p>${related.length} actividad(es) registrada(s) en esta materia.</p></div>
      <button class="primary-button" id="addForSubject">＋ Agregar actividad</button>
    </div>
    <div class="full-activity-list">
      ${related.length ? related.map(item => activityCard(item, true)).join("") : '<p class="empty-state">Todavía no hay actividades asociadas a esta materia.</p>'}
    </div>`;

  document.getElementById("addForSubject")?.addEventListener("click", () => {
    if (editingId) resetForm();
    showView("dashboard");
    const select = document.getElementById("activitySubject");
    if (select) select.value = String(subjectId);
    document.getElementById("activityForm")?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("activityTitle")?.focus({ preventScroll: true });
  });
}

function showView(viewName) {
  const viewIds = {
    dashboard: "dashboardView",
    activities: "activitiesView",
    subjects: "subjectsView",
    subjectDetail: "subjectDetailView"
  };
  if (!viewIds[viewName]) viewName = "dashboard";
  if (viewName !== "subjectDetail") selectedSubjectId = null;

  document.querySelectorAll(".view").forEach(view => view.classList.remove("active"));
  document.getElementById(viewIds[viewName])?.classList.add("active");

  // En el detalle de una materia se mantiene resaltado "Materias".
  const navView = viewName === "subjectDetail" ? "subjects" : viewName;
  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.view === navView);
  });

  const subjectName = subjects.find(item => item.id === selectedSubjectId)?.name;
  const titles = {
    dashboard: ["Panel principal", "Consulta tus pendientes y organiza tus próximas entregas."],
    activities: ["Todas las actividades", "Administra tus tareas, evaluaciones y proyectos."],
    subjects: ["Mis materias", "Selecciona una materia para consultar sus actividades asociadas."],
    subjectDetail: [subjectName || "Detalle de materia", "Consulta las actividades asociadas a esta materia."]
  };
  setText("pageTitle", titles[viewName][0]);
  setText("pageSubtitle", titles[viewName][1]);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function logout() {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  window.location.href = "login.html";
}

// ---------- Utilidades ----------

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no válida";
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  }).format(date);
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

// Evita que texto introducido por el usuario se interprete como HTML.
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}
