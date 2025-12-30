let token = null;
const API = "https://oxymeter-server.onrender.com";

const authDiv = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const output = document.getElementById("output");
const userEmailSpan = document.getElementById("userEmail");

// =======================
// Registrácia
// =======================
document.getElementById("registerBtn").onclick = async () => {
  const email = regEmail.value.trim();
  const password = regPass.value.trim();
  if (!email || !password) return alert("Vyplň všetky polia");

  try {
    const res = await fetch(`${API}/api/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const text = await res.text();
      return alert(text);
    }

    alert("Registrácia úspešná. Teraz sa môžeš prihlásiť.");
  } catch (err) {
    console.error("Chyba pri registrácii:", err);
    alert("Chyba pri registrácii");
  }
};

// =======================
// Prihlásenie
// =======================
document.getElementById("loginBtn").onclick = async () => {
  const email = loginEmail.value.trim();
  const password = loginPass.value.trim();
  if (!email || !password) return alert("Vyplň všetky polia");

  try {
    const res = await fetch(`${API}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    if (!res.ok) {
      const text = await res.text();
      return alert(text);
    }

    const data = await res.json();
    token = data.token;

    userEmailSpan.textContent = email;
    authDiv.style.display = "none";
    dashboard.style.display = "block";
  } catch (err) {
    console.error("Chyba pri prihlasovaní:", err);
    alert("Chyba pri prihlasovaní");
  }
};

// =======================
// Načítanie dát používateľa
// =======================
document.getElementById("loadDataBtn").onclick = async () => {
  output.innerHTML = "";

  try {
    const res = await fetch(`${API}/api/my-data`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      const text = await res.text();
      return alert(text);
    }

    const data = await res.json();

    if (data.length === 0) {
      output.innerHTML = "<p>Žiadne merania</p>";
      return;
    }

    // Funkcia na opravu času
    function fixTime(datetimeString) {
      const iso = datetimeString.replace(" ", "T") + "Z";
      return new Date(iso).toLocaleString("sk-SK", {
        timeZone: "Europe/Bratislava",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    }

    // Vykreslenie meraní
    data.forEach(m => {
      const formattedTime = fixTime(m.created_at);

      const div = document.createElement("div");
      div.className = "measurement";
      div.innerHTML = `
        <div class="values">
          ❤️ <b>${m.bpm}</b> BPM<br>
          🫁 <b>${m.spo2}</b> %
        </div>
        <div class="time">
          💡 LED ${m.led}<br>
          ⏱ ${formattedTime}
        </div>
      `;
      output.appendChild(div);
    });

  } catch (err) {
    console.error("Chyba pri načítaní dát:", err);
    alert("Chyba pri načítaní dát");
  }
};

// =======================
// Reset hesla
// =======================
// =======================
// Reset hesla
// =======================
document.getElementById("resetBtn").onclick = async () => {
  const email = prompt("Zadaj svoj email pre reset hesla:");
  if (!email) return;

  try {
    const res = await fetch(`${API}/api/forgot-password`, { // <-- tu je zmena
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() })
    });

    if (!res.ok) {
      const text = await res.text();
      return alert(text);
    }

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

