let token = null;
const API = "https://oxymeter-server.onrender.com";

const authDiv = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const output = document.getElementById("output");
const userEmailSpan = document.getElementById("userEmail");

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function isValidPassword(password) {
  return password.length >= 8;
}

function getPasswordStrength(password) {
  if (password.length === 0) return "";
  if (password.length < 8) return { text: "Príliš krátke", color: "#e74c3c" };
  
  let strength = 0;
  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[^a-zA-Z\d]/.test(password)) strength++;

  if (strength <= 2) return { text: "Slabé", color: "#e67e22" };
  if (strength <= 3) return { text: "Stredné", color: "#f39c12" };
  return { text: "Silné", color: "#27ae60" };
}

function showError(inputId, message) {
  const errorSpan = document.getElementById(`${inputId}Error`);
  const input = document.getElementById(inputId);
  if (errorSpan) {
    errorSpan.textContent = message;
    errorSpan.style.display = message ? "block" : "none";
  }
  if (input) {
    input.style.borderColor = message ? "#e74c3c" : "";
  }
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach(el => {
    el.textContent = "";
    el.style.display = "none";
  });
  document.querySelectorAll("input").forEach(input => {
    input.style.borderColor = "";
  });
}

function setButtonLoading(buttonId, isLoading) {
  const button = document.getElementById(buttonId);
  if (!button) return;
  const textSpan = button.querySelector(".btn-text");
  const spinnerSpan = button.querySelector(".btn-spinner");
  if (isLoading) {
    button.disabled = true;
    if (textSpan) textSpan.style.display = "none";
    if (spinnerSpan) spinnerSpan.style.display = "inline";
  } else {
    button.disabled = false;
    if (textSpan) textSpan.style.display = "inline";
    if (spinnerSpan) spinnerSpan.style.display = "none";
  }
}

// Kontrola či má používateľ zariadenie
async function checkUserDevice() {
  const deviceSection = document.getElementById("deviceSection");
  const measurementsSection = document.querySelector(".measurements-section");

  try {
    const res = await fetch(`${API}/api/my-devices`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.hasDevice) {
      deviceSection.style.display = "none";
      measurementsSection.style.display = "block";
    } else {
      deviceSection.style.display = "block";
      measurementsSection.style.display = "none";
    }
  } catch (err) {
    console.error("Chyba pri kontrole zariadenia:", err);
  }
}

// Prepínanie medzi registráciou a prihlásením
const showLoginBtn = document.getElementById("showLogin");
if (showLoginBtn) {
  showLoginBtn.onclick = (e) => {
    e.preventDefault();
    clearErrors();
    document.getElementById("registerSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
  };
}

const showRegisterBtn = document.getElementById("showRegister");
if (showRegisterBtn) {
  showRegisterBtn.onclick = (e) => {
    e.preventDefault();
    clearErrors();
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("registerSection").style.display = "block";
  };
}

// Zobrazenie/skrytie hesla
document.querySelectorAll(".toggle-password").forEach(button => {
  button.onclick = () => {
    const targetId = button.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const icon = button.querySelector(".eye-icon");
    if (input && icon) {
      if (input.type === "password") {
        input.type = "text";
        icon.style.textDecoration = "line-through";
        button.classList.add("active");
      } else {
        input.type = "password";
        icon.style.textDecoration = "none";
        button.classList.remove("active");
      }
    }
  };
});

// Indikátor sily hesla
const regPassInput = document.getElementById("regPass");
if (regPassInput) {
  regPassInput.oninput = (e) => {
    const password = e.target.value;
    const strengthDiv = document.getElementById("regPassStrength");
    if (!strengthDiv) return;
    if (password.length === 0) {
      strengthDiv.textContent = "";
      strengthDiv.style.display = "none";
      return;
    }
    const strength = getPasswordStrength(password);
    strengthDiv.textContent = `Sila hesla: ${strength.text}`;
    strengthDiv.style.color = strength.color;
    strengthDiv.style.display = "block";
  };
}

// Registrácia
const registerBtn = document.getElementById("registerBtn");
if (registerBtn) {
  registerBtn.onclick = async () => {
    clearErrors();
    const email = document.getElementById("regEmail").value.trim();
    const password = document.getElementById("regPass").value.trim();
    const passwordConfirm = document.getElementById("regPassConfirm").value.trim();
    let hasError = false;

    if (!email) { showError("regEmail", "Email je povinný"); hasError = true; }
    else if (!isValidEmail(email)) { showError("regEmail", "Neplatný formát emailu"); hasError = true; }

    if (!password) { showError("regPass", "Heslo je povinné"); hasError = true; }
    else if (!isValidPassword(password)) { showError("regPass", "Heslo musí mať minimálne 8 znakov"); hasError = true; }

    if (!passwordConfirm) { showError("regPassConfirm", "Zopakujte heslo"); hasError = true; }
    else if (password !== passwordConfirm) { showError("regPassConfirm", "Heslá sa nezhodujú"); hasError = true; }

    if (hasError) return;
    setButtonLoading("registerBtn", true);

    try {
      const res = await fetch(`${API}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) { const text = await res.text(); showError("regEmail", text); return; }
      alert("Registrácia úspešná! Teraz sa môžete prihlásiť.");
      document.getElementById("registerSection").style.display = "none";
      document.getElementById("loginSection").style.display = "block";
      document.getElementById("loginEmail").value = email;
      document.getElementById("regEmail").value = "";
      document.getElementById("regPass").value = "";
      document.getElementById("regPassConfirm").value = "";
      const strengthDiv = document.getElementById("regPassStrength");
      if (strengthDiv) strengthDiv.style.display = "none";
    } catch (err) {
      console.error("Chyba pri registrácii:", err);
      showError("regEmail", "Chyba pri registrácii. Skúste znova.");
    } finally {
      setButtonLoading("registerBtn", false);
    }
  };
}

// Prihlásenie
const loginBtn = document.getElementById("loginBtn");
if (loginBtn) {
  loginBtn.onclick = async () => {
    clearErrors();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPass").value.trim();
    let hasError = false;

    if (!email) { showError("loginEmail", "Email je povinný"); hasError = true; }
    else if (!isValidEmail(email)) { showError("loginEmail", "Neplatný formát emailu"); hasError = true; }
    if (!password) { showError("loginPass", "Heslo je povinné"); hasError = true; }
    if (hasError) return;

    setButtonLoading("loginBtn", true);

    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) { const text = await res.text(); showError("loginPass", text); return; }
      const data = await res.json();
      token = data.token;
      userEmailSpan.textContent = email;
      authDiv.style.display = "none";
      dashboard.style.display = "block";
      checkUserDevice(); // Skontroluj či má zariadenie
    } catch (err) {
      console.error("Chyba pri prihlasovaní:", err);
      showError("loginPass", "Chyba pri prihlasovaní. Skúste znova.");
    } finally {
      setButtonLoading("loginBtn", false);
    }
  };
}

// Odhlásenie
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.onclick = () => {
    token = null;
    authDiv.style.display = "block";
    dashboard.style.display = "none";
    output.innerHTML = "";
    document.getElementById("loginEmail").value = "";
    document.getElementById("loginPass").value = "";
    clearErrors();
    const deviceUidInput = document.getElementById("deviceUid");
    const deviceMsg = document.getElementById("deviceMsg");
    if (deviceUidInput) deviceUidInput.value = "";
    if (deviceMsg) { deviceMsg.textContent = ""; deviceMsg.style.color = ""; }
  };
}

// Načítanie meraní
const loadDataBtn = document.getElementById("loadDataBtn");
if (loadDataBtn) {
  loadDataBtn.onclick = async () => {
    output.innerHTML = "<p>Načítavam...</p>";
    try {
      const res = await fetch(`${API}/api/my-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) { const text = await res.text(); output.innerHTML = `<p style="color:#e74c3c;">❌ ${text}</p>`; return; }
      const data = await res.json();
      if (data.length === 0) { output.innerHTML = "<p>Žiadne merania</p>"; return; }

      function fixTime(datetimeString) {
        if (!datetimeString) return "Neznámy čas";
        if (typeof datetimeString === "string" && datetimeString.includes(" ")) {
          datetimeString = datetimeString.replace(" ", "T");
        }
        const date = new Date(datetimeString);
        if (isNaN(date.getTime())) return "Neplatný dátum";
        return date.toLocaleString("sk-SK", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
      }

      output.innerHTML = "";
      data.forEach(m => {
        const div = document.createElement("div");
        div.className = "measurement";
        div.innerHTML = `
          <div class="values">❤️ <b>${m.bpm}</b> BPM<br>🫁 <b>${m.spo2}</b> %</div>
          <div class="time">⏱ ${fixTime(m.created_at)}</div>
        `;
        output.appendChild(div);
      });
    } catch (err) {
      console.error("Chyba pri načítaní dát:", err);
      output.innerHTML = `<p style="color:#e74c3c;">❌ Chyba pri načítaní dát</p>`;
    }
  };
}

// Pridanie ESP zariadenia
const assignDeviceBtn = document.getElementById("assignDeviceBtn");
if (assignDeviceBtn) {
  assignDeviceBtn.onclick = async () => {
    const device_uid = document.getElementById("deviceUid").value.trim();
    const deviceMsg = document.getElementById("deviceMsg");
    deviceMsg.textContent = "";
    showError("deviceUid", "");

    if (!device_uid) { showError("deviceUid", "Zadaj Device UID zariadenia"); return; }

    setButtonLoading("assignDeviceBtn", true);

    try {
      const res = await fetch(`${API}/api/assign-device`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ device_uid })
      });
      const data = await res.json();

      if (res.ok) {
        deviceMsg.textContent = "Zariadenie úspešne priradené k vášmu účtu!";
        deviceMsg.style.color = "#27ae60";
        document.getElementById("deviceUid").value = "";
        // Po 1.5 sekundách skry pridávanie a zobraz merania
        setTimeout(() => {
          document.getElementById("deviceSection").style.display = "none";
          document.querySelector(".measurements-section").style.display = "block";
        }, 1500);
      } else {
        deviceMsg.textContent = "❌ " + (data.message || "Nastala chyba");
        deviceMsg.style.color = "#e74c3c";
      }
    } catch (err) {
      console.error("Chyba pri priradení zariadenia:", err);
      deviceMsg.textContent = "❌ Chyba pripojenia. Skúste znova.";
      deviceMsg.style.color = "#e74c3c";
    } finally {
      setButtonLoading("assignDeviceBtn", false);
    }
  };
}

// Reset hesla
const resetBtn = document.getElementById("resetBtn");
if (resetBtn) {
  resetBtn.onclick = async () => {
    const email = prompt("Zadaj svoj email pre reset hesla:");
    if (!email) return;
    if (!isValidEmail(email.trim())) { alert("Neplatný formát emailu"); return; }
    try {
      const res = await fetch(`${API}/api/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() })
      });
      if (!res.ok) { const text = await res.text(); alert(`${text}`); return; }
      const data = await res.json();
      if (data.success) {
        alert("Link na reset hesla bol odoslaný.");
        if (data.link) window.open(data.link, "_blank");
      } else {
        alert("Nepodarilo sa vygenerovať reset link.");
      }
    } catch (err) {
      console.error("Chyba pri žiadosti o reset hesla:", err);
      alert("Chyba pri žiadosti o reset hesla");
    }
  };
}

// Reset hesla stránka
function showErrorReset(message) {
  const errorSpan = document.getElementById("passwordError");
  const input = document.getElementById("newPass");
  if (errorSpan && input) {
    errorSpan.textContent = message;
    errorSpan.style.display = "block";
    input.classList.add("error");
    setTimeout(() => { errorSpan.style.display = "none"; input.classList.remove("error"); }, 3000);
  }
}

const submitResetBtn = document.getElementById("submitBtn");
if (submitResetBtn && document.getElementById("newPass")) {
  submitResetBtn.onclick = async function() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    const newPassword = document.getElementById("newPass").value;
    const input = document.getElementById("newPass");
    input.classList.remove("error");
    const errorSpan = document.getElementById("passwordError");
    if (errorSpan) errorSpan.style.display = "none";
    if (!newPassword) { showErrorReset("Zadajte nové heslo"); return; }
    if (newPassword.length < 8) { showErrorReset("Heslo musí obsahovať aspoň 8 znakov"); return; }
    submitResetBtn.disabled = true;
    submitResetBtn.textContent = "Prebieha zmena...";
    try {
      const res = await fetch(`${API}/api/set-new-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        window.location.href = "/";
      } else {
        showErrorReset(data.message || "Nastala chyba pri zmene hesla");
        submitResetBtn.disabled = false;
        submitResetBtn.textContent = "Zmeniť heslo";
      }
    } catch (error) {
      showErrorReset("Nastala chyba. Skúste to prosím znova.");
      submitResetBtn.disabled = false;
      submitResetBtn.textContent = "Zmeniť heslo";
    }
  };
}

const newPassInput = document.getElementById("newPass");
if (newPassInput) {
  newPassInput.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
      const submitBtn = document.getElementById("submitBtn");
      if (submitBtn) submitBtn.click();
    }
  });
}
