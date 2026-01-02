const express = require("express");
require("dotenv").config();
const { Pool } = require("pg");
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

// =======================
// PostgreSQL pripojenie (Supabase)
// =======================
const db = new Pool({
  host: "db.vtbkumjtarhpgcajlsaj.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: scvptqevuc123, 
  ssl: { rejectUnauthorized: false }
});

db.connect()
  .then(() => console.log("PostgreSQL connected"))
  .catch(err => console.error("PostgreSQL error:", err));

// =======================
// Registrácia
// =======================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Chýbajú údaje" });

  try {
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (email, password) VALUES ($1, $2)",
      [email, hash]
    );
    res.json({ success: true, message: "Registrácia prebehla úspešne" });
  } catch (err) {
    console.error(err);
    res.status(400).json({ success: false, message: "Používateľ už existuje alebo DB error" });
  }
});

// =======================
// Prihlásenie
// =======================
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: "Používateľ nenájdený" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Zlé heslo" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

// =======================
// Reset hesla – generovanie tokenu
// =======================
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Chýba email" });

  try {
    const { rows } = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Email nie je registrovaný" });

    const user = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.query(
      "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
      [token, expires.toISOString(), user.id]
    );

    const resetLink = `https://oxymeter-server.onrender.com/reset-password-form.html?token=${token}`;

    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: process.env.BREVO_SENDER_NAME, email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email }],
        subject: "Obnova hesla – Oxymeter",
        htmlContent: `
          <h2>Reset hesla</h2>
          <p>Klikni na tento link pre zmenu hesla:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>Platnosť linku: 15 minút</p>
        `
      },
      { headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" } }
    );

    res.json({ success: true, message: "Link na reset hesla bol odoslaný." });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ success: false, message: "Chyba pri odosielaní emailu alebo DB" });
  }
});

// =======================
// Nastavenie nového hesla
// =======================
app.post("/api/set-new-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: "Chýba token alebo heslo" });

  try {
    const { rows } = await db.query(
      "SELECT * FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()",
      [token]
    );
    if (rows.length === 0) return res.status(400).json({ success: false, message: "Neplatný alebo expirovaný token" });

    const user = rows[0];
    const hash = await bcrypt.hash(newPassword, 10);

    await db.query(
      "UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2",
      [hash, user.id]
    );

    res.json({ success: true, message: "Heslo bolo úspešne zmenené" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

// =======================
// Načítanie dát používateľa
// =======================
app.get("/api/my-data", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } 
  catch { return res.status(401).json({ success: false, message: "Invalid token" }); }

  try {
    const sql = `
      SELECT m.*
      FROM measurements m
      JOIN devices d ON m.device_id = d.id
      WHERE d.user_id = $1
      ORDER BY m.created_at DESC
      LIMIT 50
    `;
    const { rows } = await db.query(sql, [decoded.id]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

// =======================
// Priradenie zariadenia k účtu
// =======================
app.post("/api/assign-device", async (req, res) => {
  const { device_uid } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try { decoded = jwt.verify(token, JWT_SECRET); } 
  catch { return res.status(401).json({ success: false, message: "Invalid token" }); }

  try {
    await db.query("UPDATE devices SET user_id = $1 WHERE device_uid = $2", [decoded.id, device_uid]);
    res.json({ success: true, message: "Device assigned" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

// =======================
// Prijímanie dát z ESP s opravou času
// =======================
app.post("/api/send-data", async (req, res) => {
  const { bpm, spo2, led, device_uid } = req.body;
  if (!bpm || !spo2 || !device_uid) return res.status(400).json({ success: false, message: "Chýbajú údaje" });

  try {
    const { rows } = await db.query("SELECT user_id FROM devices WHERE device_uid = $1", [device_uid]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Zariadenie nenájdené" });

    const user_id = rows[0].user_id;
    if (!user_id) return res.status(400).json({ success: false, message: "Zariadenie nie je priradené žiadnemu používateľovi" });

    await db.query(
      "INSERT INTO measurements (device_id, bpm, spo2, led, created_at) VALUES ((SELECT id FROM devices WHERE device_uid = $1), $2, $3, $4, NOW() AT TIME ZONE 'UTC+1')",
      [device_uid, bpm, spo2, led]
    );

    res.json({ success: true, message: "Meranie uložené" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "DB error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Server beží na porte", PORT));
