let token = null;                    // Premenná pre uloženie JWT tokenu po prihlásení (null = neprihlásený)
const API = "https://oxymeter-server.onrender.com"; // URL adresa API servera

const authDiv = document.getElementById("auth");      // Získanie elementu s prihlasovacím/registračným formulárom
const dashboard = document.getElementById("dashboard");  // Získanie elementu s dashboardom (hlavnou stránkou po prihlásení)
const output = document.getElementById("output");     // Získanie elementu kde sa zobrazia namerané dáta
const userEmailSpan = document.getElementById("userEmail");  // Získanie elementu pre zobrazenie emailu používateľa

// Helper funkcie
function isValidEmail(email) {       // Funkcia pre validáciu emailovej adresy
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;  // Regulárny výraz pre kontrolu formátu emailu
  return regex.test(email);          // Vráti true ak email zodpovedá formátu, inak false
}


function isValidPassword(password) { // Funkcia pre validáciu hesla
  return password.length >= 8;       // Vráti true ak heslo má aspoň 8 znakov
}

function getPasswordStrength(password) {  // Funkcia pre zistenie sily hesla
  if (password.length === 0) return "";   // Ak je heslo prázdne, vráť prázdny string
  if (password.length < 8) return { text: "Príliš krátke", color: "#e74c3c" };  // Ak má menej ako 8 znakov, vráť "Príliš krátke" s červenou farbou
  
  let strength = 0;                  // Inicializácia počítadla sily hesla
  if (password.length >= 8) strength++;   // +1 bod za minimálne 8 znakov
  if (password.length >= 12) strength++;  // +1 bod za minimálne 12 znakov
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;  // +1 bod za kombináciu malých a veľkých písmen
  if (/\d/.test(password)) strength++;    // +1 bod za prítomnosť číslic
  if (/[^a-zA-Z\d]/.test(password)) strength++;  // +1 bod za špeciálne znaky

  if (strength <= 2) return { text: "Slabé", color: "#e67e22" };     // 0-2 body = Slabé (oranžová)
  if (strength <= 3) return { text: "Stredné", color: "#f39c12" };   // 3 body = Stredné (žltá)
  return { text: "Silné", color: "#27ae60" };  // 4-5 bodov = Silné (zelená)
}

function showError(inputId, message) {   // Funkcia pre zobrazenie chybovej hlášky pri inpute
  const errorSpan = document.getElementById(`${inputId}Error`);  // Získanie elementu pre chybovú hlášku
  const input = document.getElementById(inputId);  // Získanie samotného input elementu
  if (errorSpan) {                   // Ak existuje element pre chybu
    errorSpan.textContent = message; // Nastav text chyby
    errorSpan.style.display = message ? "block" : "none";  // Zobraz ak je message, skry ak je prázdne
  }
  if (input) {                       // Ak existuje input element
    input.style.borderColor = message ? "#e74c3c" : "";  // Nastav červený border ak je chyba, inak vráť na pôvodný
  }
}

function clearErrors() {             // Funkcia pre vymazanie všetkých chybových hlášok
  document.querySelectorAll(".error-message").forEach(el => {  // Prejdi všetky elementy s triedou "error-message"
    el.textContent = "";             // Vymaž text chyby
    el.style.display = "none";       // Skry element
  });
  document.querySelectorAll("input").forEach(input => {  // Prejdi všetky input elementy
    input.style.borderColor = "";    // Vráť border na pôvodný stav
  });
}

function setButtonLoading(buttonId, isLoading) {  // Funkcia pre zobrazenie loading stavu tlačidla
  const button = document.getElementById(buttonId);  // Získanie tlačidla podľa ID
  if (!button) return;               // Ak tlačidlo neexistuje, ukonči funkciu
  
  const textSpan = button.querySelector(".btn-text");     // Získanie elementu s textom tlačidla
  const spinnerSpan = button.querySelector(".btn-spinner");  // Získanie elementu so spinnerom (načítavacia animácia)
  
  if (isLoading) {                   // Ak je loading aktívny
    button.disabled = true;          // Deaktivuj tlačidlo (nedá sa kliknúť)
    if (textSpan) textSpan.style.display = "none";      // Skry text
    if (spinnerSpan) spinnerSpan.style.display = "inline";  // Zobraz spinner
  } else {                           // Ak loading nie je aktívny
    button.disabled = false;         // Aktivuj tlačidlo
    if (textSpan) textSpan.style.display = "inline";    // Zobraz text
    if (spinnerSpan) spinnerSpan.style.display = "none";  // Skry spinner
  }
}

// Prepínanie medzi registráciou a prihlásením
const showLoginBtn = document.getElementById("showLogin");  // Získanie tlačidla "Už máte účet?"
if (showLoginBtn) {                  // Ak tlačidlo existuje
  showLoginBtn.onclick = (e) => {    // Pri kliknutí na tlačidlo
    e.preventDefault();              // Zruš predvolené správanie (napr. odoslanie formulára)
    clearErrors();                   // Vymaž všetky chyby
    document.getElementById("registerSection").style.display = "none";  // Skry registračný formulár
    document.getElementById("loginSection").style.display = "block";    // Zobraz prihlasovaciu sekciu
  };
}

const showRegisterBtn = document.getElementById("showRegister");  // Získanie tlačidla "Nemáte účet?"
if (showRegisterBtn) {               // Ak tlačidlo existuje
  showRegisterBtn.onclick = (e) => { // Pri kliknutí na tlačidlo
    e.preventDefault();              // Zruš predvolené správanie
    clearErrors();                   // Vymaž všetky chyby
    document.getElementById("loginSection").style.display = "none";     // Skry prihlasovaciu sekciu
    document.getElementById("registerSection").style.display = "block";  // Zobraz registračný formulár
  };
}

// Zobrazenie/skrytie hesla
document.querySelectorAll(".toggle-password").forEach(button => {  // Pre každé tlačidlo s triedou "toggle-password" (oko na zobrazenie hesla)
  button.onclick = () => {           // Pri kliknutí na tlačidlo
    const targetId = button.getAttribute("data-target");  // Získaj ID inputu ktorý má prepnúť
    const input = document.getElementById(targetId);      // Získaj samotný input element
    const icon = button.querySelector(".eye-icon");       // Získaj ikonu oka
    
    if (input && icon) {             // Ak existujú oba elementy
      if (input.type === "password") {  // Ak je input typu "password" (skryté heslo)
        input.type = "text";         // Zmeň na "text" (viditeľné heslo)
        icon.style.textDecoration = "line-through";  // Prečiarkni ikonu oka
        button.classList.add("active");  // Pridaj triedu "active" k tlačidlu
      } else {                       // Ak je input typu "text" (viditeľné heslo)
        input.type = "password";     // Zmeň na "password" (skryté heslo)
        icon.style.textDecoration = "none";  // Odstráň prečiarknutie
        button.classList.remove("active");   // Odstráň triedu "active"
      }
    }
  };
});

// Indikátor sily hesla pri registrácii
const regPassInput = document.getElementById("regPass");  // Získanie input poľa pre heslo pri registrácii
if (regPassInput) {                  // Ak existuje
  regPassInput.oninput = (e) => {    // Pri každej zmene v inpute (každé napísané písmeno)
    const password = e.target.value; // Získaj aktuálnu hodnotu hesla
    const strengthDiv = document.getElementById("regPassStrength");  // Získaj element pre zobrazenie sily hesla
    
    if (!strengthDiv) return;        // Ak element neexistuje, ukonči funkciu
    
    if (password.length === 0) {     // Ak je heslo prázdne
      strengthDiv.textContent = "";  // Vymaž text indikátora
      strengthDiv.style.display = "none";  // Skry indikátor
      return;                        // Ukonči funkciu
    }
    
    const strength = getPasswordStrength(password);  // Zisti silu hesla
    strengthDiv.textContent = `Sila hesla: ${strength.text}`;  // Zobraz text sily hesla
    strengthDiv.style.color = strength.color;  // Nastav farbu podľa sily
    strengthDiv.style.display = "block";       // Zobraz indikátor
  };
}

// Registrácia
const registerBtn = document.getElementById("registerBtn");  // Získanie tlačidla "Zaregistrovať sa"
if (registerBtn) {                   // Ak tlačidlo existuje
  registerBtn.onclick = async () => {  // Pri kliknutí na tlačidlo (async = môže čakať na fetch)
    clearErrors();                   // Vymaž všetky predošlé chyby
    
    const email = document.getElementById("regEmail").value.trim();  // Získaj email a odstráň medzery na začiatku/konci
    const password = document.getElementById("regPass").value.trim();  // Získaj heslo
    const passwordConfirm = document.getElementById("regPassConfirm").value.trim();  // Získaj potvrdenie hesla
    
    
    let hasError = false;            // Flag pre sledovanie či nastala chyba
    
    if (!email) {                    // Ak je email prázdny
      showError("regEmail", "Email je povinný");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    } else if (!isValidEmail(email)) {  // Ak email nie je platný
      showError("regEmail", "Neplatný formát emailu");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    }

    if (!password) {                 // Ak je heslo prázdne
      showError("regPass", "Heslo je povinné");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    } else if (!isValidPassword(password)) {  // Ak heslo nemá minimálne 8 znakov
      showError("regPass", "Heslo musí mať minimálne 8 znakov");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    }

   if (!passwordConfirm) {          // Ak je potvrdenie hesla prázdne
      showError("regPassConfirm", "Zopakujte heslo");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    } else if (password !== passwordConfirm) {  // Ak sa heslá nezhodujú
      showError("regPassConfirm", "Heslá sa nezhodujú");  // Zobraz chybu
      hasError = true;               // Označ že je chyba
    }
    

    if (hasError) return;            // Ak nastala akákoľvek chyba, ukonči funkciu (neposielaj request)

       setButtonLoading("registerBtn", true);  // Zobraz loading stav tlačidla

   try {                            // Pokus o vykonanie kódu (ak nastane chyba, prejde do catch bloku)
      const res = await fetch(`${API}/api/register`, {  // Odošli POST request na /api/register
        method: "POST",              // Metóda POST
        headers: { "Content-Type": "application/json" },  // Hlavička - posielame JSON
        body: JSON.stringify({ email, password })  // Telo požiadavky - email a heslo v JSON formáte
      });
      
      if (!res.ok) {                 // Ak odpoveď nie je OK (status nie je 200-299)
        const text = await res.text();  // Prečítaj textovú chybovú hlášku zo servera
        showError("regEmail", text); // Zobraz chybu pri emailovom poli
        return;                      // Ukonči funkciu
      }
      
      alert("Registrácia úspešná! Teraz sa môžete prihlásiť.");  // Zobraz úspešnú hlášku
     
     document.getElementById("registerSection").style.display = "none";  // Skry registračný formulár
      document.getElementById("loginSection").style.display = "block";    // Zobraz prihlasovaciu sekciu
      document.getElementById("loginEmail").value = email;  // Predvyplň email v prihlasovacom formulári
      
      // Vymaž registračný formulár
      document.getElementById("regEmail").value = "";       // Vymaž email
      document.getElementById("regPass").value = "";        // Vymaž heslo
      document.getElementById("regPassConfirm").value = ""; // Vymaž potvrdenie hesla
      const strengthDiv = document.getElementById("regPassStrength");  // Získaj element sily hesla
      if (strengthDiv) strengthDiv.style.display = "none";  // Skry indikátor sily hesla
     
    } catch (err) {                  // Ak nastala chyba pri requeste (napr. server neodpovedá)
      console.error("Chyba pri registrácii:", err);  // Vypíš chybu do konzoly
      showError("regEmail", "Chyba pri registrácii. Skúste znova.");  // Zobraz všeobecnú chybu
    } finally {                      // Tento blok sa vykoná vždy (aj pri úspechu, aj pri chybe)
      setButtonLoading("registerBtn", false);  // Zruš loading stav tlačidla
    }
  };
}

// Prihlásenie
const loginBtn = document.getElementById("loginBtn");  // Získanie tlačidla "Prihlásiť sa"
if (loginBtn) {                      // Ak tlačidlo existuje
  loginBtn.onclick = async () => {   // Pri kliknutí na tlačidlo
    clearErrors();                   // Vymaž všetky predošlé chyby
    
    const email = document.getElementById("loginEmail").value.trim();  // Získaj email
    const password = document.getElementById("loginPass").value.trim();  // Získaj heslo
    
    let hasError = false;            // Flag pre sledovanie chýb
    
    if (!email) {                    // Ak je email prázdny
      showError("loginEmail", "Email je povinný");  // Zobraz chybu
      hasError = true;               // Označ chybu
    } else if (!isValidEmail(email)) {  // Ak email nie je platný
      showError("loginEmail", "Neplatný formát emailu");  // Zobraz chybu
      hasError = true;               // Označ chybu
    }

   if (!password) {                 // Ak je heslo prázdne
      showError("loginPass", "Heslo je povinné");  // Zobraz chybu
      hasError = true;               // Označ chybu
    }
    
    if (hasError) return;            // Ak je chyba, ukonči funkciu
    
    setButtonLoading("loginBtn", true);  // Zobraz loading stav
    
    try {                            // Pokus o prihlásenie
      const res = await fetch(`${API}/api/login`, {  // Odošli POST request na /api/login
        method: "POST",              // Metóda POST
        headers: { "Content-Type": "application/json" },  // JSON hlavička
        body: JSON.stringify({ email, password })  // Email a heslo v JSON formáte
      });
      
      if (!res.ok) {                 // Ak prihlásenie zlyhalo
        const text = await res.text();  // Získaj chybovú hlášku
        showError("loginPass", text);   // Zobraz chybu pri hesle
        return;                      // Ukonči funkciu
      }
      
      const data = await res.json(); // Prečítaj JSON odpoveď (obsahuje token)
      token = data.token;            // Ulož JWT token do globálnej premennej
      userEmailSpan.textContent = email;  // Zobraz email používateľa v dashboarde
      
      authDiv.style.display = "none";     // Skry prihlasovaciu/registračnú sekciu
      dashboard.style.display = "block";  // Zobraz dashboard
      
    } catch (err) {                  // Ak nastala chyba
      console.error("Chyba pri prihlasovaní:", err);  // Vypíš do konzoly
      showError("loginPass", "Chyba pri prihlasovaní. Skúste znova.");  // Zobraz chybu
    } finally {                      // Vždy nakoniec
      setButtonLoading("loginBtn", false);  // Zruš loading stav
    }
  };
}

// Odhlásenie
const logoutBtn = document.getElementById("logoutBtn");  // Získanie tlačidla "Odhlásiť sa"
if (logoutBtn) {                     // Ak tlačidlo existuje
  logoutBtn.onclick = () => {        // Pri kliknutí
    token = null;                    // Vymaž token (používateľ nie je prihlásený)
    authDiv.style.display = "block"; // Zobraz prihlasovaciu sekciu
    dashboard.style.display = "none";  // Skry dashboard
    output.innerHTML = "";           // Vymaž všetky namerané dáta z obrazovky
    
    // Vymaž prihlasovací formulár
    document.getElementById("loginEmail").value = "";  // Vymaž email
    document.getElementById("loginPass").value = "";   // Vymaž heslo
    clearErrors();                   // Vymaž všetky chyby
  };
}

// Načítanie dát používateľa
const loadDataBtn = document.getElementById("loadDataBtn");  // Získanie tlačidla "Načítať moje merania"
if (loadDataBtn) {                   // Ak tlačidlo existuje
  loadDataBtn.onclick = async () => {  // Pri kliknutí
    output.innerHTML = "<p>Načítavam...</p>";  // Zobraz načítavaciu hlášku
    
    try {                            // Pokus o načítanie dát
      const res = await fetch(`${API}/api/my-data`, {  // Odošli GET request na /api/my-data
        headers: {                   // Hlavičky requestu
          Authorization: `Bearer ${token}`  // Pridaj JWT token pre autentifikáciu
        }
      });
      
      if (!res.ok) {                 // Ak request zlyhal
        const text = await res.text();  // Získaj chybovú hlášku
        output.innerHTML = `<p style="color: #e74c3c;">❌ ${text}</p>`;  // Zobraz chybu červenou farbou
        return;                      // Ukonči funkciu
      }
      
      const data = await res.json(); // Prečítaj JSON odpoveď (pole meraní)
      
      if (data.length === 0) {       // Ak nie sú žiadne merania
        output.innerHTML = "<p>Žiadne merania</p>";  // Zobraz hlášku
        return;                      // Ukonči funkciu
      }
      
      // Funkcie pre dáta
      function fixTime(datetimeString) {  // Funkcia pre konverziu času zo servera na čitateľný formát
        if (!datetimeString) return "Neznámy čas";  // Ak je čas prázdny
        if (typeof datetimeString === "string" && datetimeString.includes(" ")) {  // Ak obsahuje medzeru namiesto "T"
          datetimeString = datetimeString.replace(" ", "T");  // Nahraď medzeru za "T" (ISO formát)
        }
        const date = new Date(datetimeString);  // Vytvor Date objekt
        if (isNaN(date.getTime())) return "Neplatný dátum";  // Ak je dátum neplatný
        return date.toLocaleString("sk-SK", {  // Vráť dátum v slovenskom formáte
          year: "numeric",           // Rok číslom
          month: "2-digit",          // Mesiac 2 číslicami
          day: "2-digit",            // Deň 2 číslicami
          hour: "2-digit",           // Hodina 2 číslicami
          minute: "2-digit",         // Minúta 2 číslicami
          second: "2-digit"          // Sekunda 2 číslicami
        });
      }
      
      output.innerHTML = "";         // Vymaž načítavaciu hlášku
      
      data.forEach(m => {            // Pre každé meranie v poli
        const formattedTime = fixTime(m.created_at);  // Preformátuj čas
        const div = document.createElement("div");    // Vytvor nový div element
        div.className = "measurement";  // Pridaj triedu "measurement"
        div.innerHTML = `            
          <div class="values">       
            ❤️ <b>${m.bpm}</b> BPM<br>        <!-- Zobraz BPM -->
            🫁 <b>${m.spo2}</b> %              <!-- Zobraz SpO2 -->
          </div>
          <div class="time">
            ⏱ ${formattedTime}                 <!-- Zobraz čas merania -->
          </div>
        `;
        output.appendChild(div);     // Pridaj div do output sekcie (zobrazenie na obrazovke)
      });
      
    } catch (err) {                  // Ak nastala chyba
      console.error("Chyba pri načítaní dát:", err);  // Vypíš do konzoly
      output.innerHTML = `<p style="color: #e74c3c;">❌ Chyba pri načítaní dát</p>`;  // Zobraz chybu
    }
  };
}

// Reset hesla (tlačidlo na prihlasovacej stránke)
const resetBtn = document.getElementById("resetBtn");  // Získanie tlačidla "Zabudli ste heslo?"
if (resetBtn) {                      // Ak tlačidlo existuje
  resetBtn.onclick = async () => {   // Pri kliknutí
    const email = prompt("Zadaj svoj email pre reset hesla:");  // Zobraz dialog pre zadanie emailu
    if (!email) return;              // Ak používateľ zrušil dialog, ukonči funkciu
    
    if (!isValidEmail(email.trim())) {  // Ak email nie je platný
      alert("Neplatný formát emailu");  // Zobraz upozornenie
      return;                        // Ukonči funkciu
    }
    
    try {                            // Pokus o odoslanie resetu hesla
     const res = await fetch(`${API}/api/forgot-password`, {  // POST request na /api/forgot-password
        method: "POST",              // Metóda POST
        headers: { "Content-Type": "application/json" },  // JSON hlavička
        body: JSON.stringify({ email: email.trim() })  // Email v JSON formáte
      });
      
      if (!res.ok) {                 // Ak request zlyhal
        const text = await res.text();  // Získaj chybovú hlášku
        alert(`${text}`);            // Zobraz chybu v alerte
        return;                      // Ukonči funkciu
      }
      
      const data = await res.json(); // Prečítaj JSON odpoveď
      
      if (data.success) {            // Ak bol reset úspešný
        alert("Link na reset hesla bol odoslaný.");  // Zobraz úspešnú hlášku
        if (data.link) window.open(data.link, "_blank");  // Ak server vrátil link, otvor ho v novom okne (pre testovanie)
      } else {                       // Ak reset zlyhal
        alert("Nepodarilo sa vygenerovať reset link.");  // Zobraz chybovú hlášku
      }
      
    } catch (err) {                  // Ak nastala chyba
      console.error("Chyba pri žiadosti o reset hesla:", err);  // Vypíš do konzoly
      alert("Chyba pri žiadosti o reset hesla");  // Zobraz chybu
    }
  };
}

// Reset hesla stránka - funkcie
function showErrorReset(message) {   // Funkcia pre zobrazenie chyby na reset hesla stránke
  const errorSpan = document.getElementById("passwordError");  // Získaj element pre chybu
  const input = document.getElementById("newPass");  // Získaj input pre nové heslo
  
  if (errorSpan && input) {          // Ak oba elementy existujú
    errorSpan.textContent = message; // Nastav chybovú hlášku
    errorSpan.style.display = "block";  // Zobraz chybovú hlášku
    input.classList.add("error");    // Pridaj triedu "error" k inputu (červený border)
    
    setTimeout(() => {               // Po 3 sekundách
      errorSpan.style.display = "none";  // Skry chybovú hlášku
      input.classList.remove("error");   // Odstráň triedu "error"
    }, 3000);                        // 3000ms = 3 sekundy
  }
}

// Tlačidlo pre zmenu hesla
const submitResetBtn = document.getElementById("submitBtn");  // Získanie tlačidla "Zmeniť heslo"
if (submitResetBtn && document.getElementById("newPass")) {  // Ak tlačidlo a input existujú (sme na reset hesla stránke)
  submitResetBtn.onclick = async function() {  // Pri kliknutí
    const urlParams = new URLSearchParams(window.location.search);  // Získaj URL parametre (?token=xxx)
    const token = urlParams.get("token");  // Získaj hodnotu parametra "token"
    const newPassword = document.getElementById("newPass").value;  // Získaj nové heslo z inputu
    const input = document.getElementById("newPass");  // Získaj input element
    
    input.classList.remove("error"); // Odstráň triedu "error" (vymaž predošlé chyby)
    const errorSpan = document.getElementById("passwordError");  // Získaj element pre chyby
    if (errorSpan) errorSpan.style.display = "none";  // Skry chybovú hlášku
    
    if (!newPassword) {              // Ak je heslo prázdne
      showErrorReset("Zadajte nové heslo");  // Zobraz chybu
      return;                        // Ukonči funkciu
    }
    if (newPassword.length < 8) {    // Ak heslo má menej ako 8 znakov
      showErrorReset("Heslo musí obsahovať aspoň 8 znakov");  // Zobraz chybu
      return;                        // Ukonči funkciu
    }
    
    submitResetBtn.disabled = true;  // Deaktivuj tlačidlo (zabráň viacnásobnému kliknutiu)
    submitResetBtn.textContent = "Prebieha zmena...";  // Zmeň text tlačidla
    
    try {                            // Pokus o zmenu hesla
      const res = await fetch(`${API}/api/set-new-password`, {  // POST request na /api/set-new-password
        method: "POST",              // Metóda POST
        headers: { "Content-Type": "application/json" },  // JSON hlavička
        body: JSON.stringify({ token, newPassword })  // Token a nové heslo v JSON formáte
      });
      
      const data = await res.json(); // Prečítaj JSON odpoveď
      
      if (data.success) {            // Ak zmena hesla bola úspešná
        alert(data.message);         // Zobraz úspešnú hlášku
        window.location.href = "/";  // Presmeruj na hlavnú stránku (prihlásenie)
      } else {                       // Ak zmena hesla zlyhala
        showErrorReset(data.message || "Nastala chyba pri zmene hesla");  // Zobraz chybu
        submitResetBtn.disabled = false;  // Aktivuj tlačidlo
        submitResetBtn.textContent = "Zmeniť heslo";  // Vráť pôvodný text tlačidla
      }
      
    } catch (error) {                // Ak nastala chyba pri requeste
      showErrorReset("Nastala chyba. Skúste to prosím znova.");  // Zobraz chybu
      submitResetBtn.disabled = false;  // Aktivuj tlačidlo
      submitResetBtn.textContent = "Zmeniť heslo";  // Vráť pôvodný text
    }
  };
}

// Enter key support pre reset hesla
const newPassInput = document.getElementById("newPass");  // Získanie input poľa pre nové heslo
if (newPassInput) {                  // Ak input existuje (sme na reset hesla stránke)
  newPassInput.addEventListener("keypress", function(event) {  // Pri stlačení klávesy v inpute
    if (event.key === "Enter") {     // Ak bola stlačená klávesa Enter
      const submitBtn = document.getElementById("submitBtn");  // Získaj tlačidlo "Zmeniť heslo"
      if (submitBtn) submitBtn.click();  // Simuluj kliknutie na tlačidlo (odošli formulár)
    }
  });
}
