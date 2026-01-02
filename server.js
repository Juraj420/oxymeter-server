const express = require("express");
require("dotenv").config();
const mysql = require("mysql2/promise"); // Použijeme promise pool
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
// Nastavenie DB Pool
// =======================
const db = mysql.createPool({
  host: "sql5.freesqldatabase.com",
  user: "sql5813284",
  password: "jMDWJt39In",
  database: "sql5813294",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

db.getConnection()
  .then(() => console.log("MySQL connected"))
  .catch(err => console.error("MySQL connection error:", err));

// =======================
// Registrácia
// =======================
app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Chýbajú údaje" });

  const hash = await bcrypt.hash(password, 10);
  try {
    await db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash]);
    res.json({ success: true, message: "Registrácia prebehla úspešne" });
  } catch (err) {
    console.error("INSERT ERROR:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ success: false, message: "Používateľ už existuje" });
    }
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

// =======================
// Prihlásenie
// =======================
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: "Používateľ nenájdený" });

    const user = rows[0];
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ success: false, message: "Zlé heslo" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ success: true, token });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

// =======================
// Reset hesla
// =======================
app.post("/api/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Chýba email" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Email nie je registrovaný" });

    const user = rows[0];
    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    const expiresFormatted = expires.toISOString().slice(0, 19).replace("T", " ");

    await db.query(
      "UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?",
      [token, expiresFormatted, user.id]
    );

    const resetLink = `https://oxymeter-server.onrender.com/reset-password-form.html?token=${token}`;

    await axios.post(
      "https://api.brevo.com/v3/smtp/email",
      {
        sender: { name: process.env.BREVO_SENDER_NAME, email: process.env.BREVO_SENDER_EMAIL },
        to: [{ email }],
        subject: "Obnova hesla – Oxymeter",
        htmlContent: `<h2>Reset hesla</h2><p>Klikni na tento link pre zmenu hesla:</p><a href="${resetLink}">${resetLink}</a><p>Platnosť linku: 15 minút</p>`
      },
      { headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json" } }
    );

    res.json({ success: true, message: "Link na reset hesla bol odoslaný." });
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ success: false, message: "Chyba pri odosielaní emailu" });
  }
});

// =======================
// Nastavenie nového hesla
// =======================
app.post("/api/set-new-password", async (req, res) => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) return res.status(400).json({ success: false, message: "Chýba token alebo heslo" });

  try {
    const [rows] = await db.query("SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW()", [token]);
    if (rows.length === 0) return res.status(400).json({ success: false, message: "Neplatný alebo expirovaný token" });

    const hash = await bcrypt.hash(newPassword, 10);
    await db.query("UPDATE users SET password = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?", [hash, rows[0].id]);

    res.json({ success: true, message: "Heslo bolo úspešne zmenené" });
  } catch (err) {
    console.error("Set new password error:", err);
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

// =======================
// Načítanie dát používateľa
// =======================
app.get("/api/my-data", async (req, res) => {
  const tokenHeader = req.headers.authorization?.replace("Bearer ", "");
  if (!tokenHeader) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try { decoded = jwt.verify(tokenHeader, JWT_SECRET); }
  catch { return res.status(401).json({ success: false, message: "Invalid token" }); }

  try {
    const [rows] = await db.query(`
      SELECT m.*
      FROM measurements m
      JOIN devices d ON m.device_id = d.id
      WHERE d.user_id = ?
      ORDER BY m.created_at DESC
      LIMIT 50
    `, [decoded.id]);

    res.json(rows);
  } catch (err) {
    console.error("My-data error:", err);
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

// =======================
// Priradenie zariadenia k účtu
// =======================
app.post("/api/assign-device", async (req, res) => {
  const { device_uid } = req.body;
  const tokenHeader = req.headers.authorization?.replace("Bearer ", "");
  if (!tokenHeader) return res.status(401).json({ success: false, message: "No token" });

  let decoded;
  try { decoded = jwt.verify(tokenHeader, JWT_SECRET); }
  catch { return res.status(401).json({ success: false, message: "Invalid token" }); }

  try {
    await db.query("UPDATE devices SET user_id = ? WHERE device_uid = ?", [decoded.id, device_uid]);
    res.json({ success: true, message: "Device assigned" });
  } catch (err) {
    console.error("Assign-device error:", err);
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

// =======================
// Prijímanie dát z ESP s opravou času
// =======================
app.post("/api/send-data", async (req, res) => {
  const { bpm, spo2, led, device_uid } = req.body;
  if (!bpm || !spo2 || !device_uid) return res.status(400).json({ success: false, message: "Chýbajú údaje" });

  try {
    const [rows] = await db.query("SELECT user_id FROM devices WHERE device_uid = ?", [device_uid]);
    if (rows.length === 0) return res.status(404).json({ success: false, message: "Zariadenie nenájdené" });
    if (!rows[0].user_id) return res.status(400).json({ success: false, message: "Zariadenie nie je priradené žiadnemu používateľovi" });

    await db.query(
      "INSERT INTO measurements (device_id, bpm, spo2, led, created_at) VALUES ((SELECT id FROM devices WHERE device_uid = ?), ?, ?, ?, UTC_TIMESTAMP())",
      [device_uid, bpm, spo2, led]
    );

    res.json({ success: true, message: "Meranie uložené" });
  } catch (err) {
    console.error("Send-data error:", err);
    res.status(500).json({ success: false, message: "DB ERROR" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => console.log("Server beží na porte", PORT));
