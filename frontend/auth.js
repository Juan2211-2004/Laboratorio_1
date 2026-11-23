// Inicio de sesión de AcademicHub contra la API (/api/auth/login).
// Las credenciales se validan en el servidor; aquí solo se guarda el token de sesión.
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return;

  const emailInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");
  const errorMessage = document.getElementById("loginError");
  const submitButton = form.querySelector("button[type='submit']");

  // Si ya hay una sesión abierta, ir directo al panel.
  if (sessionStorage.getItem("tokenAcademicHub")) {
    window.location.replace("index.html");
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorMessage.textContent = "";
    submitButton.disabled = true;
    submitButton.textContent = "Ingresando...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailInput.value.trim().toLowerCase(),
          password: passwordInput.value
        })
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "No se pudo iniciar sesión.");
      }

      sessionStorage.setItem("tokenAcademicHub", data.token);
      sessionStorage.setItem("usuarioAcademicHub", data.user.email);
      window.location.href = "index.html";
    } catch (error) {
      // TypeError = no hubo respuesta del servidor (backend apagado o sin red).
      errorMessage.textContent = error instanceof TypeError
        ? "No hay conexión con el servidor. Intenta de nuevo."
        : error.message;
      passwordInput.value = "";
      passwordInput.focus();
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "Iniciar sesión";
    }
  });
});
