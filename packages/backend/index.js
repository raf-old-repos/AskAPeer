// This should be at the top
require("dotenv").config();
const cors = require("cors");
const path = require("path");
const Storm = require("stormdb");
const bcrypt = require("bcrypt");
const express = require("express");
const { nanoid } = require("nanoid");
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

// Probably should've used this for auth but I was tired ok
const getCurrent = (dbVal, prop, reqInfo) => {
  const currentVal = db.get(dbVal).value();

  if (currentVal.length != 0) {
    return currentVal.find((match) => match[prop] == reqInfo);
  } else if (currentVal == undefined) {
    return undefined;
  }
};

const getCurrentQuestion = (id) => {
  const currentVal = db.get("questions").value();

  if (currentVal.length != 0) {
    return currentVal.find((match) => match["_id"] == id);
  } else if (currentVal == undefined) {
    return undefined;
  }
};


const protectedRoute = (req, res, callback) => {
  const token = req.header("auth-token");

  if (!token) {
    return res.status(401).send("Access denied");
  }

  req.user = jwt.verify(token, process.env.jwtKey);
  callback(res);
};

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
    const emailValue = db.get("users").value();

    if (emailValue.length != 0) {
      const emailMatch = emailValue.find((match) => match["email"] == email);
      if (emailMatch.email == email) {
        res.status(400).send({ message: "Email already exists" });
        throw new Error("Email already exists");
      }
    }

    // Checking if the email already exists in the DB

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
      questions: {},
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

// !REQUIRES EMAIL
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

// Data routes

// Post a question
app.post("/api/question", (req, res) => {
  const { email, id, title, body, tags } = req.body;

  try {
    protectedRoute(req, res, async (res) => {
      const currentQuestion = getCurrentQuestion(id);

      if (currentQuestion != undefined) {
        if (currentQuestion._id == id) {
          res.status(400).send({
            success: false,
            message: "Question already exists",
          });
          throw new Error("Question already exists");
        }
      }

      db.get("questions").push({
        _id: id,
        title: title,
        body: body,
        tags: tags,
        date: Date(),
        answers: [],
      });

      await db.save();

      res.status(201).send({
        success: true,
        message: "Posted question",
      });
    });
  } catch (error) {
    console.error(error);
  }
});

// Get question

app.get("/api/question/:id", (req, res) => {
  const id = req.params.id;

  try {
    protectedRoute(req, res, (res) => {
      const target = db
        .get("questions")
        .value()
        .find((match) => match["_id"] == id);

      res.status(201).send({
        success: true,
        message: target,
      });
    });
  } catch (error) {
    console.error(error);
  }
});

// Answer a question
app.post("/api/question/:id/answer", (req, res) => {
  const id = req.params.id;

  const { author, body } = req.body;
  try {
    protectedRoute(req, res, async (res) => {
      const targetIndex = db
        .get("questions")
        .value()
        .findIndex((match) => match["_id"] == id);

      db.get("questions").get(targetIndex).get("answers").push({
        author: author,
        body: body,
        date: Date(),
      });

      await db.save();

      res.status(201).send({
        success: true,
        message: "Posted answer",
      });
    });
  } catch (error) {
    console.error(error);
  }
});

// A feed of posts
app.get("/api/feed", (req, res) => {
  try {
    protectedRoute(req, res, (res) => {
      const data = db.get("questions").value();
      res.status(201).send({
        success: true,
        data: data,
      });
    });
  } catch (error) {
    console.error(error);
  }
});

// Get current user info

app.get("/api/me", (req, res) => {
  const { email } = req.body;

  try {
    protectedRoute(req, res, (res) => {
      const user = db
        .get("users")
        .value()
        .find((match) => {
          match["email"] == email;
        });

      res.status(201).send({
        success: true,
        data: user,
      });
    });
  } catch (error) {
    console.error(error);
  }
});

app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "/client/build/index.html"))
);

app.listen(PORT, () => console.log(`Running API On ${PORT}`));
