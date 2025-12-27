const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

const app = express();
const JWT_SECRET = "tajne_heslo_pre_token";

// 🔐 SMTP konfigurácia (Brevo)
const mail = nodemailer.createTransport({
  host: "smtp-relay.brevo.com",
  port: 587,
  secure: false,
  auth: {
    user: "9edf2f001@smtp-brevo.com",
    pass: "PcaYNTVE4IGUDLb1"
  }
});

app.use(express.static("public"));
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// --- MySQL pripojenie ---
const db = mysql.createConnection({
  host: "sql7.freesqldatabase.com",
  user: "sql7812947",
  password: "FYhzwSy1k5",
  database: "sql7812947",
  port: 3306
});

db.connect(err => {
  if (err) {
    console.error("MySQL error:", err);
    return;
  }
  console.log("MySQL connected");
});

// 🔴 ESP → POSIELANIE DÁT
app.post("/api/data", (req, res) => {
  console.log("Prijaté JSON z ESP:", req.body);

  const { bpm, spo2, led, device_uid } = req.body;
  const bpmNum = Number(bpm);
  const spo2Num = Number(spo2);
  const ledNum = Number(led);

  if (isNaN(bpmNum) || isNaN(spo2Num) || isNaN(ledNum) || !device_uid) {
    return res.status(400).send("Invalid data");
  }

  db.query("SELECT id FROM devices WHERE device_uid = ?", [device_uid], (err, results) => {
    if (err || results.length === 0) return res.status(400).send("Unknown device");

    const deviceId = results[0].id;

    db.query(
      "INSERT INTO measurements (bpm, spo2, led, device_id) VALUES (?, ?, ?, ?)",
      [bpmNum, spo2Num, ledNum, deviceId],
      err => {
        if (err) {
          console.error("DB insert error:", err);
          return res.status(500).send("Database error");
        }
        res.send("OK");
      }
    );
  });
});

// 🔐 REGISTRÁCIA
app.get("/api/register", (req, res) => {
  res.send("Použi POST /api/register s emailom a heslom");
});

app.post("/api/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).send("Missing data");

  const hash = await bcrypt.hash(password, 10);

  db.query("INSERT INTO users (email, password) VALUES (?, ?)", [email, hash], err => {
    if (err) return res.status(400).send("User exists");
    res.send("Registered");
  });
});

// 🔐 PRIHLÁSENIE
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (results.length === 0) return res.status(401).send("User not found");

    const user = results[0];
    const ok = await bcrypt.compare(password, user.password);

    if (!ok) return res.status(401).send("Wrong password");

    const token = jwt.sign({ id: user.id }, JWT_SECRET);
    res.json({ token });
  });
});

// 🔁 RESET HESLA
app.post("/api/reset-password", (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).send("Chýba email");

  db.query("SELECT * FROM users WHERE email = ?", [email], async (err, results) => {
    if (err) return res.status(500).send("DB error");
    if (results.length === 0) return res.status(404).send("Tento email nie je registrovaný");

    const newPass = Math.random().toString(36).slice(-8);
    const hash = await bcrypt.hash(newPass, 10);

    db.query("UPDATE users SET password = ? WHERE email = ?", [hash, email], err2 => {
      if (err2) return res.status(500).send("Chyba pri ukladaní hesla");

      mail.sendMail(
        {
          from: "Oxymeter <noreply@oxymeter.app>",
          to: email,
          subject: "Obnova hesla - Oxymeter",
          text: `Tvoje nové heslo je: ${newPass}`
        },
        err3 => {
          if (err3) {
            console.error("Email error:", err3);
            return res.status(500).send("Chyba pri odosielaní emailu");
          }

          res.send("Nové heslo bolo odoslané na tvoj email.");
        }
      );
    });
  });
});

// 🔗 PRIRADENIE ZARIADENIA K USEROVI
app.post("/api/assign-device", (req, res) => {
  const { device_uid } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).send("No token");

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).send("Invalid token");
  }

  db.query("UPDATE devices SET user_id = ? WHERE device_uid = ?", [decoded.id, device_uid], err => {
    if (err) return res.status(500).send("Error");
    res.send("Device assigned");
  });
});

// 📊 DÁTA PRE PRIHLÁSENÉHO USERA
app.get("/api/my-data", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).send("No token");

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).send("Invalid token");
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
    if (err) return res.status(500).send("DB error");
    res.json(results);
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("Server beží na porte", PORT);
});
