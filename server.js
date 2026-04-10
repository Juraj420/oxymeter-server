const express = require("express");  // Importovanie Express frameworku pre vytvorenie web servera
require("dotenv").config();          // Načítanie environment premenných z .env súboru (DB_HOST, DB_USER, atď.)
const mysql = require("mysql2");     // Importovanie MySQL knižnice pre prácu s databázou
const cors = require("cors");        // Importovanie CORS middleware pre povolenie requestov z iných domén
const bcrypt = require("bcryptjs");  // Importovanie bcrypt knižnice pre hashovanie hesiel
const jwt = require("jsonwebtoken"); // Importovanie JWT knižnice pre vytváranie a overovanie tokenov
const axios = require("axios");      // Importovanie axios knižnice pre HTTP requesty (volanie Brevo API pre emaily)
const crypto = require("crypto");    // Importovanie crypto modulu pre generovanie náhodných tokenov

const app = express();               // Vytvorenie Express aplikácie
const JWT_SECRET = "tajne_heslo_pre_token";  // Tajný kľúč pre podpisovanie JWT tokenov (používa sa pri prihlásení)

app.use(express.static("public"));   // Nastavenie statického priečinka "public" (odtiaľ sa servírujú HTML, CSS, JS súbory)
app.use(cors());                     // Povolenie CORS - umožňuje requesty z iných domén (napr. z frontendu)
app.use(express.json({ limit: "1mb" }));  // Middleware pre parsovanie JSON requestov s limitom veľkosti 1MB

// MySQL connection pool - automaticky obnovuje spadnuté spojenia
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  waitForConnections: true,  // Čakaj na voľné spojenie ak je pool plný
  connectionLimit: 5,        // Max 5 súčasných spojení (free tier limit)
  queueLimit: 0,             // Neobmedzená fronta čakajúcich requestov
  enableKeepAlive: true,     // Udržiavaj spojenia živé
  keepAliveInitialDelay: 0   // Začni keepalive hneď
});

// Test spojenia pri štarte servera
db.getConnection((err, connection) => {
  if (err) return console.error("MySQL error:", err);
  console.log("MySQL connected");
  connection.release(); // Vrať spojenie späť do poolu
});

// Registrácia
app.post("/api/register", async (req, res) => {  // POST endpoint pre registráciu nového používateľa
  const { email, password } = req.body;  // Extrakcia emailu a hesla z tela requestu
  if (!email || !password) return res.status(400).json({ success: false, message: "Chýbajú údaje" });  // Ak chýba email alebo heslo, vráť chybu 400

  const hash = await bcrypt.hash(password, 10);  // Hashovanie hesla s 10 roundmi (bezpečné uloženie)
  db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash], err => {  // Vloženie nového používateľa do databázy
    if (err) return res.status(400).json({ success: false, message: "Používateľ už existuje" });  // Ak email už existuje (unique constraint), vráť chybu
    res.json({ success: true, message: "Registrácia prebehla úspešne" });  // Ak je registrácia úspešná, vráť success
  });
});

// Prihlásenie
app.post("/api/login", (req, res) => {  // POST endpoint pre prihlásenie používateľa
  const { email, password } = req.body;  // Extrakcia emailu a hesla z requestu

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {  // Vyhľadanie používateľa v databáze podľa emailu
    if (err) return res.status(500).json({ success: false, message: "DB error" });  // Ak nastala databázová chyba, vráť 500
    if (results.length === 0) return res.status(401).json({ success: false, message: "Používateľ nenájdený" });  // Ak používateľ neexistuje, vráť 401

    const user = results[0];           // Získanie prvého (a jediného) výsledku z databázy
    const ok = await bcrypt.compare(password, user.password);  // Porovnanie zadaného hesla s hashovaným heslom v databáze
    if (!ok) return res.status(401).json({ success: false, message: "Zlé heslo" });  // Ak heslo nesedí, vráť chybu 401

    const token = jwt.sign({ id: user.id }, JWT_SECRET);  // Vytvorenie JWT tokenu s ID používateľa
    res.json({ success: true, token });  // Vrátenie tokenu klientovi (používa sa pri ďalších requestoch)
  });
});

// Reset hesla – generovanie tokenu
app.post("/api/forgot-password", async (req, res) => {  // POST endpoint pre žiadosť o reset hesla
  const { email } = req.body;          // Extrakcia emailu z requestu
  if (!email) return res.status(400).json({ success: false, message: "Chýba email" });  // Ak chýba email, vráť chybu

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {  // Vyhľadanie používateľa podľa emailu
    if (err) return res.status(500).json({ success: false, message: "DB error" });  // Databázová chyba
    if (results.length === 0) return res.status(404).json({ success: false, message: "Email nie je registrovaný" });  // Email neexistuje v databáze

    const user = results[0];           // Získanie používateľa
    const token = crypto.randomBytes(32).toString("hex");  // Generovanie náhodného 32-bytového tokenu (64 hex znakov)

    const expires = new Date(Date.now() + 15 * 60 * 1000); // Vytvorenie dátumu expirácie - aktuálny čas + 15 minút (v milisekundách)
    const expiresFormatted = expires.toISOString().slice(0, 19).replace("T", " ");  // Formátovanie dátumu do MySQL formátu (YYYY-MM-DD HH:MM:SS)

    db.query(                          // UPDATE query pre uloženie reset tokenu a expirácie do databázy
      "UPDATE users SET reset_token = ?, reset_token_expires = CONVERT_TZ(?, '+00:00', '+01:00') WHERE id = ?",  // Uloženie tokenu s konverziou času z UTC na CET (stredoeurópsky čas)
      [token, expiresFormatted, user.id],  // Parametre: token, čas expirácie, ID používateľa
      async (err2) => {                // Callback po vykonaní UPDATE
        if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní tokenu" });  // Chyba pri ukladaní

        const resetLink = `https://oxymeter-server.onrender.com/reset-password-form.html?token=${token}`;  // Vytvorenie linku na reset hesla s tokenom v URL

        try {                          // Pokus o odoslanie emailu cez Brevo API
          await axios.post(            // POST request na Brevo API
            "https://api.brevo.com/v3/smtp/email",  // Brevo SMTP endpoint
            {                          // Telo requestu (JSON)
              sender: {                // Odosielateľ emailu
                name: process.env.BREVO_SENDER_NAME,  // Meno odosielateľa (z .env)
                email: process.env.BREVO_SENDER_EMAIL  // Email odosielateľa (z .env)
              },
              to: [{ email }],         // Príjemca emailu (používateľ ktorý požiadal o reset)
              subject: "Obnova hesla – Oxymeter",  // Predmet emailu
              htmlContent: `           
                <h2>Reset hesla</h2>
                <p>Klikni na tento link pre zmenu hesla:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>Platnosť linku: 15 minút</p>
              `
            },
            {                          // Konfigurácia axios requestu
              headers: {               // HTTP hlavičky
                "api-key": process.env.BREVO_API_KEY,  // API kľúč pre Brevo (z .env)
                "Content-Type": "application/json"  // Typ obsahu je JSON
              }
            }
          );

          res.json({ success: true, message: "Link na reset hesla bol odoslaný." });  // Email bol úspešne odoslaný
        } catch (e) {                  // Ak nastala chyba pri odosielaní emailu
          console.error("Brevo API error:", e.response?.data || e.message);  // Vypíš chybu do konzoly
          res.status(500).json({ success: false, message: "Chyba pri odosielaní emailu" });  // Vráť chybu klientovi
        }
      }
    );
  });
});

// Nastavenie nového hesla
app.post("/api/set-new-password", async (req, res) => {  // POST endpoint pre nastavenie nového hesla po resete
  const { token, newPassword } = req.body;  // Extrakcia tokenu a nového hesla z requestu
  if (!token || !newPassword) return res.status(400).json({ success: false, message: "Chýba token alebo heslo" });  // Ak chýba token alebo heslo, vráť chybu

  db.query(                            // SELECT query pre nájdenie používateľa podľa tokenu
    "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",  // Kontrola či token existuje a ešte nevypršal
    [token],                           // Parameter: reset token
    async (err, results) => {          // Callback s výsledkami
      if (err) return res.status(500).json({ success: false, message: "DB error" });  // Databázová chyba
      if (results.length === 0) return res.status(400).json({ success: false, message: "Neplatný alebo expirovaný token" });  // Token neexistuje alebo vypršal

      const user = results[0];         // Získanie používateľa
      const hash = await bcrypt.hash(newPassword, 10);  // Hashovanie nového hesla

      db.query(                        // UPDATE query pre uloženie nového hesla a vymazanie reset tokenu
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",  // Uloženie nového hesla, vymazanie tokenu a expirácie
        [hash, user.id],               // Parametre: hashované heslo, ID používateľa
        err2 => {                      // Callback
          if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní hesla" });  // Chyba pri ukladaní
          res.json({ success: true, message: "Heslo bolo úspešne zmenené" });  // Heslo úspešne zmenené
        }
      );
    }
  );
});

// Načítanie dát používateľa
app.get("/api/my-data", (req, res) => {  // GET endpoint pre načítanie nameraných dát prihláseného používateľa
  const token = req.headers.authorization?.replace("Bearer ", "");  // Extrakcia JWT tokenu z Authorization hlavičky (odstránenie "Bearer " prefixu)
  if (!token) return res.status(401).json({ success: false, message: "No token" });  // Ak token chýba, vráť chybu 401

  let decoded;                         // Premenná pre dekódovaný token
  try {                                // Pokus o overenie tokenu
    decoded = jwt.verify(token, JWT_SECRET);  // Overenie a dekódovanie JWT tokenu
  } catch {                            // Ak token nie je platný
    return res.status(401).json({ success: false, message: "Invalid token" });  // Vráť chybu 401
  }

  const sql = `                    
    SELECT m.*                         
    FROM measurements m                
    JOIN devices d ON m.device_id = d.id  
    WHERE d.user_id = ?                
    ORDER BY m.created_at DESC         
    LIMIT 50                           
  `;                                   // Získaj všetky merania (m.*) z tabuľky measurements, spoj s tabuľkou devices, kde user_id sa zhoduje s ID prihláseného používateľa, zoraď od najnovších, limituj na 50 záznamov
  db.query(sql, [decoded.id], (err, results) => {  // Vykonanie query s ID používateľa z tokenu
    if (err) return res.status(500).json({ success: false, message: "DB error" });  // Databázová chyba
    res.json(results);                 // Vráť pole meraní vo formáte JSON
  });
});

// Priradenie zariadenia k účtu
app.post("/api/assign-device", (req, res) => {  // POST endpoint pre priradenie zariadenia k používateľovi
  const { device_uid } = req.body;     // Extrakcia UID zariadenia z requestu
  const token = req.headers.authorization?.replace("Bearer ", "");  // Extrakcia JWT tokenu z hlavičky
  if (!token) return res.status(401).json({ success: false, message: "No token" });  // Ak token chýba, vráť chybu

  let decoded;                         // Premenná pre dekódovaný token
  try {                                // Pokus o overenie tokenu
    decoded = jwt.verify(token, JWT_SECRET);  // Overenie JWT tokenu
  } catch {                            // Ak token nie je platný
    return res.status(401).json({ success: false, message: "Invalid token" });  // Vráť chybu
  }

  db.query("UPDATE devices SET user_id = ? WHERE device_uid = ?", [decoded.id, device_uid], err => {  // UPDATE query pre priradenie zariadenia k používateľovi
    if (err) return res.status(500).json({ success: false, message: "Error" });  // Databázová chyba
    res.json({ success: true, message: "Device assigned" });  // Zariadenie úspešne priradené
  });
});

// Prijímanie dát z ESP 
app.post("/api/send-data", (req, res) => {  // POST endpoint pre prijímanie dát z ESP8266 oximetra
  const { bpm, spo2, led, device_uid } = req.body;  // Extrakcia BPM, SpO2, LED intenzity a UID zariadenia z requestu

  if (!bpm || !spo2 || !device_uid) {  // Ak chýbajú povinné údaje
    return res.status(400).json({ success: false, message: "Chýbajú údaje" });  // Vráť chybu 400
  }

  db.query("SELECT user_id FROM devices WHERE device_uid = ?", [device_uid], (err, results) => {  // SELECT query pre nájdenie zariadenia podľa UID
    if (err) return res.status(500).json({ success: false, message: "DB error" });  // Databázová chyba
    if (results.length === 0) return res.status(404).json({ success: false, message: "Zariadenie nenájdené" });  // Zariadenie s týmto UID neexistuje

    const user_id = results[0].user_id;  // Získanie ID používateľa ktorému patrí zariadenie
    if (!user_id) return res.status(400).json({ success: false, message: "Zariadenie nie je priradené žiadnemu používateľovi" });  // Ak zariadenie nie je priradené nikomu, vráť chybu

    db.query(                          // INSERT query pre uloženie merania do databázy
      "INSERT INTO measurements (device_id, bpm, spo2, led, created_at) VALUES ((SELECT id FROM devices WHERE device_uid = ?), ?, ?, ?, NOW())",  // Vloženie merania s aktuálnym časom (NOW())
      [device_uid, bpm, spo2, led],    // Parametre: UID zariadenia (pre získanie device_id), BPM, SpO2, LED
      err2 => {                        // Callback
        if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní merania" });  // Chyba pri ukladaní
        res.json({ success: true, message: "Meranie uložené" });  // Meranie úspešne uložené
      }
    );
  });
});

const PORT = process.env.PORT || 10000;  // Port na ktorom server počúva (z .env alebo predvolene 10000)
app.listen(PORT, "0.0.0.0", () => console.log("Server beží na porte", PORT));  // Spustenie servera na všetkých sieťových rozhraniach (0.0.0.0) a vypísanie hlášky
