const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const port = 3000;

const app = express();
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:8080',
  methods: ['GET', 'POST', 'DELETE', 'UPDATE', 'PUT', 'PATCH']
}));

const users = [];

const SECRET_KEY = 'your_secret_key';

app.post('/register', async (req, res) => {
  try {
    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const user = { username: req.body.username, password: hashedPassword };
    users.push(user);
    res.status(201).send('User registered');
  } catch {
    res.status(500).send();
  }
});

app.post('/login', async (req, res) => {
  const user = users.find(user => user.username === req.body.username);
  if (!user) {
    return res.status(400).send('Cannot find user');
  }
  try {
    if (await bcrypt.compare(req.body.password, user.password)) {
      const accessToken = jwt.sign({ username: user.username }, SECRET_KEY);
      res.json({ accessToken: accessToken });
    } else {
      res.send('Not Allowed');
    }
  } catch {
    res.status(500).send();
  }
});

app.listen(port, () => {
  console.log(`Back running on port ${port}`)
});
