<<<<<<< HEAD
let token = null;

const API = "https://oxymeter-server.onrender.com";

const authDiv = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const output = document.getElementById("output");
const userEmailSpan = document.getElementById("userEmail");

document.getElementById("registerBtn").onclick = async () => {
  const email = regEmail.value;
  const password = regPass.value;

  const r = await fetch(API + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  alert(r.ok ? "Registrácia OK" : "Chyba registrácie");
};

document.getElementById("loginBtn").onclick = async () => {
  const email = loginEmail.value;
  const password = loginPass.value;

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
};

document.getElementById("loadDataBtn").onclick = async () => {
  output.innerHTML = "";

  const r = await fetch(API + "/api/my-data", {
    headers: { Authorization: "Bearer " + token }
  });

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
};
=======
let token = null;

const API = "https://oxymeter-server.onrender.com";

const authDiv = document.getElementById("auth");
const dashboard = document.getElementById("dashboard");
const output = document.getElementById("output");
const userEmailSpan = document.getElementById("userEmail");

document.getElementById("registerBtn").onclick = async () => {
  const email = regEmail.value;
  const password = regPass.value;

  const r = await fetch(API + "/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  alert(r.ok ? "Registrácia OK" : "Chyba registrácie");
};

document.getElementById("loginBtn").onclick = async () => {
  const email = loginEmail.value;
  const password = loginPass.value;

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
};

document.getElementById("loadDataBtn").onclick = async () => {
  output.innerHTML = "";

  const r = await fetch(API + "/api/my-data", {
    headers: { Authorization: "Bearer " + token }
  });

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
};
>>>>>>> fc96bb42f7cb9a1764aebc6dccd6b5853623bfb7
