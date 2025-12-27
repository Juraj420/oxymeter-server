let token = null;
const API = "https://oxymeter-server.onrender.com";

const authDiv = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const output = document.getElementById("output");
const userEmailSpan = document.getElementById("userEmail");

// Registrácia
document.getElementById("registerBtn").onclick = async () => {
  const email = regEmail.value;
  const password = regPass.value;

  if (!email || !password) return alert("Vyplň všetky polia");

  try {
    const r = await fetch(API + "/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    alert(r.ok ? "Registrácia OK" : "Chyba registrácie");
  } catch (err) {
    console.error(err);
    alert("Chyba pri registrácii");
  }
};

// Prihlásenie
document.getElementById("loginBtn").onclick = async () => {
  const email = loginEmail.value;
  const password = loginPass.value;

  if (!email || !password) return alert("Vyplň všetky polia");

  try {
    const r = await fetch(API + "/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!r.ok) return alert("Zlé údaje");

    const data = await r.json();
    token = data.token;

    userEmailSpan.textContent = email;
    authDiv.style.display = "none";
    dashboard.style.display = "block";

  } catch (err) {
    console.error(err);
    alert("Chyba pri prihlasovaní");
  }
};

// Načítanie dát používateľa
document.getElementById("loadDataBtn").onclick = async () => {
  output.innerHTML = "";

  try {
    const r = await fetch(API + "/api/my-data", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!r.ok) return alert("Chyba pri načítaní dát");

    const data = await r.json();

    data.forEach(m => {
      const div = document.createElement("div");
      div.className = "measurement";

      div.innerHTML = `
        <div class="values">
          ❤️ <b>${m.bpm}</b> BPM<br>
          🫁 <b>${m.spo2}</b> %
        </div>
        <div class="time">
          💡 LED ${m.led}<br>
          ⏱ ${new Date(m.created_at).toLocaleString("sk-SK")}
        </div>
      `;

      output.appendChild(div);
    });

  } catch (err) {
    console.error(err);
    alert("Chyba pri načítaní dát");
  }
};

/* 🔥 RESET HESLA – pridané */
document.getElementById("resetBtn").onclick = async () => {
  // Používateľ zadá email cez prompt
  const email = prompt("Zadaj svoj email pre reset hesla:");
  if (!email) return;

  try {
    const r = await fetch(API + "/api/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const text = await r.text();
    alert(text);

  } catch (err) {
    console.error(err);
    alert("Chyba pri žiadosti o reset hesla");
  }
};
