const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.text());
app.use(express.urlencoded({ extended: true }));

const MAX_USERS = 20;
const RESET_TIME = 25 * 60 * 1000; // 25 minutes

let users = new Array(MAX_USERS).fill(false);
let states = {};
let session_id = 1;

setInterval(() => {
  console.log("Resetting all users");

  users.fill(false);
  states = {};

  session_id += 1;
}, RESET_TIME);

app.post("/login", (req, res) => {
  for (let i = 0; i < MAX_USERS; i++) {
    if (!users[i]) {
      users[i] = true;
      const uid = i + 1;
      states[uid] = {};
      return res.json({
        user_id: i + 1,
        session_id: session_id,
      });
    }
  }

  res.status(403).json({ error: "Server full" });
});

app.post("/logout", (req, res) => {
  const uid = req.body.user_id;
  const client_session = req.body.session_id;
  if (client_session !== session_id) {
    return res.json({ status: "ignored" });
  }
  if (uid >= 1 && uid <= MAX_USERS) {
    users[uid - 1] = false;
    delete states[uid];
    console.log("User", uid, "freed");
  }
  res.json({ status: "ok" });
});

app.post("/update_state", (req, res) => {
  const uid = req.body.user_id;
  const state = req.body.state;
  const client_session = req.body.session_id;
  console.log(
    "User",
    uid,
    "state:",
    state,
    "session:",
    client_session,
    session_id,
  ); // Debugging line
  if (client_session != session_id) {
    console.log("Session mismatch");
    return res.status(401).json({
      error: "session expired",
    });
  }
  if (uid < 1 || uid > MAX_USERS) {
    return res.status(403).json({ error: "invalid user" });
  }
  states[uid] = state;
  res.json({ status: "stored" });
});

app.post("/reset", (req, res) => {
  console.log("Manual reset triggered");
  users.fill(false);
  states = {};
  session_id += 1;
  res.json({
    status: "all users reset",
    new_session: session_id,
  });
});

app.get("/states", (req, res) => {
  res.json(states);
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});

app.get("/", (req, res) => {
  res.send("Server running");
});
