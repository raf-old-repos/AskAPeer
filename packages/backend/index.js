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

// Middleware

// Database
const engine = new Storm.localFileEngine("./db/db.stormdb", { async: true });
const db = new Storm(engine);

// Intitate users array
db.default({ users: [] });

const app = express();

// Express stuff

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

// Base route, sends API info
app.get("/", (req, res) => {
  res.status(200).send({
    Name: "AskAPeer API v0.0.1, Hackathon entrant",
    Homepage: "https://github.com/Gitter499/AskAPeer",
    Repository: "https://github.com/Gitter499/AskAPeer",
    Author: "Rafayel Amirkhanyan",
  });
});

// Create user

app.post("/auth/create-user", async (req, res) => {
  const { email, username, password, role } = req.body;
  try {
    // Finding the matching user
    const emailMatch = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);

    // Checking if the email already exists in the DB
    if (emailMatch.email == email) {
      res.status(400).send({ message: "Email already exists" });
      throw new Error("Email already exists");
    }

    const type = "user";

    // Hasing password for security
    const hashedPassword = await bcrypt.hash(password, 10);

    // Storing user creds in database
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
    // Same code with different type
    const emailMatch = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);

    if (emailMatch.email == email) {
      res.status(400).send({ message: "Email already exists" });
      throw new Error("Email already exists");
    }

    const type = "test-user";
    const hashedPassword = await bcrypt.hash(password, 10);

    db.get("users").push({
      type: type,
      _id: nanoid(),
      email: email,
      username: username,
      password: hashedPassword,
      role: role,
    });
    await db.save();

    res.json({ success: true, message: user });
  } catch (error) {
    res.json({ success: false, message: error });
  }
});

app.post("/auth/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // Finding a match
    const emailMatch =
      db
        .get("users")
        .value()
        .find((match) => match["email"] == email) || false;

    if (emailMatch == false) {
      res.status(400).send({ message: "Email does not exist" });
      throw new Error("Email does not exist");
    }

    const readPassword = db
      .get("users")
      .value()
      .find((match) => match["email"] == email);
    if (await bcrypt.compare(password, readPassword.password)) {
      const token = jwt.sign(
        {
          email: email,
          password: password,
        },
        process.env.jwtKey
      );

      res.header("auth-token", token);

      res.status(201).send({ success: true, message: "Logged in" });
      res.end();
    }
  } catch (error) {
    console.log(error);
    // res.json({ success: false, message: error });
  }
});

// Checks auth status
app.get("/auth/check-auth-status", (req, res) => {
  const clientAuth = req.header("auth-token");

  if (clientAuth == undefined) {
    res.send({ message: "Not authenticated" });
  }
  const user = db
    .get("users")
    .value()
    .find((match) => match["email"] == req.body.email);
  res.send({ message: `Authenticated as ${user.username}` });
});

// Protected route

app.get("/auth/protected-route", (req, res) => {
  protectedRoute(req, res, (res) => {
    res.status(201).send({ success: true, message: "Private" });
  });
});

// Jank protected route function
const protectedRoute = (req, res, callback) => {
  const token = req.header("auth-token");

  if (!token) {
    return res.status(401).send("Access denied");
  }
  try {
    req.user = jwt.verify(token, process.env.jwtKey);
    callback(res);
  } catch (error) {
    res.status(400).send("Invalid token");
  }
};
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "/client/build/index.html"))
);

app.listen(PORT, () => console.log(`Running API On ${PORT}`));
