const express = require("express");
require("dotenv").config();
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
const JWT_SECRET = "tajne_heslo_pre_token";

app.use(express.static("public"));
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// MySQL pripojenie
const db = mysql.createConnection({
  host: "sql5.freesqldatabase.com",
  user: "sql5813294",
  password: "jMDWJt39In",
  database: "sql5813294",
  port: 3306
});

db.connect(err => {
  if (err) return console.error("MySQL error:", err);
  console.log("MySQL connected");
});


// =======================
// Registrácia
// =======================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Chýbajú údaje" });

  const hash = await bcrypt.hash(password, 10);
  db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash], err => {
    if (err) return res.status(400).json({ success: false, message: "Používateľ už existuje" });
    res.json({ success: true, message: "Registrácia prebehla úspešne" });
  });
});

// =======================
// Prihlásenie
// =======================
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0) return res.status(401).json({ success: false, message: "Používateľ nenájdený" });

    const user = results[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Zlé heslo" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, token });
  });
});

// =======================
// Reset hesla – generovanie tokenu
// =======================
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Chýba email" });

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Email nie je registrovaný" });

    const user = results[0];
    const token = crypto.randomBytes(32).toString("hex");

    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minút v UTC
    const expiresFormatted = expires.toISOString().slice(0, 19).replace("T", " ");

    db.query(
      "UPDATE users SET reset_token = ?, reset_token_expires = CONVERT_TZ(?, '+00:00', '+01:00') WHERE id = ?",
      [token, expiresFormatted, user.id],
      async (err2) => {
        if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní tokenu" });

        const resetLink = `https://oxymeter-server.onrender.com/reset-password-form.html?token=${token}`;

        try {
          await axios.post(
            "https://api.brevo.com/v3/smtp/email",
            {
              sender: {
                name: process.env.BREVO_SENDER_NAME,
                email: process.env.BREVO_SENDER_EMAIL
              },
              to: [{ email }],
              subject: "Obnova hesla – Oxymeter",
              htmlContent: `
                <h2>Reset hesla</h2>
                <p>Klikni na tento link pre zmenu hesla:</p>
                <a href="${resetLink}">${resetLink}</a>
                <p>Platnosť linku: 15 minút</p>
              `
            },
            {
              headers: {
                "api-key": process.env.BREVO_API_KEY,
                "Content-Type": "application/json"
              }
            }
          );

          res.json({ success: true, message: "Link na reset hesla bol odoslaný." });
        } catch (e) {
          console.error("Brevo API error:", e.response?.data || e.message);
          res.status(500).json({ success: false, message: "Chyba pri odosielaní emailu" });
        }
      }
    );
  });
});

// =======================
// Nastavenie nového hesla
// =======================
app.post("/api/set-new-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: "Chýba token alebo heslo" });

  db.query(
    "SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()",
    [token],
    async (err, results) => {
      if (err) return res.status(500).json({ success: false, message: "DB error" });
      if (results.length === 0) return res.status(400).json({ success: false, message: "Neplatný alebo expirovaný token" });

      const user = results[0];
      const hash = await bcrypt.hash(newPassword, 10);

      db.query(
        "UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?",
        [hash, user.id],
        err2 => {
          if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní hesla" });
          res.json({ success: true, message: "Heslo bolo úspešne zmenené" });
        }
      );
    }
  );
});

// =======================
// Načítanie dát používateľa
// =======================
app.get("/api/my-data", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const sql = `
    SELECT m.*
    FROM measurements m
    JOIN devices d ON m.device_id = d.id
    WHERE d.user_id = ?
    ORDER BY m.created_at DESC
    LIMIT 50
  `;
  db.query(sql, [decoded.id], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    res.json(results);
  });
});

// =======================
// Priradenie zariadenia k účtu
// =======================
app.post("/api/assign-device", (req, res) => {
  const { device_uid } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  db.query("UPDATE devices SET user_id = ? WHERE device_uid = ?", [decoded.id, device_uid], err => {
    if (err) return res.status(500).json({ success: false, message: "Error" });
    res.json({ success: true, message: "Device assigned" });
  });
});

// =======================
// Prijímanie dát z ESP s opravou času
// =======================
app.post("/api/send-data", (req, res) => {
  const { bpm, spo2, led, device_uid } = req.body;

  if (!bpm || !spo2 || !device_uid) {
    return res.status(400).json({ success: false, message: "Chýbajú údaje" });
  }

  db.query("SELECT user_id FROM devices WHERE device_uid = ?", [device_uid], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (results.length === 0) return res.status(404).json({ success: false, message: "Zariadenie nenájdené" });

    const user_id = results[0].user_id;
    if (!user_id) return res.status(400).json({ success: false, message: "Zariadenie nie je priradené žiadnemu používateľovi" });

    db.query(
     "INSERT INTO measurements (device_id, bpm, spo2, led, created_at) VALUES ((SELECT id FROM devices WHERE device_uid = ?), ?, ?, ?, CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+01:00'))",
      [device_uid, bpm, spo2, led],
      err2 => {
        if (err2) return res.status(500).json({ success: false, message: "Chyba pri ukladaní merania" });
        res.json({ success: true, message: "Meranie uložené" });
      }
    );
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Server beží na porte", PORT));
