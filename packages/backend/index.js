// This should be at the top
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const Storm = require("stormdb");
const bcrypt = require("bcrypt");
const express = require("express");
const { nanoid } = require("nanoid");
const passwordValidator = require("password-validator");
const emailValidator = require("email-validator");
const jwt = require("jsonwebtoken");
const PORT = process.env.PORT || 4001;

const engine = new Storm.localFileEngine("./db/db.stormdb", { async: true });
const db = new Storm(engine);
db.default({ users: [] });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "client/build")));

// Utils

const passwordCriteria = new passwordValidator();
passwordCriteria
  .is()
  .min(8)
  .is()
  .max(32)
  .has()
  .uppercase(1)
  .has()
  .lowercase(1)
  .has()
  .digits(1)
  .has()
  .not()
  .spaces();

// Routes
app.get("/", (req, res) => {
  res.status(200).send({
    Name: "AskAPeer API v0.0.1, Hackathon entrant",
    Homepage: "",
    Repository: "",
    Author: "Rafayel Amirkhanyan",
  });
});

app.post("/auth/create-user", async (req, res) => {
  const { email, username, password, role } = req.body;
  try {
    const emailMatch = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);

    if (emailMatch.email == email) {
      res.status(400).send({ message: "Email already exists" });
      throw new Error("Email already exists");
    }

    const type = "user";

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = {
      type: type,
      _id: nanoid(),
      email: email,
      username: username,
      password: hashedPassword,
      role: role,
    };

    db.get("users").push(user);
    await db.save();

    res.json({ success: true, message: user });
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error });
  }
});

app.post("/auth/create-test-user", async (req, res) => {
  const { email, username, password, role } = req.body;
  try {
    const emailMatch = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);

    if (emailMatch.email == email) {
      res.status(400).send({ message: "Email already exists" });
      throw new Error("Email already exists");
    }

    db.get("users").push({
      type: type,
      _id: nanoid(),
      email: email,
      username: username,
      password: hashedPassword,
      role: role,
    });
    await db.save();

    const hashedPassword = await bcrypt.hash(password, 10);
  } catch (error) {
    res.json({ success: false, message: error });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, username, password } = req.body;

  try {
    const emailMatch = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);

    if (!emailMatch.email) {
      res.status(400).send({ message: "Email does not exist" });
      throw new Error("Email does not exists");
    }

    const readPassword = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);
    if (await bcrypt.compare(password, readPassword.password)) {
      res.status(400).send({
        success: true,
        message: "Logged in",
      });


      const token = jwt.sign({
          email: email,
          password: password
      }, process.env.jwtKey)

      res.cookie("token", token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 1000 * 60 * 60 * 24 * 365 * 100
      })
      // Rest of the login code
    }
  } catch (error) {
    console.log(error);
    res.json({ success: false, message: error });
  }
});

app.get("/auth/check-auth-status", (req, res) => {});

app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "/client/build/index.html"))
);

app.listen(PORT, () => console.log(`Running API On ${PORT}`));
