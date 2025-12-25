const express = require("express");
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Cloud MySQL pripojenie
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

// prijímanie dát z ESP
app.post("/api/data", (req, res) => {
    const { bpm, spo2, led } = req.body;

    if (!bpm || !spo2) {
        return res.status(400).send("Invalid data");
    }

    const sql = "INSERT INTO measurements (bpm, spo2, led) VALUES (?, ?, ?)";
    db.query(sql, [bpm, spo2, led], err => {
        if (err) return res.status(500).send(err);
        res.send("OK");
    });
});

// dáta pre web
app.get("/api/data", (req, res) => {
    db.query(
        "SELECT * FROM measurements ORDER BY created_at DESC LIMIT 50",
        (err, results) => {
            if (err) return res.status(500).send(err);
            res.json(results);
        }
    );
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("Server beží na porte", PORT);
});
